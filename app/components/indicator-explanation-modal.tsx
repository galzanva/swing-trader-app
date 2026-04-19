'use client';

/**
 * Indicator Explanation Modal
 * 
 * Comprehensive guide explaining technical indicators in plain English
 * with practical trading interpretations and examples
 */

import { useState, useEffect } from 'react';

export type IndicatorSection = 
  | 'rsi' 
  | 'stochastic' 
  | 'macd' 
  | 'williams-r' 
  | 'cci' 
  | 'mfi' 
  | 'adx' 
  | 'di' 
  | 'ema' 
  | 'volume-z' 
  | 'obv' 
  | 'cmf' 
  | 'atr' 
  | 'bollinger' 
  | 'volatility' 
  | 'squeeze'
  | 'all';

interface IndicatorExplanationModalProps {
  isOpen: boolean;
  onClose: () => void;
  section?: IndicatorSection;
}

export default function IndicatorExplanationModal({ 
  isOpen, 
  onClose, 
  section = 'all' 
}: IndicatorExplanationModalProps) {
  const [activeTab, setActiveTab] = useState<IndicatorSection>(section);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(section);
    }
  }, [isOpen, section]);

  if (!isOpen) return null;

  const tabs = [
    { id: 'rsi', label: 'RSI', category: 'momentum' },
    { id: 'stochastic', label: 'Stochastic', category: 'momentum' },
    { id: 'macd', label: 'MACD', category: 'momentum' },
    { id: 'williams-r', label: 'Williams %R', category: 'momentum' },
    { id: 'cci', label: 'CCI', category: 'momentum' },
    { id: 'mfi', label: 'MFI', category: 'momentum' },
    { id: 'adx', label: 'ADX', category: 'trend' },
    { id: 'di', label: '+DI / -DI', category: 'trend' },
    { id: 'ema', label: 'EMAs', category: 'trend' },
    { id: 'volume-z', label: 'Volume Z', category: 'volume' },
    { id: 'obv', label: 'OBV', category: 'volume' },
    { id: 'cmf', label: 'CMF', category: 'volume' },
    { id: 'atr', label: 'ATR', category: 'volatility' },
    { id: 'bollinger', label: 'Bollinger', category: 'volatility' },
    { id: 'volatility', label: 'Hist. Vol', category: 'volatility' },
    { id: 'squeeze', label: 'TTM Squeeze', category: 'volatility' },
  ];

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
            <h2 className="text-2xl font-bold text-text-primary mb-1">Indicator Guide</h2>
            <p className="text-text-secondary text-sm">Plain English explanations for trading indicators</p>
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

        {/* Tabs - Scrollable */}
        <div className="flex gap-1 px-4 pt-3 pb-2 border-b border-border overflow-x-auto shrink-0 bg-surface-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as IndicatorSection)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap ${
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
          {activeTab === 'rsi' && <RSIExplanation />}
          {activeTab === 'stochastic' && <StochasticExplanation />}
          {activeTab === 'macd' && <MACDExplanation />}
          {activeTab === 'williams-r' && <WilliamsRExplanation />}
          {activeTab === 'cci' && <CCIExplanation />}
          {activeTab === 'mfi' && <MFIExplanation />}
          {activeTab === 'adx' && <ADXExplanation />}
          {activeTab === 'di' && <DIExplanation />}
          {activeTab === 'ema' && <EMAExplanation />}
          {activeTab === 'volume-z' && <VolumeZExplanation />}
          {activeTab === 'obv' && <OBVExplanation />}
          {activeTab === 'cmf' && <CMFExplanation />}
          {activeTab === 'atr' && <ATRExplanation />}
          {activeTab === 'bollinger' && <BollingerExplanation />}
          {activeTab === 'volatility' && <VolatilityExplanation />}
          {activeTab === 'squeeze' && <SqueezeExplanation />}
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

// Helper components for formatting
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xl font-bold text-text-primary mb-4">{children}</h3>;
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold text-accent uppercase tracking-wide mb-2">{title}</h4>
      <div className="text-text-secondary text-sm space-y-2">{children}</div>
    </div>
  );
}

