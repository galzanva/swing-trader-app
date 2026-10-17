/** Parse pasted journal dumps (CSV, pipe tables, MNQ session notes) into trade rows. */

export interface PasteTrade {
  ticker: string;
  direction: 'long' | 'short';
  tradeType: 'intraday' | 'swing';
  entryDate: string;
  exitDate: string | null;
  entryTime: string | null;
  exitTime: string | null;
  entryPrice: number;
  exitPrice: number | null;
  qty: number | null;
  amount: number;
  profitLoss: number | null;
  returnPct: number | null;
  strategy: string | null;
  strategyId: string | null;
  notes: string | null;
  exitReason: 'hit_target' | 'stopped_out' | 'manual_exit' | 'time_exit' | null;
  broker: string;
  holdingDays: number;
  isOpen: boolean;
  instrumentType: 'FUTURES' | 'EQUITY' | null;
}

export interface StrategyRef {
  id: string;
  name: string;
}

export interface BrokerRef {
  slug: string;
  name: string;
}

export interface ParseResult {
  trades: PasteTrade[];
  inferredBroker: string | null;
  defaultTicker: string | null;
  sessionNotes: string | null;
  parser: 'deterministic' | 'llm' | 'hybrid';
  warnings: string[];
}

const FUTURES_MULT: Record<string, number> = {
  MNQ: 2,
  MNQU: 2,
  MNQZ: 2,
  MES: 5,
  ES: 50,
  NQ: 20,
  MYM: 0.5,
  YM: 5,
  M2K: 0.5,
  RTY: 50,
};

const STRATEGY_ALIASES: Record<string, string> = {
  'lod reversal': 'LOD-A Reversal',
  'lod-a reversal': 'LOD-A Reversal',
  'lod-a': 'LOD-A Reversal',
  'hod-short': '[Bearish] HOD Reversal',
  'hod short': '[Bearish] HOD Reversal',
  'hod-short rejection': '[Bearish] HOD Reversal',
  'hod short rejection': '[Bearish] HOD Reversal',
  'micro pullback': 'Micro Pullback [Flag]',
  'micropb': 'Micro Pullback [Flag]',
  'origin zone reload': '[BULLISH] Origin Zone - Reload',
  'origin zone - reload': '[BULLISH] Origin Zone - Reload',
  'origin zone reload (bull)': '[BULLISH] Origin Zone - Reload',
  'origin demand reload': '[BULLISH] Origin Zone - Reload',
  'break & retest': '[Scalp] Break & Retest',
  'b&r': '[Scalp] Break & Retest',
  'heatmap reaction': '[OrderFlow] Heatmap Reaction',
  '[orderflow] heatmap reaction': '[OrderFlow] Heatmap Reaction',
  'vwap bounce': 'VWAP Bounce',
  'breakout': 'Breakout',
};

export function futuresRoot(ticker: string): string {
  const t = ticker.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (t.startsWith('MNQ')) return 'MNQ';
  if (t.startsWith('MES')) return 'MES';
  if (t.startsWith('MYM')) return 'MYM';
  if (t.startsWith('M2K')) return 'M2K';
  if (t.startsWith('NQ')) return 'NQ';
  if (t.startsWith('ES')) return 'ES';
  if (t.startsWith('YM')) return 'YM';
  if (t.startsWith('RTY')) return 'RTY';
  return t;
}

export function isFuturesTicker(ticker: string): boolean {
  const root = futuresRoot(ticker);
  return root in FUTURES_MULT || /^MNQ[A-Z]?\d?$/.test(ticker.toUpperCase());
}

export function pointValue(ticker: string): number {
  const root = futuresRoot(ticker);
  return FUTURES_MULT[root] ?? (isFuturesTicker(ticker) ? 2 : 1);
}

