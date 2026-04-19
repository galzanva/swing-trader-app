'use client';

import { useState, useEffect } from 'react';

interface PatternExplanationHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  section?: 'overview' | 'composite' | 'chart-metrics' | 'candlestick' | 'how-used';
}

export default function PatternExplanationHelpModal({ isOpen, onClose, section = 'overview' }: PatternExplanationHelpModalProps) {
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
      
      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-[101] w-full sm:max-w-2xl bg-surface-1 shadow-2xl flex flex-col animate-slide-in sm:border-l border-border">
        {/* Header */}
        <div className="bg-surface-2 border-b border-border p-6 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-text-primary mb-1">Pattern Detection Explainability</h2>
            <p className="text-text-secondary text-sm">Complete guide to metrics, calculations, and how they're used</p>
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
            { id: 'composite', label: 'Composite Score' },
            { id: 'chart-metrics', label: 'Chart Metrics' },
            { id: 'candlestick', label: 'Candlestick' },
            { id: 'how-used', label: 'How Used' },
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
          {activeTab === 'composite' && <CompositeHelp />}
          {activeTab === 'chart-metrics' && <ChartMetricsHelp />}
          {activeTab === 'candlestick' && <CandlestickHelp />}
          {activeTab === 'how-used' && <HowUsedHelp />}
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
    </>
  );
}

// Overview Help Section
function OverviewHelp() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-text-primary mb-3">Pattern Detection V2 - Explainability</h3>
        <p className="text-text-secondary leading-relaxed">
          The Pattern Detection V2 system uses <strong className="text-text-primary">deterministic, rule-based analysis</strong> with full transparency. 
          Unlike black-box algorithms, every confidence score, metric, and decision can be traced back to explicit mathematical rules.
        </p>
      </div>

      <div>
        <h4 className="text-lg font-semibold text-text-primary mb-2">What This Section Shows</h4>
        <ul className="space-y-2 text-text-secondary">
          <li className="flex items-start">
            <span className="text-accent mr-2">•</span>
            <span><strong className="text-text-primary">Composite Score Breakdown:</strong> How the final pattern confidence score (0-95) is calculated from chart patterns, candlestick patterns, and bonuses/penalties.</span>
          </li>
          <li className="flex items-start">
            <span className="text-profit mr-2">•</span>
            <span><strong className="text-text-primary">Chart Pattern Facts:</strong> The specific validation criteria (symmetry, separation, height, touches) that determine if a pattern qualifies as "Institutional" (tradeable) or "Candidate" (watching).</span>
          </li>
          <li className="flex items-start">
            <span className="text-text-secondary mr-2">•</span>
            <span><strong className="text-text-primary">Chart Pattern Metrics:</strong> Raw numerical measurements (symmetry %, height in ATR multiples, total touches, volume Z-score, etc.) used in pattern validation.</span>
          </li>
          <li className="flex items-start">
            <span className="text-text-muted mr-2">•</span>
            <span><strong className="text-text-primary">Candlestick Facts:</strong> Measurements of the most recent candlestick (body %, wicks, engulfment, volume) used for entry timing.</span>
          </li>
        </ul>
      </div>

      <div className="bg-surface-2 border border-border rounded-lg p-4">
        <h4 className="text-text-secondary font-semibold mb-2">Key Concept</h4>
        <p className="text-text-secondary text-sm leading-relaxed">
          All patterns are evaluated against <strong className="text-text-primary">strict institutional-grade criteria</strong>. 
          Patterns that meet all criteria are marked as "Institutional" (tradeable). Patterns that are close but missing some criteria are marked as "Candidate" (watch for confirmation). 
          Patterns with extreme violations are "Discarded" (excluded from scoring).
        </p>
      </div>
    </div>
  );
}

