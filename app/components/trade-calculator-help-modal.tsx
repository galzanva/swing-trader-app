'use client';

import { useState, useEffect } from 'react';

interface TradeCalculatorHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  section?: 'overview' | 'modes' | 'tick-size' | 'presets' | 'advanced' | 'examples';
}

export default function TradeCalculatorHelpModal({ isOpen, onClose, section = 'overview' }: TradeCalculatorHelpModalProps) {
  const [activeTab, setActiveTab] = useState(section);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(section);
    }
  }, [isOpen, section]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-[100] transition-opacity"
        onClick={onClose}
      />
      
      {/* Drawer — outer shell avoids transform+fixed gap at top */}
      <div className="fixed inset-0 z-[101] flex justify-end pointer-events-none">
        <div className="pointer-events-auto h-full w-full sm:max-w-3xl xl:max-w-[56rem] bg-surface-1 shadow-2xl flex flex-col animate-slide-in sm:border-l border-border">
        {/* Header */}
        <div className="bg-surface-2 border-b border-border p-6 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-text-primary mb-1">Trade Calculator Guide</h2>
            <p className="text-text-secondary text-sm">Complete reference for risk calculation, position sizing, and examples</p>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors p-2 hover:bg-surface-3 rounded-lg"
            title="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-6 pt-4 pb-2 border-b border-border overflow-x-auto shrink-0 bg-surface-1">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'modes', label: 'Calculator Modes' },
            { id: 'tick-size', label: 'Tick Size' },
            { id: 'presets', label: 'Presets' },
            { id: 'advanced', label: 'Advanced' },
            { id: 'examples', label: 'Examples' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-accent text-white'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-2'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && <OverviewHelp />}
          {activeTab === 'modes' && <ModesHelp />}
          {activeTab === 'tick-size' && <TickSizeHelp />}
          {activeTab === 'presets' && <PresetsHelp />}
          {activeTab === 'advanced' && <AdvancedHelp />}
          {activeTab === 'examples' && <ExamplesHelp />}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-surface-1 shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg transition-all"
          >
            Got it!
          </button>
        </div>
      </div>
      </div>
    </>
  );
}

// Overview Help Section
function OverviewHelp() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-text-primary mb-3">Trade Risk Calculator</h3>
        <p className="text-text-secondary leading-relaxed">
          Calculate precise position sizes, stop losses, and profit targets based on your risk parameters. 
          This tool helps you maintain consistent risk management across all trades.
        </p>
      </div>

      <div className="bg-surface-2 border border-border rounded-lg p-4">
        <h4 className="text-text-secondary font-semibold mb-2">Key Features:</h4>
        <ul className="space-y-2 text-text-secondary text-sm">
          <li>Two calculation modes: Risk→Size and Budget→Stop</li>
          <li>Automatic position sizing based on account risk %</li>
          <li>R multiple target calculation (risk/reward ratios)</li>
          <li>Tax and fee calculations</li>
          <li>Tick size rounding for valid order prices</li>
          <li>Saved presets that persist across sessions</li>
        </ul>
      </div>

      <div>
        <h4 className="text-lg font-semibold text-text-primary mb-2">How It Works</h4>
        <ol className="space-y-3 text-text-secondary text-sm">
          <li><strong className="text-text-primary">1. Set Your Presets:</strong> Enter account size and risk per trade %</li>
          <li><strong className="text-text-primary">2. Choose Mode:</strong> Pick Risk→Size or Budget→Stop</li>
          <li><strong className="text-text-primary">3. Enter Trade Details:</strong> Entry price, stop/budget, R multiple</li>
          <li><strong className="text-text-primary">4. View Results:</strong> See position size, P/L at stop & target, risk/reward</li>
        </ol>
      </div>
    </div>
  );
}