export function padTime(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = String(raw).trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const hh = String(Math.min(23, parseInt(m[1], 10))).padStart(2, '0');
  const mm = String(Math.min(59, parseInt(m[2], 10))).padStart(2, '0');
  const ss = String(Math.min(59, parseInt(m[3] || '0', 10))).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function parseNum(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).replace(/[$,+\s]/g, '').replace(/−/g, '-');
  if (!s || s === '—' || s === '-') return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function parseSide(raw: string): 'long' | 'short' | null {
  const s = raw.trim().toLowerCase();
  if (['long', 'buy', 'l', 'b'].includes(s)) return 'long';
  if (['short', 'sell', 's'].includes(s)) return 'short';
  return null;
}

export function matchStrategy(
  raw: string | null | undefined,
  strategies: StrategyRef[],
): { name: string | null; id: string | null } {
  if (!raw) return { name: null, id: null };
  const cleaned = raw.replace(/^\[(BULLISH|BEARISH)\]\s*/i, '').trim();
  if (!cleaned || /^no strategy$/i.test(cleaned)) return { name: null, id: null };

  const key = cleaned.toLowerCase().replace(/[\[\]]/g, '').replace(/\s+/g, ' ').trim();
  const aliased = STRATEGY_ALIASES[key] || STRATEGY_ALIASES[raw.trim().toLowerCase()];
  const target = (aliased || cleaned).toLowerCase();

  const exact = strategies.find((s) => s.name.toLowerCase() === target)
    || strategies.find((s) => s.name.toLowerCase() === cleaned.toLowerCase())
    || strategies.find((s) => aliased && s.name === aliased);
  if (exact) return { name: exact.name, id: exact.id };

  const contains = strategies.find((s) => {
    const n = s.name.toLowerCase().replace(/[\[\]]/g, '');
    return n.includes(key) || key.includes(n);
  });
  if (contains) return { name: contains.name, id: contains.id };

  return { name: aliased || cleaned, id: null };
}

export function inferBroker(text: string, brokers: BrokerRef[]): string | null {
  const t = text.toLowerCase();
  const rules: [RegExp, string][] = [
    [/topstep[^\n]{0,40}funded/i, 'topstep-funded'],
    [/funded account/i, 'topstep-funded'],
    [/topstep[^\n]{0,40}eval/i, 'topstep-eval'],
    [/acct\s*#?\s*5/i, 'topstep-eval'],
    [/tradethepool[^\n]{0,30}funded/i, 'tradethepool-funded'],
    [/tradethepool[^\n]{0,30}eval/i, 'tradethepool-eval'],
    [/tradethepool/i, 'tradethepool-eval'],
    [/webull/i, 'webull'],
    [/robinhood/i, 'robinhood'],
  ];
  for (const [re, slug] of rules) {
    if (re.test(t) && brokers.some((b) => b.slug === slug)) return slug;
  }
  if (/topstep/.test(t)) {
    const funded = brokers.find((b) => b.slug === 'topstep-funded');
    const evalAcc = brokers.find((b) => b.slug === 'topstep-eval');
    if (/funded/.test(t)) return funded?.slug ?? null;
    if (/eval/.test(t)) return evalAcc?.slug ?? null;
    return evalAcc?.slug || funded?.slug || null;
  }
  return null;
}

const FUTURES_SYM_RE = /\b(MNQ[A-Z]?\d?|MES[A-Z]?\d?|MYM[A-Z]?\d?|M2K[A-Z]?\d?|NQ[A-Z]?\d?|ES[A-Z]?\d?|YM[A-Z]?\d?|RTY[A-Z]?\d?)\b/gi;

function normalizeTicker(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Use a cell as a ticker only if it looks like a symbol, not a qty. */
function cellTicker(raw: string | undefined): string {
  if (!raw) return '';
  const t = normalizeTicker(raw);
  if (!t || parseNum(t) != null) return '';
  if (/^[A-Z]{1,6}[A-Z]?\d{0,2}$/.test(t)) return t;
  return '';
}

function lookTicker(row: Record<string, string>): string {
  for (const k of ['symbol', 'ticker', 'contract', 'instrument', 'product', 'underlying']) {
    const t = cellTicker(row[k]);
    if (t) return t;
  }
  const contracts = cellTicker(row.contracts);
  if (contracts && /[A-Z]/.test(contracts)) return contracts;
  return '';
}

function inferTickerFromPrice(price: number): string | null {
  // NQ/MNQ prints sit well above equity-index micros. ES vs MES cannot be told
  // apart from price — never guess those.
  if (price >= 15000) return 'MNQZ6';
  return null;
}

function inferTicker(text: string): string | null {
  const labeled = text.match(/Contract:\s*([A-Z0-9]+)/i);
  if (labeled) return normalizeTicker(labeled[1]);
  const header = text.match(/===\s*(MNQ[A-Z0-9]*|MES[A-Z0-9]*|ES[A-Z0-9]*|NQ[A-Z0-9]*)/i);
  if (header) {
    const t = normalizeTicker(header[1]);
    if (t === 'MNQ' || t === 'MNQZ') return 'MNQZ6';
    if (t === 'MES' || t === 'MESZ') return 'MESZ6';
    if (t === 'ES' || t === 'ESZ') return 'ESZ6';
    return t;
  }
  const found = [...text.matchAll(FUTURES_SYM_RE)].map((m) => {
    const t = normalizeTicker(m[1]);
    if (t === 'MNQ' || t === 'MNQZ') return 'MNQZ6';
    return t;
  });
  const unique = [...new Set(found)];
  if (unique.length === 1) return unique[0];
  return null;
}

function headerDate(text: string): string | null {
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];
  const named = text.match(
    /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)?\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(20\d{2})/i,
  );
  if (!named) return null;
  const months: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };
  const mo = months[named[1].slice(0, 3).toLowerCase()];
  if (!mo) return null;
  return `${named[3]}-${mo}-${String(named[2]).padStart(2, '0')}`;
}

