
# Product Overview

## Objective
Build an AI Swing Trading Advisor that:
- Scans a sampled universe and returns the best setups (no charts drawn).
- Generates a full, evidence-backed report for any requested ticker.
- Uses deterministic technical calculations; AI only explains the results.

## Core Entities
- **User**: authenticated user with saved presets, favorites, and run history.
- **ScanPreset**: saved scanner configuration (universe, filters, patterns).
- **ScanRun**: a single scanner execution and metadata.
- **ScanResult**: one setup card returned by a ScanRun.
- **AnalysisReport**: an on-demand, single-ticker deep analysis output.

## Data Inputs
- OHLCV per symbol/timeframe (~300–500 bars).
- Earnings calendar and basic fundamentals (market cap).
- Optional news sentiment later (not required for MVP).

## Outputs
- Setup Cards with: entry/stop/targets, R:R, facts, probabilities, mentor notes.
- Reports with: overview, technical state, risk plan, probabilities & horizon, risks, and reason trace.

## Principles
- Transparency over hype; show the rules that fired.
- Facts-only AI explanations.
- Fresh data via vendor APIs; no in-app charting in MVP.

## Roadmap
- **v1**: Scanner + Deep Analysis; cohort probabilities; saved presets.
- **v1.1**: Paper trading; favorites; simple alerts.
- **v1.2**: Sector/industry filters; broader universes.
- **v2**: Background workers for heavy cohorts/backtests; charts; advanced risk analytics.

## Design Vision:

- Deep navy and teal color scheme (trust + technology)
- Card-based layout for trade setups
- Clean data visualization
- Subtle gradients and professional animations
- Dashboard-style interface with filters