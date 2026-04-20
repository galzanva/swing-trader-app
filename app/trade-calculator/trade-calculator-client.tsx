'use client';

import { useState, useEffect, useRef } from 'react';
import HelpIcon from '@/app/components/help-icon';
import TradeCalculatorHelpModal from '@/app/components/trade-calculator-help-modal';

type CalculatorMode = 'risk-to-size' | 'budget-to-stop';

interface Preset {
  accountSize: number;
  riskPercent: number;
}

const DEFAULT_PRESET: Preset = { accountSize: 10000, riskPercent: 1 };

export default function TradeCalculatorClient() {
  // Same default on server + first client paint — localStorage is applied in useEffect to avoid hydration mismatch
  const [preset, setPreset] = useState<Preset>(DEFAULT_PRESET);

  // Inputs
  const [mode, setMode] = useState<CalculatorMode>('risk-to-size');
  const [entryPrice, setEntryPrice] = useState<string>('100');
  const [stopPrice, setStopPrice] = useState<string>('95');
  const [positionBudget, setPositionBudget] = useState<string>('500');
  const [rMultiple, setRMultiple] = useState<string>('2.0');
  const [taxRate, setTaxRate] = useState<string>('0');
  const [totalFees, setTotalFees] = useState<string>('0');
  const [tickSize, setTickSize] = useState<string>('0.01');
  const [roundShares, setRoundShares] = useState(true);
  
  // Help drawer state
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpSection, setHelpSection] = useState<string>('tick-size');

  // Validation errors
  const [errors, setErrors] = useState<string[]>([]);

  const skipPresetSaveRef = useRef(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('tradeCalcPreset');
      if (saved) {
        const p = JSON.parse(saved) as Preset;
        if (
          typeof p.accountSize === 'number' &&
          typeof p.riskPercent === 'number' &&
          Number.isFinite(p.accountSize) &&
          Number.isFinite(p.riskPercent)
        ) {
          setPreset({ accountSize: p.accountSize, riskPercent: p.riskPercent });
        }
      }
    } catch {
      /* keep default */
    }
  }, []);

  useEffect(() => {
    if (skipPresetSaveRef.current) {
      skipPresetSaveRef.current = false;
      return;
    }
    localStorage.setItem('tradeCalcPreset', JSON.stringify(preset));
  }, [preset]);

  // Parse inputs safely
  const parseNum = (str: string): number => {
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  };

  const entry = parseNum(entryPrice);
  const stop = parseNum(stopPrice);
  const budget = parseNum(positionBudget);
  const rMult = parseNum(rMultiple);
  const tax = parseNum(taxRate);
  const fees = parseNum(totalFees);
  const tick = parseNum(tickSize);

  // Calculate risk dollars
  const riskDollars = (preset.accountSize * preset.riskPercent) / 100;

  // Validate inputs
  useEffect(() => {
    const newErrors: string[] = [];

    if (entry <= 0) newErrors.push('Entry price must be > 0');
    if (mode === 'risk-to-size') {
      if (stop >= entry) newErrors.push('Stop must be below entry for longs');
      if (stop <= 0) newErrors.push('Stop price must be > 0');
    }
    if (mode === 'budget-to-stop') {
      if (budget <= 0) newErrors.push('Position budget must be > 0');
      if (budget < entry) newErrors.push('Budget must be ≥ entry price (at least 1 share)');
    }
    if (rMult < 0) newErrors.push('R multiple must be ≥ 0');
    if (tax < 0 || tax > 100) newErrors.push('Tax rate must be 0-100%');
    if (fees < 0) newErrors.push('Fees must be ≥ 0');
    if (tick <= 0) newErrors.push('Tick size must be > 0');

    setErrors(newErrors);
  }, [entry, stop, budget, mode, rMult, tax, fees, tick]);

  // Round to tick size
  const roundToTick = (price: number): number => {
    if (tick <= 0) return price;
    return Math.round(price / tick) * tick;
  };

  // Calculate results
  let shares = 0;
  let positionValue = 0;
  let computedStop = 0;
  let computedShares = 0;
  let takeProfitPrice = 0;
  let pctMoveToStop = 0;
  let pctMoveToTarget = 0;
  let grossPLAtStop = 0;
  let grossPLAtTarget = 0;
  let taxOnProfit = 0;
  let netPLAtStop = 0;
  let netPLAtTarget = 0;

  if (errors.length === 0 && entry > 0) {
    if (mode === 'risk-to-size') {
      // Risk→Size mode
      const riskPerShare = entry - stop;
      if (riskPerShare > 0) {
        shares = riskDollars / riskPerShare;
        if (roundShares) {
          shares = Math.floor(shares);
        }
        positionValue = shares * entry;
        computedShares = shares;

        // Take profit
        takeProfitPrice = roundToTick(entry + riskPerShare * rMult);

        // % moves
        pctMoveToStop = ((stop - entry) / entry) * 100;
        pctMoveToTarget = ((takeProfitPrice - entry) / entry) * 100;

        // P/L
        grossPLAtStop = shares * (stop - entry);
        grossPLAtTarget = shares * (takeProfitPrice - entry);

        // Tax (only on profits)
        if (grossPLAtTarget > 0) {
          taxOnProfit = (grossPLAtTarget * tax) / 100;
        }

        // Net P/L
        netPLAtStop = grossPLAtStop - fees;
        netPLAtTarget = grossPLAtTarget - taxOnProfit - fees;
      }
    } else {
      // Budget→Stop mode
      shares = budget / entry;
      if (roundShares) {
        shares = Math.floor(shares);
      }
      positionValue = shares * entry;

      // Compute stop price that matches risk dollars
      if (shares > 0) {
        const riskPerShare = riskDollars / shares;
        computedStop = roundToTick(entry - riskPerShare);
        
        // Take profit
        takeProfitPrice = roundToTick(entry + riskPerShare * rMult);

        // % moves
        pctMoveToStop = ((computedStop - entry) / entry) * 100;
        pctMoveToTarget = ((takeProfitPrice - entry) / entry) * 100;

        // P/L
        grossPLAtStop = shares * (computedStop - entry);
        grossPLAtTarget = shares * (takeProfitPrice - entry);

        // Tax (only on profits)
        if (grossPLAtTarget > 0) {
          taxOnProfit = (grossPLAtTarget * tax) / 100;
        }

        // Net P/L
        netPLAtStop = grossPLAtStop - fees;
        netPLAtTarget = grossPLAtTarget - taxOnProfit - fees;
      }
    }
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  const formatPercent = (val: number) => {
    return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
  };

  const formatShares = (val: number) => {
    return roundShares ? Math.floor(val).toString() : val.toFixed(2);
  };

  return (
    <>
      <div>
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-text-primary mb-2">Trade Risk Calculator</h1>
          <p className="text-text-secondary">
            Calculate position sizes, risk/reward, and profit/loss with precision
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Inputs */}
          <div className="space-y-6">
            {/* Preset Settings */}
            <div className="bg-surface-1 rounded-xl p-6 border border-border">
              <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center">
                Account Presets
                <HelpIcon
                  onClick={() => {
                    setHelpSection('presets');
                    setHelpOpen(true);
                  }}
                  tooltip="About account presets and auto-save"
                  className="ml-2"
                />
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Account Size
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">$</span>
                    <input
                      type="number"
                      value={preset.accountSize}
                      onChange={(e) => setPreset({ ...preset, accountSize: parseFloat(e.target.value) || 0 })}
                      className="w-full pl-8 pr-4 py-2 bg-surface-2 text-text-primary rounded-lg border border-border placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
                      step="100"
                      min="0"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Risk Per Trade (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={preset.riskPercent}
                      onChange={(e) => setPreset({ ...preset, riskPercent: parseFloat(e.target.value) || 0 })}
                      className="w-full pr-10 pl-4 py-2 bg-surface-2 text-text-primary rounded-lg border border-border placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
                      step="0.1"
                      min="0"
                      max="100"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">%</span>
                  </div>
                </div>
                <div className="p-3 bg-accent/10 border border-accent/30 rounded-lg">
                  <p className="text-sm text-text-secondary">
                    <span className="font-semibold">Risk Dollars:</span> {formatCurrency(riskDollars)}
                  </p>
                </div>
              </div>
            </div>

            {/* Mode Toggle */}
            <div className="bg-surface-1 rounded-xl p-6 border border-border">
              <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center">
                Calculator Mode
                <HelpIcon
                  onClick={() => {
                    setHelpSection('modes');
                    setHelpOpen(true);
                  }}
                  tooltip="How do calculator modes work?"
                  className="ml-2"
                />
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMode('risk-to-size')}
                  className={`py-3 px-4 rounded-lg font-medium transition-all ${
                    mode === 'risk-to-size'
                      ? 'bg-accent text-white'
                      : 'bg-surface-2 text-text-secondary border border-border hover:bg-surface-3'
                  }`}
                >
                  Risk→Size
                </button>
                <button
                  onClick={() => setMode('budget-to-stop')}
                  className={`py-3 px-4 rounded-lg font-medium transition-all ${
                    mode === 'budget-to-stop'
                      ? 'bg-accent text-white'
                      : 'bg-surface-2 text-text-secondary border border-border hover:bg-surface-3'
                  }`}
                >
                  Budget→Stop
                </button>
              </div>
              <p className="text-xs text-text-muted mt-3">
                {mode === 'risk-to-size'
                  ? 'Enter stop price → get position size'
                  : 'Enter position budget → get stop price'}
              </p>
            </div>

            {/* Trade Inputs */}
            <div className="bg-surface-1 rounded-xl p-6 border border-border">
              <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center">
                Trade Parameters
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Entry Price *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">$</span>
                    <input
                      type="number"
                      value={entryPrice}
                      onChange={(e) => setEntryPrice(e.target.value)}
                      className="w-full pl-8 pr-4 py-2 bg-surface-2 text-text-primary rounded-lg border border-border placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>

                {mode === 'risk-to-size' ? (
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      Stop Loss Price *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">$</span>
                      <input
                        type="number"
                        value={stopPrice}
                        onChange={(e) => setStopPrice(e.target.value)}
                        className="w-full pl-8 pr-4 py-2 bg-surface-2 text-text-primary rounded-lg border border-border placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
                        step="0.01"
                        min="0"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      Position Budget ($) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">$</span>
                      <input
                        type="number"
                        value={positionBudget}
                        onChange={(e) => setPositionBudget(e.target.value)}
                        className="w-full pl-8 pr-4 py-2 bg-surface-2 text-text-primary rounded-lg border border-border placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
                        step="10"
                        min="0"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    R Multiple Target (R:R Ratio)
                  </label>
                  <input
                    type="number"
                    value={rMultiple}
                    onChange={(e) => setRMultiple(e.target.value)}
                    className="w-full px-4 py-2 bg-surface-2 text-text-primary rounded-lg border border-border placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
                    step="0.1"
                    min="0"
                  />
                  <p className="text-xs text-text-muted mt-1">Default 2.0 = 1:2 risk/reward</p>
                </div>
              </div>
            </div>

            {/* Advanced Options */}
            <div className="bg-surface-1 rounded-xl p-6 border border-border">
              <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center">
                Advanced Options
                <HelpIcon
                  onClick={() => {
                    setHelpSection('advanced');
                    setHelpOpen(true);
                  }}
                  tooltip="Advanced options explained"
                  className="ml-2"
                />
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Tax Rate on Profits (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={taxRate}
                      onChange={(e) => setTaxRate(e.target.value)}
                      className="w-full pr-10 pl-4 py-2 bg-surface-2 text-text-primary rounded-lg border border-border placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
                      step="0.1"
                      min="0"
                      max="100"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">%</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Total Fees (Entry + Exit)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">$</span>
                    <input
                      type="number"
                      value={totalFees}
                      onChange={(e) => setTotalFees(e.target.value)}
                      className="w-full pl-8 pr-4 py-2 bg-surface-2 text-text-primary rounded-lg border border-border placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-text-secondary mb-2">
                    Tick Size
                    <HelpIcon
                      onClick={() => {
                        setHelpSection('tick-size');
                        setHelpOpen(true);
                      }}
                      tooltip="What is tick size? Click for detailed explanation"
                    />
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">$</span>
                    <input
                      type="number"
                      value={tickSize}
                      onChange={(e) => setTickSize(e.target.value)}
                      className="w-full pl-8 pr-4 py-2 bg-surface-2 text-text-primary rounded-lg border border-border placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
                      step="0.01"
                      min="0.01"
                    />
                  </div>
                  <p className="text-xs text-text-muted mt-1">Stop/TP rounded to this increment</p>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="roundShares"
                    checked={roundShares}
                    onChange={(e) => setRoundShares(e.target.checked)}
                    className="w-4 h-4 text-accent bg-surface-2 border-border rounded focus:ring-1 focus:ring-accent"
                  />
                  <label htmlFor="roundShares" className="ml-2 text-sm text-text-secondary">
                    Round shares to whole units
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Results */}
          <div className="space-y-6">
            {/* Validation Errors */}
            {errors.length > 0 && (
              <div className="bg-loss/10 border border-loss/30 rounded-xl p-4">
                <h3 className="text-loss font-semibold mb-2 flex items-center">
                  Validation Errors
                </h3>
                <ul className="space-y-1">
                  {errors.map((error, idx) => (
                    <li key={idx} className="text-sm text-loss">
                      • {error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Results Summary */}
            {errors.length === 0 && (
              <>
                {/* Position Details */}
                <div className="bg-surface-1 rounded-xl p-6 border border-border">
                  <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center">
                    Position Details
                  </h2>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-accent/10 rounded-lg">
                      <span className="text-text-secondary font-medium">Shares/Units:</span>
                      <span className="text-text-primary font-bold text-lg">{formatShares(shares)}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-surface-2 rounded-lg">
                      <span className="text-text-secondary">Position Value:</span>
                      <span className="text-text-primary font-semibold">{formatCurrency(positionValue)}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-surface-2 rounded-lg">
                      <span className="text-text-secondary">Entry Price:</span>
                      <span className="text-text-primary font-semibold">{formatCurrency(entry)}</span>
                    </div>
                    {mode === 'risk-to-size' ? (
                      <div className="flex justify-between items-center p-3 bg-loss/10 rounded-lg border border-loss/30">
                        <span className="text-loss">Stop Loss:</span>
                        <span className="text-loss font-semibold">{formatCurrency(stop)}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center p-3 bg-loss/10 rounded-lg border border-loss/30">
                        <span className="text-loss">Computed Stop:</span>
                        <span className="text-loss font-semibold">{formatCurrency(computedStop)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center p-3 bg-profit/10 rounded-lg border border-profit/30">
                      <span className="text-profit">Take Profit ({rMult}R):</span>
                      <span className="text-profit font-semibold">{formatCurrency(takeProfitPrice)}</span>
                    </div>
                  </div>
                </div>

                {/* Price Movements */}
                <div className="bg-surface-1 rounded-xl p-6 border border-border">
                  <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center">
                    Price Movements
                  </h2>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-surface-2 rounded-lg">
                      <span className="text-text-secondary">% Move to Stop:</span>
                      <span className={`font-semibold ${pctMoveToStop < 0 ? 'text-loss' : 'text-profit'}`}>
                        {formatPercent(pctMoveToStop)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-surface-2 rounded-lg">
                      <span className="text-text-secondary">% Move to Target:</span>
                      <span className={`font-semibold ${pctMoveToTarget > 0 ? 'text-profit' : 'text-loss'}`}>
                        {formatPercent(pctMoveToTarget)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Profit & Loss */}
                <div className="bg-surface-1 rounded-xl p-6 border border-border">
                  <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center">
                    Profit & Loss
                  </h2>
                  <div className="space-y-4">
                    {/* At Stop */}
                    <div>
                      <h3 className="text-sm font-semibold text-loss mb-2">If Stopped Out:</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center p-2 bg-surface-2 rounded text-sm">
                          <span className="text-text-secondary">Gross P/L:</span>
                          <span className={`font-semibold ${grossPLAtStop < 0 ? 'text-loss' : 'text-profit'}`}>
                            {formatCurrency(grossPLAtStop)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-surface-2 rounded text-sm">
                          <span className="text-text-secondary">Fees:</span>
                          <span className="text-text-primary">-{formatCurrency(fees)}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-loss/10 rounded-lg border border-loss/30">
                          <span className="text-loss font-semibold">Net P/L:</span>
                          <span className="text-loss font-bold text-lg">{formatCurrency(netPLAtStop)}</span>
                        </div>
                      </div>
                    </div>

                    {/* At Target */}
                    <div>
                      <h3 className="text-sm font-semibold text-profit mb-2">If Target Hit:</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center p-2 bg-surface-2 rounded text-sm">
                          <span className="text-text-secondary">Gross P/L:</span>
                          <span className={`font-semibold ${grossPLAtTarget < 0 ? 'text-loss' : 'text-profit'}`}>
                            {formatCurrency(grossPLAtTarget)}
                          </span>
                        </div>
                        {taxOnProfit > 0 && (
                          <div className="flex justify-between items-center p-2 bg-surface-2 rounded text-sm">
                            <span className="text-text-secondary">Tax ({tax}%):</span>
                            <span className="text-text-primary">-{formatCurrency(taxOnProfit)}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center p-2 bg-surface-2 rounded text-sm">
                          <span className="text-text-secondary">Fees:</span>
                          <span className="text-text-primary">-{formatCurrency(fees)}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-profit/10 rounded-lg border border-profit/30">
                          <span className="text-profit font-semibold">Net Profit:</span>
                          <span className="text-profit font-bold text-lg">{formatCurrency(netPLAtTarget)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Risk/Reward Summary */}
                    <div className="p-4 bg-surface-2 border border-border rounded-lg">
                      <div className="text-sm text-text-secondary space-y-1">
                        <p>
                          <span className="font-semibold">Risk:</span> {formatCurrency(Math.abs(netPLAtStop))} ({formatPercent(Math.abs(pctMoveToStop))})
                        </p>
                        <p>
                          <span className="font-semibold">Reward:</span> {formatCurrency(netPLAtTarget)} ({formatPercent(pctMoveToTarget)})
                        </p>
                        <p className="pt-2 border-t border-border">
                          <span className="font-semibold">R:R Ratio:</span> 1:{rMult} (actual: 1:{(netPLAtTarget / Math.abs(netPLAtStop)).toFixed(2)})
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Tips */}
                <div className="bg-surface-2 border border-border rounded-xl p-4">
                  <h3 className="text-text-secondary font-semibold mb-2 flex items-center">
                    Quick Tips
                  </h3>
                  <ul className="text-sm text-text-secondary space-y-1">
                    <li>• Risk per trade: {formatCurrency(riskDollars)} ({preset.riskPercent}% of account)</li>
                    <li>• Presets are saved automatically across sessions</li>
                    <li>• Tax is only applied to profits, not losses</li>
                    <li>• Fees are always deducted from final P/L</li>
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Help Modal */}
      <TradeCalculatorHelpModal
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        section={helpSection as any}
      />
    </>
  );
}
