/**
 * Import trades from TradeThePool master_journal.csv
 *
 * Usage:
 *   npx tsx scripts/import-tradethepool.ts [--dry-run] [--limit N] [path/to/master_journal.csv]
 *
 * Flags:
 *   --dry-run   Print what would be imported without saving
 *   --limit N   Only import the N most recent trades
 *
 * All trades imported as:
 *   - broker: "tradethepool-eval"
 *   - source: "manual"
 *   - tradeType: "intraday"
 *   - externalOrderId: "ttp-{trade_id}" (for deduplication)
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// ── Strategy mapping ──────────────────────────────────────────────
// Maps CSV setup_type patterns to app strategy names

// Direction-agnostic strategies
const STRATEGY_MAP: { pattern: RegExp; strategy: string }[] = [
  { pattern: /LOD[_\-]?A\s*v3|LOD reversal|LOD indicator|LOD-reversal|LOD reversal long|Setup A/i, strategy: 'LOD-A Reversal' },
  { pattern: /VWAP\s*(reversion|bounce|test|fade|support|reclaim)|D-shape range/i, strategy: 'VWAP Bounce' },
  { pattern: /breakout|breakdown/i, strategy: 'Breakout' },
  { pattern: /trend.day\s*pullback|pullback\s*long|continuation\s*long.*pullback/i, strategy: 'Bullish Flag Pullback 50%' },
  { pattern: /reversal(?!.*LOD)/i, strategy: 'Reversal' },
  { pattern: /flag|micro\s*pullback/i, strategy: 'Micro Pullback [Flag]' },
  { pattern: /Fixed\s*Range|volume\s*profile/i, strategy: 'Fixed Range Volume Profile' },
];

// Origin Zone / Reload is direction-specific
const ORIGIN_ZONE_PATTERN = /Reload|Origin\s*Zone|liquidity.*(zone|sweep)|The Reload/i;

function mapStrategy(setupType: string | undefined, side: string): string | null {
  if (!setupType || !setupType.trim()) return null;
  const s = setupType.trim();

  // Skip tier 4 / unprepared (no strategy)
  if (/unprepared|Tier\s*4/i.test(s)) return null;

  // Origin Zone - Reload: pick bullish/bearish based on trade direction
  if (ORIGIN_ZONE_PATTERN.test(s)) {
    return side === 'Buy' ? '[BULLISH] Origin Zone - Reload' : '[BEARISH] Origin Zone - Reload';
  }

  for (const { pattern, strategy } of STRATEGY_MAP) {
    if (pattern.test(s)) return strategy;
  }

  // No match - return null (trade will have no linked strategy)
  return null;
}

// ── CSV parsing ───────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

interface CSVTrade {
  trade_id: string;
  date: string;
  entry_time: string;
  exit_time: string;
  ticker: string;
  side: string;
  entry: number;
  exit: number;
  shares: number;
  fees: number;
  pnl: number;
  hold_minutes: number;
  result: string;
  week_number: string;
  profile_shape: string;
  setup_type: string;
  my_thesis: string;
  notes_on_execution: string;
  mentor_comment_on_entry: string;
  mentor_comment_on_exit: string;
  execution_diagnostic: string;
  setup_clean: string;
}

function parseRow(headers: string[], fields: string[]): CSVTrade {
  const row: any = {};
  for (let i = 0; i < headers.length; i++) {
    row[headers[i]] = fields[i] || '';
  }
  return {
    trade_id: row.trade_id,
    date: row.date,
    entry_time: row.entry_time,
    exit_time: row.exit_time,
    ticker: row.ticker,
    side: row.side,
    entry: parseFloat(row.entry) || 0,
    exit: parseFloat(row.exit) || 0,
    shares: parseFloat(row.shares) || 0,
    fees: parseFloat(row.fees) || 0,
    pnl: parseFloat(row.pnl) || 0,
    hold_minutes: parseInt(row.hold_minutes) || 0,
    result: row.result,
    week_number: row.week_number,
    profile_shape: row.profile_shape,
    setup_type: row.setup_type,
    my_thesis: row.my_thesis,
    notes_on_execution: row.notes_on_execution,
    mentor_comment_on_entry: row.mentor_comment_on_entry,
    mentor_comment_on_exit: row.mentor_comment_on_exit,
    execution_diagnostic: row.execution_diagnostic,
    setup_clean: row.setup_clean,
  };
}

// ── Build notes from CSV fields ───────────────────────────────────

function buildNotes(row: CSVTrade): string {
  const parts: string[] = [];

  if (row.setup_type) parts.push(`Setup: ${row.setup_type}`);
  if (row.my_thesis) parts.push(`Thesis: ${row.my_thesis}`);
  if (row.notes_on_execution) parts.push(`Execution: ${row.notes_on_execution}`);
  if (row.mentor_comment_on_entry) parts.push(`Mentor (entry): ${row.mentor_comment_on_entry}`);
  if (row.mentor_comment_on_exit) parts.push(`Mentor (exit): ${row.mentor_comment_on_exit}`);
  if (row.execution_diagnostic) parts.push(`Diagnostic: ${row.execution_diagnostic}`);
  if (row.profile_shape) parts.push(`Profile: ${row.profile_shape}`);
  if (row.setup_clean) parts.push(`Clean setup: ${row.setup_clean}`);
  if (row.week_number) parts.push(`Week: ${row.week_number}`);

  return parts.join('\n');
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : undefined;
  const csvPath = args.find(a => !a.startsWith('--') && (a !== args[limitIdx + 1])) 
    || path.join(process.env.HOME || '~', 'Downloads/master_journal.csv');

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found: ${csvPath}`);
    process.exit(1);
  }

  console.log(`Reading: ${csvPath}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE IMPORT'}`);
  if (limit) console.log(`Limit: ${limit} most recent trades`);

  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  const headers = parseCSVLine(lines[0]);

  let rows = lines.slice(1).map(line => parseRow(headers, parseCSVLine(line)));
  
  // Sort by date desc (most recent first) then take limit
  rows.sort((a, b) => {
    const da = a.date + ' ' + a.entry_time;
    const db = b.date + ' ' + b.entry_time;
    return db.localeCompare(da);
  });

  if (limit) {
    rows = rows.slice(0, limit);
  }

  console.log(`\nParsed ${rows.length} trades to import\n`);

  // Get user (assume single user for this script)
  const user = await prisma.user.findFirst();
  if (!user) {
    console.error('No user found in database');
    process.exit(1);
  }

  // Get strategy IDs for mapping
  const strategies = await prisma.strategy.findMany({
    where: { userId: user.id },
    select: { id: true, name: true },
  });
  const strategyByName = new Map(strategies.map(s => [s.name, s.id]));

  // Check existing external IDs for dedup
  const existingIds = new Set(
    (await prisma.tradeJournal.findMany({
      where: { userId: user.id, externalOrderId: { startsWith: 'ttp-' } },
      select: { externalOrderId: true },
    })).map(t => t.externalOrderId)
  );

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    const externalOrderId = `ttp-${row.trade_id}`;

    if (existingIds.has(externalOrderId)) {
      skipped++;
      if (dryRun) console.log(`  SKIP (exists): ${row.ticker} ${row.date} ${row.entry_time}`);
      continue;
    }

    const direction = row.side === 'Buy' ? 'long' : 'short';
    const strategyName = mapStrategy(row.setup_type, row.side);
    const strategyId = strategyName ? strategyByName.get(strategyName) || null : null;
    const amount = row.entry * row.shares;
    const returnPct = amount > 0 ? (row.pnl / amount) * 100 : 0;

    // Format times as HH:MM:SS
    const entryTime = row.entry_time ? (row.entry_time.length <= 5 ? row.entry_time + ':00' : row.entry_time) : null;
    const exitTime = row.exit_time ? (row.exit_time.length <= 5 ? row.exit_time + ':00' : row.exit_time) : null;

    // Exit reason: losses default to stopped_out, winners default to manual_exit
    // High return (>2%) winners likely hit_target
    let exitReason: string;
    if (row.pnl < 0) {
      exitReason = 'stopped_out';
    } else if (returnPct > 2) {
      exitReason = 'hit_target';
    } else {
      exitReason = 'manual_exit';
    }

    const tradeData = {
      userId: user.id,
      ticker: row.ticker.toUpperCase(),
      direction,
      tradeType: 'intraday' as const,
      entryPrice: row.entry,
      entryDate: new Date(row.date + 'T00:00:00.000Z'),
      exitPrice: row.exit,
      exitDate: new Date(row.date + 'T00:00:00.000Z'),
      entryTime,
      exitTime,
      amount,
      profitLoss: row.pnl,
      returnPct: Math.round(returnPct * 100) / 100,
      holdingDays: 0,
      isOpen: false,
      exitReason,
      source: 'manual',
      broker: 'tradethepool-eval',
      externalOrderId,
      strategy: strategyName,
      strategyId,
      notes: buildNotes(row),
    };

    if (dryRun) {
      console.log(`  IMPORT: ${row.ticker} ${row.side} ${row.date} ${row.entry_time}-${row.exit_time} $${row.entry}→$${row.exit} P/L:$${row.pnl} | Strategy: ${strategyName || '(none)'}`);
    } else {
      try {
        await prisma.tradeJournal.create({ data: tradeData });
        imported++;
      } catch (err: any) {
        console.error(`  ERROR importing ${row.ticker} ${row.date}: ${err.message}`);
        errors++;
      }
    }
  }

  console.log(`\n── Summary ──`);
  console.log(`  Total rows: ${rows.length}`);
  if (dryRun) {
    console.log(`  Would import: ${rows.length - skipped}`);
    console.log(`  Would skip (already exists): ${skipped}`);
  } else {
    console.log(`  Imported: ${imported}`);
    console.log(`  Skipped (already exists): ${skipped}`);
    console.log(`  Errors: ${errors}`);
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