// Modes Help Section
function ModesHelp() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-text-primary mb-3">Calculator Modes</h3>
        <p className="text-text-secondary leading-relaxed">
          Choose the mode that matches your trading workflow. Each mode calculates different outputs based on your inputs.
        </p>
      </div>

      <div className="bg-surface-2 border border-border rounded-lg p-4">
        <h4 className="text-text-primary font-semibold mb-3 flex items-center">
          <span className="mr-2">→</span> Risk→Size Mode
        </h4>
        <p className="text-text-secondary text-sm mb-3">
          <strong className="text-text-primary">When to use:</strong> You know your entry and stop loss prices, and want to calculate how many shares to buy.
        </p>
        <div className="bg-surface-3 rounded p-3 mb-3">
          <p className="text-xs text-text-secondary mb-2"><strong>Inputs:</strong></p>
          <ul className="text-xs text-text-secondary space-y-1 ml-4">
            <li>• Entry Price</li>
            <li>• Stop Loss Price</li>
          </ul>
          <p className="text-xs text-text-secondary mt-3 mb-2"><strong>Outputs:</strong></p>
          <ul className="text-xs text-text-secondary space-y-1 ml-4">
            <li>• Number of shares to buy</li>
            <li>• Total position value</li>
          </ul>
        </div>
        <div className="bg-profit/10 border border-profit/30 rounded p-3">
          <p className="text-xs text-profit"><strong>Example:</strong> Entry $100, Stop $95 → Risk $5/share → Buy 20 shares to risk $100</p>
        </div>
      </div>

      <div className="bg-surface-2 border border-border rounded-lg p-4">
        <h4 className="text-text-primary font-semibold mb-3 flex items-center">
          <span className="mr-2">→</span> Budget→Stop Mode
        </h4>
        <p className="text-text-secondary text-sm mb-3">
          <strong className="text-text-primary">When to use:</strong> You have a fixed dollar budget and want to know what stop price matches your risk %.
        </p>
        <div className="bg-surface-3 rounded p-3 mb-3">
          <p className="text-xs text-text-secondary mb-2"><strong>Inputs:</strong></p>
          <ul className="text-xs text-text-secondary space-y-1 ml-4">
            <li>• Entry Price</li>
            <li>• Position Budget ($)</li>
          </ul>
          <p className="text-xs text-text-secondary mt-3 mb-2"><strong>Outputs:</strong></p>
          <ul className="text-xs text-text-secondary space-y-1 ml-4">
            <li>• Computed stop loss price</li>
            <li>• Number of shares (based on budget)</li>
          </ul>
        </div>
        <div className="bg-profit/10 border border-profit/30 rounded p-3">
          <p className="text-xs text-profit"><strong>Example:</strong> Entry $100, Budget $500 → 5 shares → Stop computed to $80 to match $100 risk</p>
        </div>
      </div>
    </div>
  );
}

// Tick Size Help Section
function TickSizeHelp() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-text-primary mb-3">Tick Size</h3>
        <p className="text-text-secondary leading-relaxed">
          Tick size is the <strong className="text-text-primary">minimum price increment</strong> that your broker/exchange allows for orders.
          The calculator automatically rounds computed stop loss and take profit prices to valid price levels.
        </p>
      </div>

      <div className="bg-loss/10 border border-loss/30 rounded-lg p-4">
        <h4 className="text-loss font-semibold mb-2">Why This Matters</h4>
        <p className="text-text-secondary text-sm">
          If the calculator computes a stop at <strong>$94.987</strong>, you can't place that order! 
          Orders must be at valid price increments. The calculator automatically rounds to the nearest valid price.
        </p>
      </div>

      <div>
        <h4 className="text-lg font-semibold text-text-primary mb-3">Common Tick Sizes</h4>
        <div className="space-y-3">
          <div className="bg-surface-2 rounded-lg p-3">
            <p className="text-text-primary font-medium mb-1">Stocks</p>
            <p className="text-text-secondary text-sm">$0.01 (1 cent) - Most common</p>
            <p className="text-text-muted text-xs mt-1">Example: $100.00, $100.01, $100.02</p>
          </div>
          <div className="bg-surface-2 rounded-lg p-3">
            <p className="text-text-primary font-medium mb-1">Options</p>
            <p className="text-text-secondary text-sm">$0.05 or $0.10 increments</p>
            <p className="text-text-muted text-xs mt-1">Example: $5.00, $5.05, $5.10 (for $0.05 tick)</p>
          </div>
          <div className="bg-surface-2 rounded-lg p-3">
            <p className="text-text-primary font-medium mb-1">Futures</p>
            <p className="text-text-secondary text-sm">$0.25, $0.50, or other increments</p>
            <p className="text-text-muted text-xs mt-1">Example: $100.00, $100.25, $100.50 (for $0.25 tick)</p>
          </div>
          <div className="bg-surface-2 rounded-lg p-3">
            <p className="text-text-primary font-medium mb-1">Forex</p>
            <p className="text-text-secondary text-sm">$0.0001 (4 decimal places)</p>
            <p className="text-text-muted text-xs mt-1">Example: 1.1234, 1.1235, 1.1236</p>
          </div>
        </div>
      </div>

      <div className="bg-surface-2 border border-border rounded-lg p-4">
        <h4 className="text-text-primary font-semibold mb-2">How Rounding Works</h4>
        <div className="space-y-2 text-sm text-text-secondary">
          <p><strong className="text-text-primary">Calculated Price:</strong> $105.347</p>
          <p><strong className="text-text-primary">Tick Size:</strong> $0.01</p>
          <p><strong className="text-text-primary">Rounded Price:</strong> $105.35</p>
          <p className="text-xs text-text-muted mt-2">Formula: Math.round(price / tick) × tick</p>
        </div>
      </div>

      <div>
        <h4 className="text-lg font-semibold text-text-primary mb-2">What Gets Rounded</h4>
        <ul className="space-y-2 text-text-secondary text-sm">
          <li><strong className="text-text-primary">Computed Stop Loss</strong> (Budget→Stop mode)</li>
          <li><strong className="text-text-primary">Take Profit Price</strong> (all modes)</li>
          <li>Entry price is NOT rounded (you enter it manually)</li>
          <li>Stop price in Risk→Size mode is NOT rounded (you enter it manually)</li>
        </ul>
      </div>
    </div>
  );
}

