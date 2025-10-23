'use client';

/**
 * Squeeze Analysis Card Component
 * Displays Short Float Squeeze + TTM Squeeze analysis
 */

interface SqueezeAnalysisProps {
  squeezeAnalysis?: {
    shortSqueeze: {
      potential: 'high' | 'moderate' | 'low' | 'none';
      score: number;
      daysToCover: number | null;
      shortFloat: number | null;
      shortVolumeZ: number | null;
      shortVolumeTrend: 'increasing' | 'decreasing' | 'stable' | 'unknown';
      triggers: string[];
      warnings: string[];
    };
    ttmSqueeze: {
      current: {
        state: 'ON' | 'FIRE' | 'OFF';
        momentumDirection: 'bullish' | 'bearish' | 'neutral';
        momentumStrength: number;
        histogram: number;
      };
      squeezeDuration: number;
      fireConfirmed: boolean;
      potentialBreakout: 'bullish' | 'bearish' | 'neutral';
      triggers: string[];
      warnings: string[];
    };
    // Flat structure (not nested under "combined")
    combinedScore: number;
    combinedPotential: 'extreme' | 'high' | 'moderate' | 'low' | 'none';
    alignment: boolean;
    recommendation: string;
    triggers: string[];
    warnings: string[];
  };
}

export default function SqueezeAnalysisCard({ squeezeAnalysis }: SqueezeAnalysisProps) {
  if (!squeezeAnalysis) return null;

  const { shortSqueeze, ttmSqueeze } = squeezeAnalysis;
  
  // Create a "combined" object for backward compatibility with the JSX below
  const combined = {
    score: squeezeAnalysis.combinedScore,
    potential: squeezeAnalysis.combinedPotential,
    alignment: squeezeAnalysis.alignment,
    recommendation: squeezeAnalysis.recommendation,
    triggers: squeezeAnalysis.triggers,
    warnings: squeezeAnalysis.warnings,
  };

  const getSqueezeStateIcon = (state: 'ON' | 'FIRE' | 'OFF') => {
    switch (state) {
      case 'FIRE': return '🔥';
      case 'ON': return '⚡';
      case 'OFF': return '⚪';
    }
  };

  const getSqueezeStateColor = (state: 'ON' | 'FIRE' | 'OFF') => {
    switch (state) {
      case 'FIRE': return 'text-red-400 bg-red-500/10 border-red-500/30';
      case 'ON': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
      case 'OFF': return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
    }
  };

  const getPotentialColor = (potential: string) => {
    switch (potential) {
      case 'extreme': return 'text-red-400';
      case 'high': return 'text-orange-400';
      case 'moderate': return 'text-yellow-400';
      case 'low': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="bg-white/5 backdrop-blur-lg rounded-xl shadow-xl border border-white/10 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-white">🔥 Squeeze Analysis</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-blue-200">Combined Score:</span>
          <span className={`text-2xl font-bold ${getPotentialColor(combined.potential)}`}>
            {combined.score}/100
          </span>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPotentialColor(combined.potential)} border ${
            combined.potential === 'extreme' ? 'border-red-500/30 bg-red-500/10' :
            combined.potential === 'high' ? 'border-orange-500/30 bg-orange-500/10' :
            combined.potential === 'moderate' ? 'border-yellow-500/30 bg-yellow-500/10' :
            'border-blue-500/30 bg-blue-500/10'
          }`}>
            {combined.potential.toUpperCase()}
          </span>
        </div>
      </div>

      {combined.alignment && (
        <div className="mb-4 p-4 bg-gradient-to-r from-red-500/20 to-yellow-500/20 border border-red-500/30 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚡</span>
            <div>
              <div className="text-lg font-semibold text-yellow-300">Both Squeezes Aligned!</div>
              <div className="text-sm text-yellow-100">Short interest pressure + volatility compression = enhanced breakout potential</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Short Float Squeeze */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-blue-500/30">
            <h4 className="text-lg font-semibold text-white">Short Float Squeeze</h4>
            <span className={`px-2 py-1 rounded text-xs font-medium ${getPotentialColor(shortSqueeze.potential)} border ${
              shortSqueeze.potential === 'high' ? 'border-orange-500/30 bg-orange-500/10' :
              shortSqueeze.potential === 'moderate' ? 'border-yellow-500/30 bg-yellow-500/10' :
              'border-gray-500/30 bg-gray-500/10'
            }`}>
              {shortSqueeze.potential.toUpperCase()}
            </span>
          </div>

          <div className="space-y-3">
            {shortSqueeze.daysToCover !== null && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-blue-200">Days to Cover</span>
                  <span className="text-lg font-semibold text-white">{shortSqueeze.daysToCover.toFixed(1)} days</span>
                </div>
                <div className="text-xs text-blue-300">
                  {shortSqueeze.daysToCover > 7 ? '🔥 VERY HIGH - Shorts highly trapped' :
                   shortSqueeze.daysToCover > 4 ? '⚡ ELEVATED - Meaningful short interest' :
                   '⚪ MODEST - Limited squeeze catalyst'}
                </div>
              </div>
            )}

            {shortSqueeze.shortFloat !== null && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-blue-200">Short Float %</span>
                  <span className="text-lg font-semibold text-white">{shortSqueeze.shortFloat.toFixed(1)}%</span>
                </div>
                <div className="text-xs text-blue-300">
                  {shortSqueeze.shortFloat > 20 ? '🔥 EXTREME - Heavily shorted' :
                   shortSqueeze.shortFloat > 10 ? '⚡ SIGNIFICANT - Notable short interest' :
                   '⚪ LIGHT - Limited short pressure'}
                </div>
              </div>
            )}

            {shortSqueeze.shortVolumeZ !== null && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-blue-200">Short Volume Z-Score</span>
                  <span className="text-lg font-semibold text-white">{shortSqueeze.shortVolumeZ.toFixed(2)}</span>
                </div>
                <div className="text-xs text-blue-300 capitalize">
                  Trend: {shortSqueeze.shortVolumeTrend}
                </div>
              </div>
            )}

            {shortSqueeze.triggers.length > 0 && (
              <div className="mt-3 p-3 bg-green-500/5 border border-green-500/20 rounded-lg">
                <div className="text-xs font-semibold text-green-300 mb-2">Triggers:</div>
                <ul className="space-y-1">
                  {shortSqueeze.triggers.slice(0, 3).map((trigger, idx) => (
                    <li key={idx} className="text-xs text-green-200 flex items-start">
                      <span className="mr-2">•</span>
                      <span>{trigger}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* TTM Squeeze */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-purple-500/30">
            <h4 className="text-lg font-semibold text-white">TTM Squeeze</h4>
            <span className={`px-2 py-1 rounded text-xs font-medium border ${getSqueezeStateColor(ttmSqueeze.current.state)}`}>
              {getSqueezeStateIcon(ttmSqueeze.current.state)} {ttmSqueeze.current.state}
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-blue-200">Volatility State</span>
                <span className="text-lg font-semibold text-white">{ttmSqueeze.current.state}</span>
              </div>
              <div className="text-xs text-blue-300">
                {ttmSqueeze.current.state === 'FIRE' ? '🔥 Just FIRED - Breakout happening NOW!' :
                 ttmSqueeze.current.state === 'ON' ? `⚡ Building pressure (${ttmSqueeze.squeezeDuration} bars)` :
                 '⚪ No squeeze active'}
              </div>
            </div>

            {ttmSqueeze.current.state !== 'OFF' && (
              <>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-blue-200">Duration</span>
                    <span className="text-lg font-semibold text-white">{ttmSqueeze.squeezeDuration} bars</span>
                  </div>
                  <div className="text-xs text-blue-300">
                    {ttmSqueeze.squeezeDuration >= 10 ? 'Extended squeeze = bigger potential move' :
                     ttmSqueeze.squeezeDuration >= 5 ? 'Solid compression duration' :
                     'Recently entered squeeze'}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-blue-200">Momentum Direction</span>
                    <span className={`text-lg font-semibold ${
                      ttmSqueeze.current.momentumDirection === 'bullish' ? 'text-green-400' :
                      ttmSqueeze.current.momentumDirection === 'bearish' ? 'text-red-400' :
                      'text-gray-400'
                    }`}>
                      {ttmSqueeze.current.momentumDirection.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-xs text-blue-300">
                    Strength: {ttmSqueeze.current.momentumStrength.toFixed(0)}% • Histogram: {ttmSqueeze.current.histogram.toFixed(3)}
                  </div>
                </div>

                {ttmSqueeze.fireConfirmed && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">✅</span>
                      <div>
                        <div className="text-sm font-semibold text-red-300">Fire Confirmed!</div>
                        <div className="text-xs text-red-200">
                          Breakout with {ttmSqueeze.potentialBreakout} momentum
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {ttmSqueeze.triggers.length > 0 && (
              <div className="mt-3 p-3 bg-purple-500/5 border border-purple-500/20 rounded-lg">
                <div className="text-xs font-semibold text-purple-300 mb-2">Triggers:</div>
                <ul className="space-y-1">
                  {ttmSqueeze.triggers.slice(0, 3).map((trigger, idx) => (
                    <li key={idx} className="text-xs text-purple-200 flex items-start">
                      <span className="mr-2">•</span>
                      <span>{trigger}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Combined Recommendation */}
      <div className="mt-6 p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
        <div className="text-sm font-semibold text-blue-300 mb-2">Combined Analysis:</div>
        <div className="text-sm text-blue-100 leading-relaxed">{combined.recommendation}</div>
      </div>

      {/* Warnings */}
      {combined.warnings.length > 0 && (
        <div className="mt-4 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
          <div className="text-sm font-semibold text-yellow-300 mb-2">⚠️ Squeeze Risks:</div>
          <ul className="space-y-1">
            {combined.warnings.slice(0, 3).map((warning, idx) => (
              <li key={idx} className="text-sm text-yellow-200 flex items-start">
                <span className="mr-2">•</span>
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

