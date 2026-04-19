/**
 * Shared market data types used across technical analysis and data vendors.
 * Extracted from strategy types for cleaner dependencies.
 */

export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