// Presets Help Section
function PresetsHelp() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-text-primary mb-3">Account Presets</h3>
        <p className="text-text-secondary leading-relaxed">
          Save your account size and risk percentage. These values are automatically saved and persist across browser sessions.
        </p>
      </div>

      <div className="bg-surface-2 rounded-lg p-4">
        <h4 className="text-text-primary font-semibold mb-3">Account Size</h4>
        <p className="text-text-secondary text-sm mb-3">
          Your total trading capital. This is used to calculate risk dollars.
        </p>
        <div className="bg-surface-3 rounded p-3">
          <p className="text-xs text-text-secondary">
            <strong>Example:</strong> $10,000 account × 1% risk = $100 risk per trade
          </p>
        </div>
      </div>

      <div className="bg-surface-2 rounded-lg p-4">
        <h4 className="text-text-primary font-semibold mb-3">Risk Per Trade (%)</h4>
        <p className="text-text-secondary text-sm mb-3">
          The percentage of your account you're willing to risk on a single trade. Most traders use 1-2%.
        </p>
        <div className="space-y-2 text-sm text-text-secondary">
          <div className="bg-surface-3 rounded p-2">
            <p><strong className="text-text-primary">Conservative:</strong> 0.5% - Lower risk, smaller positions</p>
          </div>
          <div className="bg-surface-3 rounded p-2">
            <p><strong className="text-text-primary">Standard:</strong> 1% - Most common, balanced approach</p>
          </div>
          <div className="bg-surface-3 rounded p-2">
            <p><strong className="text-text-primary">Aggressive:</strong> 2% - Higher risk, larger positions</p>
          </div>
        </div>
      </div>

      <div className="bg-surface-2 border border-border rounded-lg p-4">
        <h4 className="text-text-primary font-semibold mb-2">Auto-Save</h4>
        <p className="text-text-secondary text-sm">
          Your presets are automatically saved to your browser's localStorage. They'll be there the next time you visit the calculator!
        </p>
      </div>
    </div>
  );
}

// Advanced Help Section
function AdvancedHelp() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-text-primary mb-3">Advanced Options</h3>
        <p className="text-text-secondary leading-relaxed">
          Fine-tune your calculations with tax, fees, and share rounding options.
        </p>
      </div>

      <div className="bg-surface-2 rounded-lg p-4">
        <h4 className="text-text-primary font-semibold mb-2">R Multiple Target</h4>
        <p className="text-text-secondary text-sm mb-2">
          Risk/Reward ratio. Default is 2.0 (1:2), meaning for every $1 risked, you target $2 profit.
        </p>
        <div className="bg-surface-3 rounded p-3 text-sm text-text-secondary">
          <p><strong className="text-text-primary">1.5:</strong> Conservative (1:1.5 R:R)</p>
          <p><strong className="text-text-primary">2.0:</strong> Standard (1:2 R:R) - Default</p>
          <p><strong className="text-text-primary">3.0:</strong> Aggressive (1:3 R:R)</p>
        </div>
      </div>

      <div className="bg-surface-2 rounded-lg p-4">
        <h4 className="text-text-primary font-semibold mb-2">Tax Rate on Profits (%)</h4>
        <p className="text-text-secondary text-sm mb-2">
          Your tax rate for capital gains. <strong className="text-loss">Only applied to profits, not losses.</strong>
        </p>
        <div className="bg-surface-3 rounded p-3 text-sm text-text-secondary">
          <p><strong className="text-text-primary">Short-term:</strong> Typically 10-37% (held {'<'} 1 year)</p>
          <p><strong className="text-text-primary">Long-term:</strong> Typically 0-20% (held {'>'} 1 year)</p>
          <p className="text-xs text-text-muted mt-2">Check your local tax regulations</p>
        </div>
      </div>

      <div className="bg-surface-2 rounded-lg p-4">
        <h4 className="text-text-primary font-semibold mb-2">Total Fees</h4>
        <p className="text-text-secondary text-sm">
          Combined entry + exit fees (commissions, spreads, etc.). Always deducted from final P/L.
        </p>
      </div>

      <div className="bg-surface-2 rounded-lg p-4">
        <h4 className="text-text-primary font-semibold mb-2">Round Shares to Whole Units</h4>
        <p className="text-text-secondary text-sm">
          When enabled, shares are rounded down to whole numbers (e.g., 19.7 → 19). 
          When disabled, fractional shares are shown (if supported by your broker).
        </p>
      </div>
    </div>
  );
}

