/** Shared journal trade types (list + detail API) */

export interface Trade {
  id: string;
  ticker: string;
  direction: 'long' | 'short';
  tradeType: 'swing' | 'intraday';
  entryPrice: number;
  entryDate: string;
  exitPrice: number | null;
  exitDate: string | null;
  entryTime: string | null;
  exitTime: string | null;
  exit2Time?: string | null;
  exit2Price?: number | null;
  /** Adds and trims after the first entry and the first two exits. */
  fills?: { side: 'entry' | 'exit'; time: string; price: number }[] | null;
  amount: number;
  filledQty?: number | null;
  instrumentType?: string | null;
  strategy: string | null;
  strategies?: { id: string; name: string }[];
  notes: string | null;
  isOpen: boolean;
  exitReason: string | null;
  returnPct: number | null;
  rMultiple: number | null;
  holdingDays: number | null;
  profitLoss: number | null;
  maxPotentialR?: number | null;
  strategyId?: string | null;
  analysisReportId: string | null;
  source: string;
  broker: string;
  externalOrderId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OHLCBar {
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  /** Polygon aggregate window start (ms) */
  timestamp?: number;
}

/** Full row from GET /api/journal/[id] (Prisma JSON fields stay objects) */
export interface TradeDetail extends Trade {
  sector: string | null;
  industry: string | null;
  marketCap: number | null;
  floatShares: number | null;
  sharesOutstanding: number | null;
  shortPercent: number | null;
  avgVolume: number | null;
  beta: number | null;
  entryOHLC: OHLCBar | null;
  exitOHLC: OHLCBar | null;
  entryEMA9: number | null;
  entryEMA20: number | null;
  entryEMA50: number | null;
  entryRSI: number | null;
  entryATR: number | null;
  exitEMA9: number | null;
  exitEMA20: number | null;
  exitEMA50: number | null;
  exitRSI: number | null;
  exitATR: number | null;
  filledQty: number | null;
  avgFillPrice: number | null;
  orderType: string | null;
  instrumentType: string | null;
}