function ValueRange({ ranges }: { ranges: { range: string; meaning: string; color: string }[] }) {
  return (
    <div className="bg-surface-2 rounded-lg p-4 border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-text-muted">
            <th className="text-left pb-2">Value</th>
            <th className="text-left pb-2">Meaning</th>
          </tr>
        </thead>
        <tbody>
          {ranges.map((r, i) => (
            <tr key={i} className="border-t border-border">
              <td className={`py-2 font-mono ${r.color}`}>{r.range}</td>
              <td className="py-2 text-text-secondary">{r.meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Analogy({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface-2 border-l-4 border-accent pl-4 py-3 rounded-r-lg mb-4">
      <p className="text-text-secondary text-sm italic">{children}</p>
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-loss/10 border-l-4 border-loss pl-4 py-3 rounded-r-lg mb-4">
      <p className="text-text-secondary text-sm">{children}</p>
    </div>
  );
}

function TradingTip({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-profit/10 border-l-4 border-profit pl-4 py-3 rounded-r-lg mb-4">
      <p className="text-text-secondary text-sm">{children}</p>
    </div>
  );
}

// =====================================================
// MOMENTUM INDICATORS
// =====================================================

function RSIExplanation() {
  return (
    <div>
      <SectionTitle>RSI (Relative Strength Index)</SectionTitle>
      
      <SubSection title="What it measures">
        <p>RSI measures momentum - how fast and how much price is moving up vs. down over the last 14 periods.</p>
      </SubSection>

      <Analogy>
        Think of it like a speedometer. High RSI means price has been racing uphill fast. Low RSI means it&apos;s been sliding downhill.
      </Analogy>

      <SubSection title="Value Ranges">
        <ValueRange ranges={[
          { range: '> 70', meaning: 'Overbought - price moved up fast, may need rest', color: 'text-loss' },
          { range: '55-70', meaning: 'Bullish momentum - buyers in control', color: 'text-profit' },
          { range: '45-55', meaning: 'Neutral - no strong momentum either way', color: 'text-text-muted' },
          { range: '30-45', meaning: 'Bearish momentum - sellers in control', color: 'text-loss' },
          { range: '< 30', meaning: 'Oversold - price dropped fast, may bounce', color: 'text-loss' },
        ]} />
      </SubSection>

      <Warning>
        Overbought ≠ Sell Signal! In strong uptrends, RSI can stay above 70 for weeks. Use overbought/oversold for timing, not direction.
      </Warning>

      <TradingTip>
        RSI 50-60 after a pullback in an uptrend is the &quot;sweet spot&quot; for continuation entries.
      </TradingTip>
    </div>
  );
}

function StochasticExplanation() {
  return (
    <div>
      <SectionTitle>Stochastic Oscillator (%K / %D)</SectionTitle>
      
      <SubSection title="What it measures">
        <p>Stochastic shows where price closed relative to its high-low range over the last 14 periods.</p>
        <p className="mt-2"><strong>%K</strong> = Fast line (more sensitive)</p>
        <p><strong>%D</strong> = Slow line (smoothed %K)</p>
      </SubSection>

      <Analogy>
        Imagine a ball bouncing in a room. Stochastic tells you if the ball is near the ceiling (overbought) or near the floor (oversold).
      </Analogy>

      <SubSection title="Value Ranges">
        <ValueRange ranges={[
          { range: '> 80', meaning: 'Overbought - price near top of recent range', color: 'text-loss' },
          { range: '50-80', meaning: 'Bullish zone - trending higher', color: 'text-profit' },
          { range: '20-50', meaning: 'Bearish zone - trending lower', color: 'text-loss' },
          { range: '< 20', meaning: 'Oversold - price near bottom of recent range', color: 'text-loss' },
        ]} />
      </SubSection>

      <TradingTip>
        In strong uptrends, Stochastic can &quot;ride&quot; above 80 for extended periods. Don&apos;t fight the trend just because it&apos;s overbought.
      </TradingTip>

      <Warning>
        %K crossing below %D while overbought is a sell signal ONLY in ranging markets. In trends, it&apos;s often just a pullback.
      </Warning>
    </div>
  );
}

function MACDExplanation() {
  return (
    <div>
      <SectionTitle>MACD (Moving Average Convergence Divergence)</SectionTitle>
      
      <SubSection title="Components">
        <p><strong>MACD Line</strong> = 12-period EMA minus 26-period EMA</p>
        <p><strong>Signal Line</strong> = 9-period EMA of MACD Line</p>
        <p><strong>Histogram</strong> = MACD Line minus Signal Line</p>
      </SubSection>

      <Analogy>
        Think of the MACD Line as the car&apos;s position (above zero = uphill). The Histogram is the gas pedal - positive means accelerating up, negative means decelerating.
      </Analogy>

      <SubSection title="How to read it">
        <div className="space-y-3">
          <div className="bg-surface-2 rounded-lg p-3 border border-border">
            <p className="font-semibold text-profit">MACD Line &gt; 0 + Histogram &gt; 0</p>
            <p className="text-text-muted text-xs mt-1">Bullish trend + accelerating momentum = Strong buy zone</p>
          </div>
          <div className="bg-surface-2 rounded-lg p-3 border border-border">
            <p className="font-semibold text-text-secondary">MACD Line &gt; 0 + Histogram &lt; 0</p>
            <p className="text-text-muted text-xs mt-1">Still bullish trend, but momentum cooling = Pullback/consolidation</p>
          </div>
          <div className="bg-surface-2 rounded-lg p-3 border border-border">
            <p className="font-semibold text-loss">MACD Line &lt; 0 + Histogram &lt; 0</p>
            <p className="text-text-muted text-xs mt-1">Bearish trend + accelerating down = Avoid longs</p>
          </div>
        </div>
      </SubSection>

      <TradingTip>
        Negative histogram in an uptrend often means &quot;foot off the gas&quot; - the car is still moving uphill, just not accelerating. This is where pullback entries happen.
      </TradingTip>

      <Warning>
        MACD is a lagging indicator. By the time MACD confirms a trend, much of the move may be over. Use with price action.
      </Warning>
    </div>
  );
}

function WilliamsRExplanation() {
  return (
    <div>
      <SectionTitle>Williams %R</SectionTitle>
      
      <SubSection title="What it measures">
        <p>Williams %R measures where today&apos;s close is relative to the highest high over the last 14 periods. It&apos;s essentially an inverted Stochastic.</p>
      </SubSection>

      <Analogy>
        It&apos;s like measuring how close price is to the ceiling of a room. -20 means almost touching the ceiling, -80 means close to the floor.
      </Analogy>

      <SubSection title="Value Ranges">
        <ValueRange ranges={[
          { range: '-20 to 0', meaning: 'Overbought - price near recent highs', color: 'text-loss' },
          { range: '-50 to -20', meaning: 'Upper neutral - mild strength', color: 'text-profit' },
          { range: '-80 to -50', meaning: 'Lower neutral - mild weakness', color: 'text-loss' },
          { range: '-100 to -80', meaning: 'Oversold - price near recent lows', color: 'text-loss' },
        ]} />
      </SubSection>

      <TradingTip>
        Williams %R around -50 is the &quot;reset&quot; zone. In uptrends, pullbacks often find their bottom here before continuing higher.
      </TradingTip>
    </div>
  );
}

function CCIExplanation() {
  return (
    <div>
      <SectionTitle>CCI (Commodity Channel Index)</SectionTitle>
      
      <SubSection title="What it measures">
        <p>CCI measures how far price has deviated from its statistical average. It&apos;s excellent at identifying pullbacks within trends.</p>
      </SubSection>

      <Analogy>
        Think of a rubber band. CCI measures how stretched it is. Positive = stretched upward, negative = stretched downward. Rubber bands tend to snap back.
      </Analogy>

      <SubSection title="Value Ranges">
        <ValueRange ranges={[
          { range: '> +100', meaning: 'Strong bullish momentum - possibly extended', color: 'text-profit' },
          { range: '0 to +100', meaning: 'Mild bullish - normal uptrend territory', color: 'text-profit' },
          { range: '-100 to 0', meaning: 'Mild bearish - pullback or early downtrend', color: 'text-loss' },
          { range: '< -100', meaning: 'Strong bearish momentum - possibly oversold', color: 'text-loss' },
        ]} />
      </SubSection>

      <TradingTip>
        In strong uptrends, CCI often dips slightly negative during pullbacks, then turns back up before price makes new highs. This is a continuation setup.
      </TradingTip>

      <Warning>
        CCI can stay above +100 or below -100 for extended periods in strong trends. Don&apos;t fade a trend just because CCI is extreme.
      </Warning>
    </div>
  );
}

function MFIExplanation() {
  return (
    <div>
      <SectionTitle>MFI (Money Flow Index)</SectionTitle>
      
      <SubSection title="What it measures">
        <p>MFI is like RSI, but it factors in volume. It measures buying and selling pressure by combining price movement with volume.</p>
      </SubSection>

      <Analogy>
        If RSI is a speedometer, MFI is a &quot;weight-adjusted&quot; speedometer. Heavy volume moves count more than light volume moves.
      </Analogy>

      <SubSection title="Value Ranges">
        <ValueRange ranges={[
          { range: '> 80', meaning: 'Heavy buying pressure - possibly exhausted', color: 'text-loss' },
          { range: '50-80', meaning: 'Money flowing IN - accumulation', color: 'text-profit' },
          { range: '20-50', meaning: 'Money flowing OUT - distribution', color: 'text-loss' },
          { range: '< 20', meaning: 'Heavy selling pressure - possibly capitulation', color: 'text-loss' },
        ]} />
      </SubSection>

      <TradingTip>
        MFI above 50 with price stalling = institutions still buying. MFI below 50 while price stalls = watch for breakdown.
      </TradingTip>
    </div>
  );
}

// =====================================================
// TREND INDICATORS
// =====================================================

function ADXExplanation() {
  return (
    <div>
      <SectionTitle>ADX (Average Directional Index)</SectionTitle>
      
      <SubSection title="What it measures">
        <p>ADX measures <strong>trend strength</strong>, not direction. It tells you HOW STRONG the trend is, not whether it&apos;s up or down.</p>
      </SubSection>

      <Analogy>
        Think of ADX like the volume knob on a radio. High ADX = loud signal (strong trend). Low ADX = quiet signal (ranging market).
      </Analogy>

      <SubSection title="Value Ranges">
        <ValueRange ranges={[
          { range: '> 40', meaning: 'STRONG trend - follow it, don\'t fade it', color: 'text-profit' },
          { range: '25-40', meaning: 'Moderate trend - tradeable, use pullbacks', color: 'text-text-secondary' },
          { range: '20-25', meaning: 'Weak/emerging trend - be cautious', color: 'text-text-muted' },
          { range: '< 20', meaning: 'No trend (range) - use mean reversion', color: 'text-text-muted' },
        ]} />
      </SubSection>

      <TradingTip>
        ADX &gt; 25 is the threshold for &quot;confirmed trend.&quot; Below 25, price is likely ranging and pattern-based signals matter more.
      </TradingTip>

      <Warning>
        ADX tells you trend strength, but NOT direction. Always check +DI vs -DI to know if the trend is up or down.
      </Warning>
    </div>
  );
}

function DIExplanation() {
  return (
    <div>
      <SectionTitle>+DI / -DI (Directional Indicators)</SectionTitle>
      
      <SubSection title="What they measure">
        <p><strong>+DI</strong> = Buying pressure strength</p>
        <p><strong>-DI</strong> = Selling pressure strength</p>
        <p>The spread between them shows who&apos;s in control.</p>
      </SubSection>

      <Analogy>
        Think of +DI and -DI as a tug-of-war. Whoever has more rope (higher value) is winning. The wider the gap, the more dominant that side is.
      </Analogy>

      <SubSection title="How to interpret">
        <div className="space-y-3">
          <div className="bg-surface-2 rounded-lg p-3 border border-border">
            <p className="font-semibold text-profit">+DI &gt; -DI (especially by 10+ points)</p>
            <p className="text-text-muted text-xs mt-1">Buyers in control = bullish directional bias</p>
          </div>
          <div className="bg-surface-2 rounded-lg p-3 border border-border">
            <p className="font-semibold text-loss">-DI &gt; +DI (especially by 10+ points)</p>
            <p className="text-text-muted text-xs mt-1">Sellers in control = bearish directional bias</p>
          </div>
          <div className="bg-surface-2 rounded-lg p-3 border border-border">
            <p className="font-semibold text-text-secondary">+DI ≈ -DI (within 5 points)</p>
            <p className="text-text-muted text-xs mt-1">Neither side dominant = ranging or transitional</p>
          </div>
        </div>
      </SubSection>

      <TradingTip>
        +DI &gt; -DI by 15+ points with ADX &gt; 25 = STRONG UPTREND. This is the ideal environment for long trades.
      </TradingTip>
    </div>
  );
}

function EMAExplanation() {
  return (
    <div>
      <SectionTitle>EMA (Exponential Moving Averages)</SectionTitle>
      
      <SubSection title="What they measure">
        <p>EMAs smooth price data to show the underlying trend direction. Shorter EMAs react faster, longer EMAs are more stable.</p>
        <p className="mt-2"><strong>Common periods:</strong> 9 (fast), 20 (medium), 50 (slow), 200 (major trend)</p>
      </SubSection>

      <Analogy>
        EMAs are like different zoom levels on a map. The 9 EMA shows the neighborhood, the 200 EMA shows the country. Use all levels to see the full picture.
      </Analogy>

      <SubSection title="Bullish vs Bearish Alignment">
        <div className="space-y-3">
          <div className="bg-surface-2 rounded-lg p-3 border border-border">
            <p className="font-semibold text-profit">Bullish Stacking: 9 &gt; 20 &gt; 50 &gt; 200</p>
            <p className="text-text-muted text-xs mt-1">Price above all EMAs, short-term leading = strong uptrend</p>
          </div>
          <div className="bg-surface-2 rounded-lg p-3 border border-border">
            <p className="font-semibold text-loss">Bearish Stacking: 9 &lt; 20 &lt; 50 &lt; 200</p>
            <p className="text-text-muted text-xs mt-1">Price below all EMAs, short-term lagging = strong downtrend</p>
          </div>
          <div className="bg-surface-2 rounded-lg p-3 border border-border">
            <p className="font-semibold text-text-secondary">Mixed/Compressed</p>
            <p className="text-text-muted text-xs mt-1">EMAs tangled together = ranging or transitional</p>
          </div>
        </div>
      </SubSection>

      <TradingTip>
        The 20 EMA is often the &quot;pullback zone&quot; in uptrends. Price returning to the 20 EMA and bouncing = healthy continuation.
      </TradingTip>
    </div>
  );
}

// =====================================================
// VOLUME INDICATORS
// =====================================================

function VolumeZExplanation() {
  return (
    <div>
      <SectionTitle>Volume Z-Score</SectionTitle>
      
      <SubSection title="What it measures">
        <p>Volume Z-Score measures how unusual today&apos;s volume is compared to the recent average. It&apos;s expressed in standard deviations.</p>
      </SubSection>

      <Analogy>
        If average daily volume is &quot;normal talking,&quot; a high Z-Score is &quot;shouting&quot; - something unusual is happening. Low Z-Score is &quot;whispering&quot; - low conviction.
      </Analogy>

      <SubSection title="Value Ranges">
        <ValueRange ranges={[
          { range: '> 2.0', meaning: 'Extremely high volume - major event or breakout', color: 'text-profit' },
          { range: '1.0 to 2.0', meaning: 'Above average - conviction behind move', color: 'text-text-secondary' },
          { range: '-0.5 to 1.0', meaning: 'Normal volume - typical activity', color: 'text-text-muted' },
          { range: '< -0.5', meaning: 'Below average - low conviction/summer doldrums', color: 'text-loss' },
        ]} />
      </SubSection>

      <TradingTip>
        Breakouts with Volume Z-Score &gt; 1.5 have higher success rates. Low volume breakouts often fail.
      </TradingTip>

      <Warning>
        Negative Z-Score doesn&apos;t mean &quot;sell.&quot; It means the current move lacks conviction - wait for confirmation before acting.
      </Warning>
    </div>
  );
}

function OBVExplanation() {
  return (
    <div>
      <SectionTitle>OBV (On-Balance Volume)</SectionTitle>
      
      <SubSection title="What it measures">
        <p>OBV tracks cumulative volume flow. Up days add volume to the total, down days subtract it. The trend of OBV matters more than the absolute number.</p>
      </SubSection>

      <Analogy>
        OBV is like tracking money flowing in and out of a bathtub. Rising OBV = water (money) pouring in. Falling OBV = water draining out.
      </Analogy>

      <SubSection title="How to interpret">
        <div className="space-y-3">
          <div className="bg-surface-2 rounded-lg p-3 border border-border">
            <p className="font-semibold text-profit">OBV Rising + Price Rising</p>
            <p className="text-text-muted text-xs mt-1">Confirmed uptrend - volume supports price</p>
          </div>
          <div className="bg-surface-2 rounded-lg p-3 border border-border">
            <p className="font-semibold text-text-secondary">OBV Rising + Price Flat</p>
            <p className="text-text-muted text-xs mt-1">Accumulation - smart money buying, breakout coming?</p>
          </div>
          <div className="bg-surface-2 rounded-lg p-3 border border-border">
            <p className="font-semibold text-loss">OBV Falling + Price Rising</p>
            <p className="text-text-muted text-xs mt-1">Bearish divergence - rally on weak volume, caution</p>
          </div>
        </div>
      </SubSection>

      <TradingTip>
        Rising OBV is one of the most reliable confirmation signals. If OBV is rising, institutions are likely accumulating.
      </TradingTip>
    </div>
  );
}

function CMFExplanation() {
  return (
    <div>
      <SectionTitle>CMF (Chaikin Money Flow)</SectionTitle>
      
      <SubSection title="What it measures">
        <p>CMF measures the volume-weighted average of accumulation/distribution over 20 periods. It shows whether money is flowing into or out of a stock.</p>
      </SubSection>

      <Analogy>
        CMF is like a &quot;voting system&quot; where volume is the number of votes and price location in the range is the vote direction. Positive = buying wins, negative = selling wins.
      </Analogy>

      <SubSection title="Value Ranges">
        <ValueRange ranges={[
          { range: '> 0.25', meaning: 'Strong accumulation - heavy buying', color: 'text-profit' },
          { range: '0.05 to 0.25', meaning: 'Mild accumulation - buyers slightly ahead', color: 'text-profit' },
          { range: '-0.05 to 0.05', meaning: 'Neutral - balanced flow', color: 'text-text-muted' },
          { range: '-0.25 to -0.05', meaning: 'Mild distribution - sellers slightly ahead', color: 'text-loss' },
          { range: '< -0.25', meaning: 'Strong distribution - heavy selling', color: 'text-loss' },
        ]} />
      </SubSection>

      <TradingTip>
        CMF above 0 during a pullback = smart money is still buying the dip. This supports continuation.
      </TradingTip>

      <Warning>
        CMF below -0.1 during a rally is a red flag - the rally may be distribution (selling into strength).
      </Warning>
    </div>
  );
}

// =====================================================
// VOLATILITY INDICATORS
// =====================================================

function ATRExplanation() {
  return (
    <div>
      <SectionTitle>ATR (Average True Range)</SectionTitle>
      
      <SubSection title="What it measures">
        <p>ATR measures volatility - the average price range per period. Higher ATR = bigger moves, lower ATR = smaller moves.</p>
        <p className="mt-2"><strong>ATR%</strong> = ATR as a percentage of price (easier to compare across stocks)</p>
      </SubSection>

      <Analogy>
        ATR is the stock&apos;s &quot;daily fitness level.&quot; High ATR = marathon runner (covers lots of ground). Low ATR = couch potato (barely moves).
      </Analogy>

      <SubSection title="ATR% Ranges">
        <ValueRange ranges={[
          { range: '> 8%', meaning: 'Extremely volatile - wild swings, widen stops', color: 'text-loss' },
          { range: '5-8%', meaning: 'High volatility - active stock, wider stops needed', color: 'text-text-secondary' },
          { range: '2-5%', meaning: 'Normal volatility - typical swing trading range', color: 'text-profit' },
          { range: '< 2%', meaning: 'Low volatility - slow mover, tight stops OK', color: 'text-text-muted' },
        ]} />
      </SubSection>

      <TradingTip>
        Use ATR for position sizing: Stop Loss = 1-2x ATR below entry. Target = 2-3x ATR above entry. This adapts to each stock&apos;s personality.
      </TradingTip>
    </div>
  );
}

function BollingerExplanation() {
  return (
    <div>
      <SectionTitle>Bollinger Bands (%B & Bandwidth)</SectionTitle>
      
      <SubSection title="What they measure">
        <p><strong>%B</strong> = Where price is within the bands (0% = lower band, 100% = upper band)</p>
        <p><strong>Bandwidth</strong> = How wide the bands are (volatility measure)</p>
      </SubSection>

      <Analogy>
        Bollinger Bands are like a breathing animal - they expand (exhale) during volatile moves and contract (inhale) during quiet periods. The &quot;squeeze&quot; before a breakout is the inhale before a big move.
      </Analogy>

      <SubSection title="%B Ranges">
        <ValueRange ranges={[
          { range: '> 100%', meaning: 'Above upper band - very strong, possibly extended', color: 'text-profit' },
          { range: '80-100%', meaning: 'Near upper band - bullish, watch for reversal', color: 'text-text-secondary' },
          { range: '20-80%', meaning: 'Middle zone - normal trading range', color: 'text-text-muted' },
          { range: '0-20%', meaning: 'Near lower band - oversold, watch for bounce', color: 'text-loss' },
          { range: '< 0%', meaning: 'Below lower band - extremely oversold', color: 'text-loss' },
        ]} />
      </SubSection>

      <TradingTip>
        Bandwidth contracting to multi-week lows = &quot;squeeze&quot; forming. The next expansion often produces a significant move.
      </TradingTip>
    </div>
  );
}

function VolatilityExplanation() {
  return (
    <div>
      <SectionTitle>Historical Volatility (HV)</SectionTitle>
      
      <SubSection title="What it measures">
        <p>Historical Volatility measures how much price has fluctuated over the past period, expressed as an annualized percentage.</p>
      </SubSection>

      <Analogy>
        HV is like a stock&apos;s &quot;personality profile.&quot; High HV = dramatic teenager (big mood swings). Low HV = calm adult (steady and predictable).
      </Analogy>

      <SubSection title="Value Ranges">
        <ValueRange ranges={[
          { range: '> 100%', meaning: 'Extreme - crisis level volatility', color: 'text-loss' },
          { range: '50-100%', meaning: 'High - growth/speculative stocks', color: 'text-text-secondary' },
          { range: '20-50%', meaning: 'Normal - typical for most stocks', color: 'text-text-muted' },
          { range: '< 20%', meaning: 'Low - blue chips, utilities', color: 'text-text-secondary' },
        ]} />
      </SubSection>

      <Warning>
        High HV stocks require wider stops and smaller position sizes. Don&apos;t use the same risk management for a 20% HV stock and a 100% HV stock.
      </Warning>
    </div>
  );
}

function SqueezeExplanation() {
  return (
    <div>
      <SectionTitle>TTM Squeeze</SectionTitle>
      
      <SubSection title="What it measures">
        <p>The TTM Squeeze identifies periods of low volatility (compression) that often precede explosive moves. It combines Bollinger Bands and Keltner Channels.</p>
        <p className="mt-2"><strong>Squeeze ON</strong> = Bollinger Bands inside Keltner Channels (compression)</p>
        <p><strong>Squeeze OFF</strong> = Bollinger Bands outside Keltner Channels (expansion)</p>
      </SubSection>

      <Analogy>
        Think of it like a coiled spring. The squeeze is the spring compressing. When it releases (Squeeze OFF), energy is released and price tends to move explosively.
      </Analogy>

      <SubSection title="How to trade it">
        <div className="space-y-3">
          <div className="bg-surface-2 rounded-lg p-3 border border-border">
            <p className="font-semibold text-text-secondary">Squeeze ON (Compression)</p>
            <p className="text-text-muted text-xs mt-1">Prepare for breakout. Identify direction using momentum indicator. Don&apos;t enter trend trades during squeeze.</p>
          </div>
          <div className="bg-surface-2 rounded-lg p-3 border border-border">
            <p className="font-semibold text-profit">Squeeze OFF + Momentum Bullish</p>
            <p className="text-text-muted text-xs mt-1">Squeeze fired upward - look for long entries on pullbacks</p>
          </div>
          <div className="bg-surface-2 rounded-lg p-3 border border-border">
            <p className="font-semibold text-loss">Squeeze OFF + Momentum Bearish</p>
            <p className="text-text-muted text-xs mt-1">Squeeze fired downward - avoid longs, look for shorts</p>
          </div>
        </div>
      </SubSection>

      <TradingTip>
        The longer the squeeze, the bigger the potential move. A 10+ bar squeeze often produces a significant trend.
      </TradingTip>

      <Warning>
        Squeeze ON with bearish momentum = DO NOT enter long trend trades. Wait for squeeze to fire in your direction first.
      </Warning>
    </div>
  );
}