function holdingDays(entry: string, exit: string | null): number {
  if (!exit) return 0;
  const a = Date.parse(`${entry}T00:00:00.000Z`);
  const b = Date.parse(`${exit}T00:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86400000));
}

function exitReasonFromPl(pl: number | null, notes: string | null): PasteTrade['exitReason'] {
  if (pl === null) return null;
  if (pl === 0 || /scratch/i.test(notes || '')) return 'manual_exit';
  if (pl > 0) return 'hit_target';
  return 'stopped_out';
}

export function finalizeTrade(
  partial: Partial<PasteTrade> & { ticker: string; direction: 'long' | 'short'; entryPrice: number; entryDate: string },
  defaultBroker: string,
): PasteTrade {
  const ticker = partial.ticker.toUpperCase();
  const qty = partial.qty ?? null;
  const fut = isFuturesTicker(ticker);
  const mult = fut ? pointValue(ticker) : 1;
  const amount = partial.amount && partial.amount > 0
    ? partial.amount
    : qty
      ? qty * partial.entryPrice * mult
      : partial.entryPrice;
  const exitPrice = partial.exitPrice ?? null;
  const hasExit = exitPrice != null;
  let profitLoss = partial.profitLoss ?? null;
  if (profitLoss == null && hasExit && qty != null) {
    const pts = partial.direction === 'long' ? exitPrice - partial.entryPrice : partial.entryPrice - exitPrice;
    profitLoss = Math.round(pts * qty * mult * 100) / 100;
  }
  const returnPct = amount && profitLoss != null ? (profitLoss / amount) * 100 : null;
  const notes = partial.notes ?? null;
  const exitDate = partial.exitDate || (hasExit ? partial.entryDate : null);

  return {
    ticker,
    direction: partial.direction,
    tradeType: partial.tradeType || 'intraday',
    entryDate: partial.entryDate,
    exitDate,
    entryTime: padTime(partial.entryTime),
    exitTime: padTime(partial.exitTime),
    entryPrice: partial.entryPrice,
    exitPrice,
    qty,
    amount: Math.round(amount * 100) / 100,
    profitLoss: profitLoss != null ? Math.round(profitLoss * 100) / 100 : null,
    returnPct,
    strategy: partial.strategy ?? null,
    strategyId: partial.strategyId ?? null,
    notes,
    exitReason: partial.exitReason ?? exitReasonFromPl(profitLoss, notes),
    broker: partial.broker || defaultBroker,
    holdingDays: holdingDays(partial.entryDate, exitDate),
    isOpen: partial.isOpen ?? !hasExit,
    instrumentType: fut ? 'FUTURES' : 'EQUITY',
  };
}

function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      q = !q;
      continue;
    }
    if (!q && c === delim) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

function headerKey(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function look(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    if (row[k] != null && row[k] !== '') return row[k];
  }
  return '';
}

function parseClockRange(raw: string, fallbackDate: string | null, year: number): { date: string; entryTime: string | null; exitTime: string | null } {
  const range = raw.match(/(?:(\d{2})-(\d{2})\s+)?(\d{1,2}:\d{2})(?::\d{2})?(?:-(\d{1,2}:\d{2})(?::\d{2})?)?/);
  if (!range) return { date: fallbackDate || `${year}-01-01`, entryTime: padTime(raw), exitTime: null };
  const date = range[1] && range[2]
    ? `${year}-${range[1]}-${range[2]}`
    : (fallbackDate || `${year}-01-01`);
  return { date, entryTime: padTime(range[3]), exitTime: padTime(range[4] || range[3]) };
}

function parseTable(
  text: string,
  defaultBroker: string,
  strategies: StrategyRef[],
  year: number,
  warnings: string[],
): PasteTrade[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headerLine = lines.find((l) => /date|time|symbol|contract|ticker|side|entry|pnl|p&l|setup/i.test(l) && (l.includes(',') || l.includes('|')));
  if (!headerLine) return [];

  const delim = headerLine.includes('|') && (headerLine.split('|').length >= headerLine.split(',').length) ? '|' : ',';
  const headers = splitCsvLine(headerLine, delim).map(headerKey);
  if (headers.length < 4) return [];

  const trades: PasteTrade[] = [];
  const start = lines.indexOf(headerLine) + 1;
  const sessionDate = headerDate(text);
  const defaultTicker = inferTicker(text);

  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (/^===|^---|^NOTE|^SPLIT|^GUARD|^WIN:|^LEAK|^RULE|^FORWARD|^FIX:/i.test(line)) continue;
    const cols = splitCsvLine(line, delim);
    if (cols.length < 3) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = cols[idx] ?? ''; });

    const side = parseSide(look(row, 'side', 'direction'));
    const entry = parseNum(look(row, 'entry', 'entryprice', 'avgfill'));
    if (!side || entry == null) continue;

    const tradeDay = look(row, 'tradeday', 'date') || sessionDate;
    const timeField = look(row, 'time', 'timein', 'entrytime');
    const clock = parseClockRange(timeField || look(row, 'timeout'), tradeDay, year);
    const exitTimeRaw = look(row, 'timeout', 'exittime');
    const exitClock = exitTimeRaw ? parseClockRange(exitTimeRaw, clock.date, year) : clock;
    // Physical calendar date comes from the clock prefix (10-05 18:17 = Sunday
    // night). Trading/session day is trade_day (Monday Globex). Never mix the
    // two across entry vs exit.
    const physicalDate = clock.date || ((tradeDay && /^\d{4}-\d{2}-\d{2}$/.test(tradeDay)) ? tradeDay : null);
    const sessionDay = (tradeDay && /^\d{4}-\d{2}-\d{2}$/.test(tradeDay)) ? tradeDay : physicalDate;
    let exitPhysical = physicalDate;
    if (physicalDate && clock.entryTime && clock.exitTime && clock.exitTime < clock.entryTime) {
      const next = new Date(`${physicalDate}T00:00:00.000Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      exitPhysical = next.toISOString().slice(0, 10);
    }
    const clockNote = sessionDay && physicalDate && physicalDate !== sessionDay
      ? `Physical ${physicalDate} evening (Asia/Globex) · trading day ${sessionDay}`
      : '';

    const rawTicker = lookTicker(row) || defaultTicker || '';
    const setupName = look(row, 'strategy', 'setup');
    const looksFutures = (entry != null && entry > 5000)
      || /lod|hod-?short|micro\s*pullback|b&r|break\s*&\s*retest/i.test(setupName);
    const ticker = rawTicker || (looksFutures ? inferTickerFromPrice(entry) || '' : '');
    if (!ticker) {
      warnings.push(`Skipped row with no contract/ticker (entry ${entry}${clock.entryTime ? ` @ ${clock.entryTime}` : ''})`);
      continue;
    }
    const root = futuresRoot(ticker);
    if (root === 'MNQ' && entry < 12000) {
      warnings.push(`${ticker} @ ${entry} looks like ES/MES, not MNQ. Check the contract column.`);
    }
    if ((root === 'MES' || root === 'ES') && entry >= 15000) {
      warnings.push(`${ticker} @ ${entry} looks like MNQ/NQ, not ${root}. Check the contract column.`);
    }

    const strat = matchStrategy(look(row, 'strategy', 'setup') || null, strategies);
    const notesParts = [
      look(row, 'note', 'notes', 'execution'),
      look(row, 'grade') ? `Grade: ${look(row, 'grade')}` : '',
      clockNote,
    ].filter(Boolean);

    trades.push(finalizeTrade({
      ticker,
      direction: side,
      entryPrice: entry,
      exitPrice: parseNum(look(row, 'exit', 'exitprice')),
      entryDate: physicalDate || sessionDay || clock.date,
      exitDate: exitPhysical || physicalDate || sessionDay || clock.date,
      entryTime: clock.entryTime,
      exitTime: exitClock.exitTime || clock.exitTime,
      qty: parseNum(look(row, 'qty', 'quantity', 'contracts', 'filledqty')),
      profitLoss: parseNum(look(row, 'pnl', 'pl', 'profitloss', 'pandl')),
      strategy: strat.name,
      strategyId: strat.id,
      notes: notesParts.join('. ') || null,
    }, defaultBroker));
  }

  return trades;
}