// Composite Score Help Section
function CompositeHelp() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-text-primary mb-3">Composite Score Breakdown</h3>
        <p className="text-text-secondary leading-relaxed">
          The <strong className="text-text-primary">Composite Score</strong> is the final confidence rating (0-95) that combines chart pattern structure with candlestick entry timing.
        </p>
      </div>

      <div>
        <h4 className="text-lg font-semibold text-text-primary mb-2">How It's Calculated</h4>
        
        <div className="bg-surface-2 border border-border rounded-lg p-4 mb-4">
          <h5 className="text-accent font-semibold mb-2">When Institutional Pattern Exists:</h5>
          <p className="text-text-secondary text-sm mb-2">Composite = (60% × Chart Score) + (40% × Candlestick Score) + Bonuses - Penalties</p>
          <ul className="text-text-secondary text-sm space-y-1 ml-4 list-disc">
            <li><strong className="text-text-primary">Chart Weight:</strong> 60% (structure is primary)</li>
            <li><strong className="text-text-primary">Candlestick Weight:</strong> 40% (timing confirmation)</li>
            <li><strong className="text-text-primary">Alignment Bonus:</strong> +15 when chart and candle direction match</li>
            <li><strong className="text-text-primary">Breakout Bonus:</strong> +5 (pending), +15 (confirmed), +20 (retest)</li>
            <li><strong className="text-text-primary">Volume Bonus:</strong> +5 for flags/triangles (volZ ≥1.0) or doubles (volZ ≥1.2)</li>
            <li><strong className="text-text-primary">Opposition Penalty:</strong> -10 when chart and candle conflict</li>
          </ul>
        </div>

        <div className="bg-surface-2 border border-border rounded-lg p-4 mb-4">
          <h5 className="text-text-secondary font-semibold mb-2">When Only Candidate Pattern:</h5>
          <p className="text-text-secondary text-sm mb-2">Composite = Candlestick Score, capped at 65</p>
          <p className="text-text-secondary text-sm">
            Candidates lack full institutional validation, so the score is limited to 65/100 until confirmation.
          </p>
        </div>

        <div className="bg-surface-2 border border-border rounded-lg p-4">
          <h5 className="text-text-muted font-semibold mb-2">When No Structure Pattern:</h5>
          <p className="text-text-secondary text-sm mb-2">Composite = Candlestick Score, capped at 55</p>
          <p className="text-text-secondary text-sm">
            Without chart structure, the score reflects only candlestick timing and is capped at 55/100 (wait for setup).
          </p>
        </div>
      </div>

      <div className="bg-surface-2 border border-border rounded-lg p-4">
        <h4 className="text-text-secondary font-semibold mb-2">Final Cap</h4>
        <p className="text-text-secondary text-sm">
          All composite scores are capped at <strong className="text-text-primary">95/100</strong> for realism (nothing is 100% certain in trading).
        </p>
      </div>
    </div>
  );
}

