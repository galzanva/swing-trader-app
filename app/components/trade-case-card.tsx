'use client';

/**
 * Trade Case Card Component
 * Displays FOR/AGAINST analysis for a trade setup
 */

interface TradeCaseProps {
  forTrade?: string[];
  againstTrade?: string[];
}

export default function TradeCaseCard({ forTrade = [], againstTrade = [] }: TradeCaseProps) {
  if (forTrade.length === 0 && againstTrade.length === 0) return null;

  return (
    <div className="bg-surface-1 border border-border rounded-xl p-6">
      <h3 className="text-xl font-semibold text-text-primary mb-6">Trade Case</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* FOR THE TRADE */}
        {forTrade.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <h4 className="text-lg font-semibold text-profit">For the Trade</h4>
            </div>
            <ul className="space-y-2">
              {forTrade.map((item, idx) => (
                <li key={idx} className="flex items-start gap-3 p-3 bg-profit/10 border border-profit/20 rounded-lg">
                  <span className="text-profit mt-0.5 font-bold">•</span>
                  <span className="text-profit text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* AGAINST THE TRADE */}
        {againstTrade.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <h4 className="text-lg font-semibold text-loss">Against the Trade</h4>
            </div>
            <ul className="space-y-2">
              {againstTrade.map((item, idx) => (
                <li key={idx} className="flex items-start gap-3 p-3 bg-loss/10 border border-loss/20 rounded-lg">
                  <span className="text-loss mt-0.5 font-bold">•</span>
                  <span className="text-loss text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="mt-6 p-4 bg-surface-2 border border-border rounded-lg">
        <div className="text-sm text-text-secondary">
          <span className="font-semibold">Decision Framework:</span> Weigh the strengths against risks. 
          A good trade has more/stronger FOR points than AGAINST, and risks are manageable with proper stops.
        </div>
      </div>
    </div>
  );
}