function parseTLines(text: string, defaultBroker: string, strategies: StrategyRef[], year: number): PasteTrade[] {
  const sessionDate = headerDate(text);
  const defaultTicker = inferTicker(text) || 'MNQZ6';
  const trades: PasteTrade[] = [];
  const lineRe = /^(T\d+[a-z]?|Asia)\s+(\d{1,2}:\d{2})(?:-(\d{1,2}:\d{2}))?\s[\s\S]*?\b(Long|Short|Buy|Sell|L|S)\b\s+(\d+)\s*c?\s+([\d.]+)\s*[>→]\s*([\d.]+)\s+([+-]?\$?[\d,.]+)/i;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const m = line.match(lineRe);
    if (!m) continue;
    const side = parseSide(m[4]);
    const entry = parseNum(m[6]);
    const exit = parseNum(m[7]);
    const pl = parseNum(m[8]);
    if (!side || entry == null) continue;

    const setupGuess = line.match(/\b(B&R|LOD-?A?(?:\s+Reversal)?|HOD-?Short(?:\s+Rejection)?|MicroPB|Micro Pullback|Origin Zone[^,]*)\b/i)?.[0] || null;
    const strat = matchStrategy(setupGuess, strategies);
    const note = line.replace(lineRe, '').replace(/^\s+/, '').slice(0, 400);

    trades.push(finalizeTrade({
      ticker: defaultTicker,
      direction: side,
      entryPrice: entry,
      exitPrice: exit,
      entryDate: sessionDate || `${year}-01-01`,
      entryTime: m[2],
      exitTime: m[3] || m[2],
      qty: parseNum(m[5]),
      profitLoss: pl,
      strategy: strat.name,
      strategyId: strat.id,
      notes: note || null,
    }, defaultBroker));
  }

  return trades;
}