// Chart Metrics Help Section
function ChartMetricsHelp() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-text-primary mb-3">Chart Pattern Metrics</h3>
        <p className="text-text-secondary leading-relaxed">
          These are the <strong className="text-text-primary">raw measurements</strong> used to validate chart patterns. 
          Each metric is compared against institutional-grade thresholds to determine if a pattern is tradeable.
        </p>
      </div>

      <div className="space-y-4">
        <div className="bg-surface-2 border border-border rounded-lg p-4">
          <h4 className="text-profit font-semibold mb-2">Symmetry (%)</h4>
          <p className="text-text-secondary text-sm mb-2">
            <strong className="text-text-primary">What it is:</strong> How closely the two peaks (double top) or two troughs (double bottom) match in price.
          </p>
          <p className="text-text-secondary text-sm mb-2">
            <strong className="text-text-primary">Calculation:</strong> |Peak1 - Peak2| / Peak1 × 100
          </p>
          <p className="text-text-secondary text-sm mb-2">
            <strong className="text-text-primary">Institutional Threshold:</strong> ≤2.0% (peaks/troughs must be very close)
          </p>
          <p className="text-text-secondary text-sm">
            <strong className="text-text-primary">Example:</strong> If Peak 1 = $100 and Peak 2 = $98, Symmetry = |100-98|/100 × 100 = 2.0%
          </p>
        </div>

        <div className="bg-surface-2 border border-border rounded-lg p-4">
          <h4 className="text-text-secondary font-semibold mb-2">Separation (bars)</h4>
          <p className="text-text-secondary text-sm mb-2">
            <strong className="text-text-primary">What it is:</strong> The number of bars (candles) between the two peaks or troughs.
          </p>
          <p className="text-text-secondary text-sm mb-2">
            <strong className="text-text-primary">Institutional Threshold:</strong> ≥10 bars (patterns need time to develop)
          </p>
          <p className="text-text-secondary text-sm">
            <strong className="text-text-primary">Why it matters:</strong> Patterns that form too quickly ({'<'}10 bars) are less reliable. Institutional-grade patterns need sufficient time to establish structure.
          </p>
        </div>

        <div className="bg-surface-2 border border-border rounded-lg p-4">
          <h4 className="text-text-secondary font-semibold mb-2">Height (ATR)</h4>
          <p className="text-text-secondary text-sm mb-2">
            <strong className="text-text-primary">What it is:</strong> The pattern's height measured in multiples of ATR (Average True Range).
          </p>
          <p className="text-text-secondary text-sm mb-2">
            <strong className="text-text-primary">Calculation:</strong> (Peak Average - Neckline) / ATR (for double tops)
          </p>
          <p className="text-text-secondary text-sm mb-2">
            <strong className="text-text-primary">Institutional Threshold:</strong> ≥1.0× ATR (pattern must be significant relative to volatility)
          </p>
          <p className="text-text-secondary text-sm mb-2">
            <strong className="text-text-primary">Example:</strong> If Peak = $110, Neckline = $100, ATR = $5, then Height = (110-100)/5 = 2.0× ATR
          </p>
          <p className="text-text-secondary text-sm">
            <strong className="text-text-primary">Why it matters:</strong> Patterns smaller than 1× ATR are often noise. ATR-normalized height ensures the pattern is meaningful relative to the stock's volatility.
          </p>
        </div>

        <div className="bg-surface-2 border border-border rounded-lg p-4">
          <h4 className="text-accent font-semibold mb-2">Total Touches</h4>
          <p className="text-text-secondary text-sm mb-2">
            <strong className="text-text-primary">What it is:</strong> The number of times price touched the pattern's key levels (peaks/troughs and neckline) within a tolerance.
          </p>
          <p className="text-text-secondary text-sm mb-2">
            <strong className="text-text-primary">Tolerance:</strong> Price is considered "touching" if it's within 0.3× ATR of the level.
          </p>
          <p className="text-text-secondary text-sm mb-2">
            <strong className="text-text-primary">Institutional Threshold:</strong> ≥5 touches (proves the pattern is valid and respected)
          </p>
          <p className="text-text-secondary text-sm">
            <strong className="text-text-primary">Why it matters:</strong> More touches indicate stronger support/resistance and more reliable pattern structure.
          </p>
        </div>

        <div className="bg-surface-2 border border-border rounded-lg p-4">
          <h4 className="text-text-secondary font-semibold mb-2">Breakout VolZ (Volume Z-Score)</h4>
          <p className="text-text-secondary text-sm mb-2">
            <strong className="text-text-primary">What it is:</strong> How many standard deviations above/below average volume the breakout candle was.
          </p>
          <p className="text-text-secondary text-sm mb-2">
            <strong className="text-text-primary">Institutional Threshold:</strong> ≥1.2σ for double tops/bottoms, ≥1.0σ for flags/triangles
          </p>
          <p className="text-text-secondary text-sm mb-2">
            <strong className="text-text-primary">Interpretation:</strong>
          </p>
          <ul className="text-text-secondary text-sm space-y-1 ml-4 list-disc">
            <li><strong className="text-text-primary">+1.0σ to +1.5σ:</strong> Good volume confirmation</li>
            <li><strong className="text-text-primary">+1.5σ to +2.0σ:</strong> Strong volume confirmation</li>
            <li><strong className="text-text-primary">+2.0σ+:</strong> Exceptional volume (likely institutional)</li>
            <li><strong className="text-text-primary">{"<"}0σ:</strong> Low volume (weak breakout, be cautious)</li>
          </ul>
        </div>

        <div className="bg-surface-2 border border-border rounded-lg p-4">
          <h4 className="text-text-secondary font-semibold mb-2">Width % / Width (ATR)</h4>
          <p className="text-text-secondary text-sm mb-2">
            <strong className="text-text-primary">What it is:</strong> The horizontal width of the pattern (time duration), measured as a percentage of price or in ATR multiples.
          </p>
          <p className="text-text-secondary text-sm">
            <strong className="text-text-primary">Why it matters:</strong> Wider patterns (more bars) are generally more reliable. This metric helps validate triangles, flags, and wedges.
          </p>
        </div>

        <div className="bg-surface-2 border border-border rounded-lg p-4">
          <h4 className="text-text-secondary font-semibold mb-2">R² Upper / R² Lower</h4>
          <p className="text-text-secondary text-sm mb-2">
            <strong className="text-text-primary">What it is:</strong> The R-squared value (goodness of fit) for linear regression lines fitted to the pattern's upper and lower boundaries.
          </p>
          <p className="text-text-secondary text-sm mb-2">
            <strong className="text-text-primary">Range:</strong> 0.0 to 1.0 (1.0 = perfect line fit)
          </p>
          <p className="text-text-secondary text-sm">
            <strong className="text-text-primary">Why it matters:</strong> Higher R² means the pattern boundaries are more linear and well-defined. Triangles and flags require high R² for both boundaries.
          </p>
        </div>
      </div>
    </div>
  );
}

