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
    <div className="bg-white/5 backdrop-blur-lg rounded-xl shadow-xl border border-white/10 p-6">
      <h3 className="text-xl font-semibold text-white mb-6">📊 Trade Case</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* FOR THE TRADE */}
        {forTrade.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-green-500/30">
              <span className="text-2xl">✅</span>
              <h4 className="text-lg font-semibold text-green-300">FOR the Trade</h4>
            </div>
            <ul className="space-y-2">
              {forTrade.map((item, idx) => (
                <li key={idx} className="flex items-start gap-3 p-3 bg-green-500/5 border border-green-500/20 rounded-lg">
                  <span className="text-green-400 mt-0.5 font-bold">•</span>
                  <span className="text-green-100 text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* AGAINST THE TRADE */}
        {againstTrade.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-red-500/30">
              <span className="text-2xl">⚠️</span>
              <h4 className="text-lg font-semibold text-red-300">AGAINST the Trade</h4>
            </div>
            <ul className="space-y-2">
              {againstTrade.map((item, idx) => (
                <li key={idx} className="flex items-start gap-3 p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
                  <span className="text-red-400 mt-0.5 font-bold">•</span>
                  <span className="text-red-100 text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="mt-6 p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
        <div className="text-sm text-blue-200">
          <span className="font-semibold">Decision Framework:</span> Weigh the strengths against risks. 
          A good trade has more/stronger FOR points than AGAINST, and risks are manageable with proper stops.
        </div>
      </div>
    </div>
  );
}