export function parseDeterministic(
  text: string,
  defaultBroker: string,
  strategies: StrategyRef[],
  year = new Date().getFullYear(),
): ParseResult {
  const warnings: string[] = [];
  const inferredBroker = inferBroker(text, [
    { slug: 'topstep-eval', name: 'TopStep (Eval)' },
    { slug: 'topstep-funded', name: 'TopStep (Funded)' },
    { slug: 'tradethepool-eval', name: 'TradeThePool (Eval)' },
    { slug: 'tradethepool-funded', name: 'TradeThePool (Funded)' },
    { slug: 'webull', name: 'Webull' },
    { slug: 'robinhood', name: 'Robinhood' },
  ]);
  const broker = inferredBroker || defaultBroker;

  const table = parseTable(text, broker, strategies, year, warnings);
  const tlines = table.length ? [] : parseTLines(text, broker, strategies, year);
  const trades = table.length ? table : tlines;

  if (trades.some((t) => t.entryDate.endsWith('-01-01') && !text.includes('-01-01'))) {
    warnings.push('Some rows are missing a full date. Check the preview dates before importing.');
  }
  if (!trades.length) {
    warnings.push('No structured rows found. AI parse can still extract trades from free text.');
  }

  return {
    trades,
    inferredBroker,
    defaultTicker: inferTicker(text),
    sessionNotes: text.split(/\n/).slice(0, 8).join('\n').slice(0, 500),
    parser: trades.length ? 'deterministic' : 'deterministic',
    warnings,
  };
}

export function applyStrategyAndBroker(
  trades: PasteTrade[],
  strategies: StrategyRef[],
  defaultBroker: string,
): PasteTrade[] {
  return trades.map((t) => {
    const strat = matchStrategy(t.strategy, strategies);
    return {
      ...t,
      strategy: strat.name,
      strategyId: strat.id,
      broker: t.broker || defaultBroker,
    };
  });
}