// Candlestick Help Section
function CandlestickHelp() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-text-primary mb-3">Candlestick Facts</h3>
        <p className="text-text-secondary leading-relaxed">
          These metrics measure the <strong className="text-text-primary">most recent candlestick</strong> to determine entry timing and confirm pattern direction.
        </p>
      </div>

      <div className="space-y-4">
        <div className="bg-surface-2 border border-border rounded-lg p-4">
          <h4 className="text-text-secondary font-semibold mb-2">Body %</h4>
          <p className="text-text-secondary text-sm mb-2">
            <strong className="text-text-primary">What it is:</strong> The candlestick's body size as a percentage of the total candle range.
          </p>
          <p className="text-text-secondary text-sm mb-2">
            <strong className="text-text-primary">Calculation:</strong> |Close - Open| / (High - Low) × 100
          </p>
          <p className="text-text-secondary text-sm">
            <strong className="text-text-primary">Interpretation:</strong> High body % (70%+) = strong directional conviction. Low body % (30%-) = indecision (doji-like).
          </p>
        </div>

        <div className="bg-surface-2 border border-border rounded-lg p-4">
          <h4 className="text-text-secondary font-semibold mb-2">Top Wick % / Bottom Wick %</h4>
          <p className="text-text-secondary text-sm mb-2">
            <strong className="text-text-primary">What it is:</strong> The size of the upper and lower wicks relative to the total candle range.
          </p>
          <p className="text-text-secondary text-sm">
            <strong className="text-text-primary">Why it matters:</strong> Long wicks indicate rejection of that price level. For example, a long top wick on an up candle suggests rejection of higher prices (bearish signal).
          </p>
        </div>

        <div className="bg-surface-2 border border-border rounded-lg p-4">
          <h4 className="text-loss font-semibold mb-2">Engulfment %</h4>
          <p className="text-text-secondary text-sm mb-2">
            <strong className="text-text-primary">What it is:</strong> How much of the previous candle is "engulfed" by the current candle (only shown for engulfing patterns).
          </p>
          <p className="text-text-secondary text-sm">
            <strong className="text-text-primary">Why it matters:</strong> Higher engulfment (80%+) indicates stronger reversal momentum. Lower engulfment ({'<'}50%) may be a weak signal.
          </p>
        </div>

        <div className="bg-surface-2 border border-border rounded-lg p-4">
          <h4 className="text-profit font-semibold mb-2">Vol Ratio</h4>
          <p className="text-text-secondary text-sm mb-2">
            <strong className="text-text-primary">What it is:</strong> Current candle's volume divided by the average volume of the last 20 candles.
          </p>
          <p className="text-text-secondary text-sm mb-2">
            <strong className="text-text-primary">Interpretation:</strong>
          </p>
          <ul className="text-text-secondary text-sm space-y-1 ml-4 list-disc">
            <li><strong className="text-text-primary">{"<"}0.5×:</strong> Very low volume (weak signal)</li>
            <li><strong className="text-text-primary">0.5× - 1.0×:</strong> Normal volume</li>
            <li><strong className="text-text-primary">1.0× - 2.0×:</strong> Above average (good confirmation)</li>
            <li><strong className="text-text-primary">2.0×+:</strong> Exceptional volume (strong confirmation)</li>
          </ul>
        </div>

        <div className="bg-surface-2 border border-border rounded-lg p-4">
          <h4 className="text-text-secondary font-semibold mb-2">Vol Z-Score</h4>
          <p className="text-text-secondary text-sm mb-2">
            <strong className="text-text-primary">What it is:</strong> Standardized volume measurement (same as Breakout VolZ but for the candlestick).
          </p>
          <p className="text-text-secondary text-sm">
            <strong className="text-text-primary">Interpretation:</strong> Same as Breakout VolZ. Positive values indicate above-average volume; negative values indicate below-average volume.
          </p>
        </div>

        <div className="bg-surface-2 border border-border rounded-lg p-4">
          <h4 className="text-text-secondary font-semibold mb-2">Close Location %</h4>
          <p className="text-text-secondary text-sm mb-2">
            <strong className="text-text-primary">What it is:</strong> Where the candle closed relative to its range (0% = closed at low, 100% = closed at high).
          </p>
          <p className="text-text-secondary text-sm mb-2">
            <strong className="text-text-primary">Calculation:</strong> (Close - Low) / (High - Low) × 100
          </p>
          <p className="text-text-secondary text-sm">
            <strong className="text-text-primary">Why it matters:</strong> Close location indicates buying/selling pressure. High close location (70%+) = strong buying. Low close location (30%-) = strong selling.
          </p>
        </div>
      </div>
    </div>
  );
}