// Examples Help Section
function ExamplesHelp() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-text-primary mb-3">Real-World Examples</h3>
        <p className="text-text-secondary leading-relaxed">
          See how the calculator works with actual trading scenarios.
        </p>
      </div>

      <div className="bg-surface-2 border border-border rounded-lg p-4">
        <h4 className="text-text-primary font-semibold mb-3">Example 1: Risk→Size Mode</h4>
        <div className="bg-surface-3 rounded p-3 space-y-2 text-sm">
          <p className="text-text-secondary"><strong className="text-text-primary">Setup:</strong></p>
          <ul className="text-text-secondary space-y-1 ml-4">
            <li>Account: $10,000</li>
            <li>Risk: 1% = $100</li>
            <li>Entry: $100</li>
            <li>Stop: $95 (risk $5/share)</li>
            <li>R Multiple: 2.0</li>
          </ul>
          <p className="text-text-secondary mt-3"><strong className="text-text-primary">Results:</strong></p>
          <ul className="text-profit space-y-1 ml-4">
            <li>Shares: 20 ($100 risk ÷ $5 risk/share)</li>
            <li>Position Value: $2,000</li>
            <li>Take Profit: $110 ($100 + $5×2)</li>
            <li>Profit if TP hit: $200 (20 shares × $10)</li>
          </ul>
        </div>
      </div>

      <div className="bg-surface-2 border border-border rounded-lg p-4">
        <h4 className="text-text-primary font-semibold mb-3">Example 2: Budget→Stop Mode</h4>
        <div className="bg-surface-3 rounded p-3 space-y-2 text-sm">
          <p className="text-text-secondary"><strong className="text-text-primary">Setup:</strong></p>
          <ul className="text-text-secondary space-y-1 ml-4">
            <li>Account: $10,000</li>
            <li>Risk: 1% = $100</li>
            <li>Entry: $100</li>
            <li>Budget: $500</li>
            <li>R Multiple: 2.0</li>
          </ul>
          <p className="text-text-secondary mt-3"><strong className="text-text-primary">Results:</strong></p>
          <ul className="text-profit space-y-1 ml-4">
            <li>Shares: 5 ($500 ÷ $100 entry)</li>
            <li>Computed Stop: $80 ($100 - $20 risk/share)</li>
            <li>Take Profit: $140 ($100 + $20×2)</li>
            <li>Profit if TP hit: $200 (5 shares × $40)</li>
          </ul>
        </div>
      </div>

      <div className="bg-surface-2 border border-border rounded-lg p-4">
        <h4 className="text-text-primary font-semibold mb-3">Example 3: With Tax & Fees</h4>
        <div className="bg-surface-3 rounded p-3 space-y-2 text-sm">
          <p className="text-text-secondary"><strong className="text-text-primary">Setup:</strong></p>
          <ul className="text-text-secondary space-y-1 ml-4">
            <li>Same as Example 1</li>
            <li>Tax Rate: 15% (long-term capital gains)</li>
            <li>Total Fees: $5 (entry + exit)</li>
          </ul>
          <p className="text-text-secondary mt-3"><strong className="text-text-primary">Results:</strong></p>
          <ul className="text-profit space-y-1 ml-4">
            <li>Gross Profit: $200</li>
            <li>Tax (15%): -$30</li>
            <li>Fees: -$5</li>
            <li><strong className="text-text-primary">Net Profit: $165</strong></li>
          </ul>
        </div>
      </div>

      <div className="bg-surface-2 border border-border rounded-lg p-4">
        <h4 className="text-text-primary font-semibold mb-2">Pro Tips</h4>
        <ul className="space-y-2 text-text-secondary text-sm">
          <li>• Always verify calculated stop prices are valid for your broker</li>
          <li>• Include all fees (entry + exit) for accurate net P/L</li>
          <li>• Use tick size appropriate for your instrument</li>
          <li>• Round shares to whole units unless fractional shares are supported</li>
          <li>• Consider tax implications when planning trade exits</li>
        </ul>
      </div>
    </div>
  );
}