export function llmParsePrompt(args: {
  text: string;
  brokers: BrokerRef[];
  strategies: StrategyRef[];
  defaultBroker: string;
  year: number;
}): { system: string; user: string } {
  return {
    system: `You extract trading journal rows from messy pasted notes. Return ONLY valid JSON:
{"inferredBroker":"slug-or-null","defaultTicker":"MNQZ6-or-null","sessionNotes":"short","trades":[...]}
Each trade:
{"ticker":"MNQZ6","direction":"long|short","tradeType":"intraday","entryDate":"YYYY-MM-DD","exitDate":"YYYY-MM-DD|null","entryTime":"HH:MM:SS|null","exitTime":"HH:MM:SS|null","entryPrice":0,"exitPrice":0,"qty":5,"profitLoss":-12.5,"strategy":"name or null","notes":"string or null","exitReason":"hit_target|stopped_out|manual_exit|null","broker":"slug or null"}
Rules:
- Prefer explicit P/L from the paste over recalculating.
- Buy/Long = long. Sell/Short = short.
- Times are session-local, keep as written. Normalize to HH:MM:SS.
- If year missing use ${args.year}.
- ticker MUST come from that row's contract/symbol/ticker cell. Mixed dumps (MNQ then MES/ES) are common. Never copy MNQ onto a ~5k–8k ES/MES print, and never copy MES/ES onto a ~20k–30k MNQ/NQ print.
- ES = $50/pt, MES = $5/pt, MNQ = $2/pt, NQ = $20/pt.
- Map setup names onto these strategies when close: ${args.strategies.map((s) => s.name).join('; ')}
- Broker slugs: ${args.brokers.map((b) => `${b.slug} (${b.name})`).join('; ')}
- Skip prose, totals, and rule lists that are not fills.
- Do not invent prices. Skip a row if entry price is missing.`,
    user: `Default broker: ${args.defaultBroker}\n\nPASTE:\n${args.text.slice(0, 24000)}`,
  };
}

export function tradesFromLlmJson(raw: string, defaultBroker: string, strategies: StrategyRef[]): ParseResult {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) {
    return { trades: [], inferredBroker: null, defaultTicker: null, sessionNotes: null, parser: 'llm', warnings: ['AI returned no JSON'] };
  }
  let parsed: any;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return { trades: [], inferredBroker: null, defaultTicker: null, sessionNotes: null, parser: 'llm', warnings: ['AI JSON parse failed'] };
  }

  const warnings: string[] = [];
  const inferredBroker = typeof parsed.inferredBroker === 'string' ? parsed.inferredBroker : null;
  const broker = inferredBroker || defaultBroker;
  const rows = Array.isArray(parsed.trades) ? parsed.trades : [];
  const trades: PasteTrade[] = [];

  for (const r of rows) {
    const side = parseSide(String(r.direction || r.side || ''));
    const entry = parseNum(r.entryPrice ?? r.entry);
    const ticker = normalizeTicker(String(r.ticker || r.symbol || r.contract || parsed.defaultTicker || ''));
    const date = String(r.entryDate || r.date || '');
    if (!side || entry == null || !ticker || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      warnings.push(`Skipped incomplete AI row: ${ticker || '?'} ${r.entryDate || ''}`);
      continue;
    }
    const strat = matchStrategy(r.strategy || r.setup, strategies);
    trades.push(finalizeTrade({
      ticker,
      direction: side,
      tradeType: r.tradeType === 'swing' ? 'swing' : 'intraday',
      entryPrice: entry,
      exitPrice: parseNum(r.exitPrice ?? r.exit),
      entryDate: date,
      exitDate: r.exitDate || date,
      entryTime: r.entryTime,
      exitTime: r.exitTime,
      qty: parseNum(r.qty ?? r.contracts),
      profitLoss: parseNum(r.profitLoss ?? r.pnl),
      strategy: strat.name,
      strategyId: strat.id,
      notes: r.notes || null,
      exitReason: r.exitReason || null,
      broker: r.broker || broker,
    }, broker));
  }

  return {
    trades,
    inferredBroker,
    defaultTicker: parsed.defaultTicker || null,
    sessionNotes: parsed.sessionNotes || null,
    parser: 'llm',
    warnings,
  };
}

export function pasteFingerprint(t: Pick<PasteTrade, 'broker' | 'entryDate' | 'entryTime' | 'ticker' | 'direction' | 'entryPrice' | 'qty'>): string {
  return [
    'paste',
    t.broker,
    t.entryDate,
    t.entryTime || '',
    t.ticker,
    t.direction,
    t.entryPrice,
    t.qty ?? '',
  ].join('-');
}