// How Used Help Section
function HowUsedHelp() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-text-primary mb-3">How These Metrics Are Used</h3>
        <p className="text-text-secondary leading-relaxed">
          Understanding how the system uses these metrics to make trading decisions.
        </p>
      </div>

      <div className="bg-surface-2 border border-border rounded-lg p-5">
        <h4 className="text-accent font-semibold mb-3 text-lg">Two-Tier Pattern Classification</h4>
        <div className="space-y-3">
          <div>
            <h5 className="text-text-primary font-semibold mb-1">1. Institutional Pattern (Tradeable)</h5>
            <p className="text-text-secondary text-sm mb-2">
              Patterns that meet <strong className="text-text-primary">all institutional thresholds</strong> are marked as tradeable:
            </p>
            <ul className="text-text-secondary text-sm space-y-1 ml-4 list-disc">
              <li>Symmetry ≤2.0%</li>
              <li>Separation ≥10 bars</li>
              <li>Height ≥1.0× ATR</li>
              <li>Total Touches ≥5</li>
              <li>Breakout VolZ meets pattern-specific requirements</li>
            </ul>
            <p className="text-profit text-sm mt-2 font-semibold">
              These patterns contribute 60% weight to the composite score and can receive bonuses.
            </p>
          </div>

          <div>
            <h5 className="text-text-primary font-semibold mb-1">2. Candidate Pattern (Watch)</h5>
            <p className="text-text-secondary text-sm mb-2">
              Patterns that meet <strong className="text-text-primary">relaxed thresholds</strong> but not institutional:
            </p>
            <ul className="text-text-secondary text-sm space-y-1 ml-4 list-disc">
              <li>Symmetry ≤3.5% (relaxed from 2.0%)</li>
              <li>Separation ≥6 bars (relaxed from 10)</li>
              <li>Height ≥0.8× ATR (relaxed from 1.0×)</li>
              <li>Total Touches ≥4 (relaxed from 5)</li>
            </ul>
            <p className="text-text-secondary text-sm mt-2 font-semibold">
              These patterns are capped at 65/100 composite score until they qualify as institutional.
            </p>
          </div>

          <div>
            <h5 className="text-text-primary font-semibold mb-1">3. Discarded Pattern (Excluded)</h5>
            <p className="text-text-secondary text-sm mb-2">
              Patterns with <strong className="text-text-primary">extreme violations</strong> are excluded from scoring:
            </p>
            <ul className="text-text-secondary text-sm space-y-1 ml-4 list-disc">
              <li>Symmetry {'>'}10% (5× threshold violation)</li>
              <li>Separation {'<'}5 bars (0.5× threshold violation)</li>
              <li>Height {'<'}0.5× ATR (0.5× threshold violation)</li>
            </ul>
            <p className="text-loss text-sm mt-2 font-semibold">
              These patterns are completely excluded from the composite score calculation.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-surface-2 border border-border rounded-lg p-5">
        <h4 className="text-text-secondary font-semibold mb-3 text-lg">Composite Score Calculation</h4>
        <div className="space-y-2 text-text-secondary text-sm">
          <p>
            The composite score combines <strong className="text-text-primary">structure (chart pattern)</strong> with <strong className="text-text-primary">timing (candlestick)</strong>:
          </p>
          <ol className="ml-4 space-y-2 list-decimal">
            <li><strong className="text-text-primary">Base Calculation:</strong> Weighted average of chart pattern confidence and candlestick confidence</li>
            <li><strong className="text-text-primary">Alignment Bonus:</strong> +15 points when chart and candle direction match (bullish/bullish or bearish/bearish)</li>
            <li><strong className="text-text-primary">Breakout State:</strong> Additional bonus based on whether pattern is pending (+5), confirmed (+15), or retested (+20)</li>
            <li><strong className="text-text-primary">Volume Bonus:</strong> +5 points for sufficient volume confirmation on breakout</li>
            <li><strong className="text-text-primary">Opposition Penalty:</strong> -10 points when chart and candle conflict</li>
            <li><strong className="text-text-primary">Final Cap:</strong> All scores capped at 95/100 for realism</li>
          </ol>
        </div>
      </div>

      <div className="bg-surface-2 border border-border rounded-lg p-5">
        <h4 className="text-text-secondary font-semibold mb-3 text-lg">Practical Interpretation</h4>
        <div className="space-y-3 text-text-secondary text-sm">
          <div>
            <strong className="text-text-primary">Composite 80-95:</strong> High conviction trade. All factors align. Consider full position size.
          </div>
          <div>
            <strong className="text-text-primary">Composite 65-79:</strong> Good setup. Monitor for confirmation or wait for stronger signal.
          </div>
          <div>
            <strong className="text-text-primary">Composite 50-64:</strong> Decent setup but missing some factors. Consider smaller position or wait.
          </div>
          <div>
            <strong className="text-text-primary">Composite {'<'}50:</strong> Weak setup. Wait for better pattern formation or clearer signals.
          </div>
        </div>
      </div>

      <div className="bg-surface-2 border border-border rounded-lg p-5">
        <h4 className="text-profit font-semibold mb-3 text-lg">Why Explainability Matters</h4>
        <p className="text-text-secondary text-sm leading-relaxed">
          Every number in this analysis is <strong className="text-text-primary">verifiable</strong>. You can check the math yourself:
        </p>
        <ul className="text-text-secondary text-sm space-y-1 ml-4 list-disc mt-2">
          <li>See exactly why a pattern scored 85% vs 60%</li>
          <li>Understand which criteria were met or missed</li>
          <li>Know what bonuses/penalties were applied</li>
          <li>Trace every decision back to explicit rules</li>
        </ul>
        <p className="text-profit text-sm mt-3 font-semibold">
          This transparency helps you build confidence in the system and learn pattern recognition yourself.
        </p>
      </div>
    </div>
  );
}
