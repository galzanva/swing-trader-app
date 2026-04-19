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
  
  const combined = {
    score: squeezeAnalysis.combinedScore,
    potential: squeezeAnalysis.combinedPotential,
    alignment: squeezeAnalysis.alignment,
    recommendation: squeezeAnalysis.recommendation,
    triggers: squeezeAnalysis.triggers,
    warnings: squeezeAnalysis.warnings,
  };

  const getSqueezeStateColor = (state: 'ON' | 'FIRE' | 'OFF') => {
    switch (state) {
      case 'FIRE': return 'text-loss bg-loss/10 border-loss/30';
      case 'ON': return 'text-text-secondary bg-surface-3 border-border';
      case 'OFF': return 'text-text-muted bg-surface-3 border-border';
    }
  };

  const getPotentialColor = (potential: string) => {
    switch (potential) {
      case 'extreme': return 'text-loss';
      case 'high': return 'text-loss';
      case 'moderate': return 'text-text-secondary';
      case 'low': return 'text-text-muted';
      default: return 'text-text-muted';
    }
  };

  return (
    <div className="bg-surface-1 border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-text-primary">Squeeze Analysis</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-secondary">Combined Score:</span>
          <span className={`text-2xl font-bold ${getPotentialColor(combined.potential)}`}>
            {combined.score}/100
          </span>
          <span className={`px-3 py-1 rounded-full text-xs font-medium border bg-surface-3 border-border ${getPotentialColor(combined.potential)}`}>
            {combined.potential.toUpperCase()}
          </span>
        </div>
      </div>

      {combined.alignment && (
        <div className="mb-4 p-4 bg-surface-2 border border-border rounded-lg">
          <div className="flex items-center gap-2">
            <div>
              <div className="text-lg font-semibold text-text-primary">Both Squeezes Aligned</div>
              <div className="text-sm text-text-secondary">Short interest pressure + volatility compression = enhanced breakout potential</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Short Float Squeeze */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <h4 className="text-lg font-semibold text-text-primary">Short Float Squeeze</h4>
            <span className={`px-2 py-1 rounded text-xs font-medium border bg-surface-3 border-border ${getPotentialColor(shortSqueeze.potential)}`}>
              {shortSqueeze.potential.toUpperCase()}
            </span>
          </div>

          <div className="space-y-3">
            {shortSqueeze.daysToCover !== null && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-text-secondary">Days to Cover</span>
                  <span className="text-lg font-semibold text-text-primary">{shortSqueeze.daysToCover.toFixed(1)} days</span>
                </div>
                <div className="text-xs text-text-muted">
                  {shortSqueeze.daysToCover > 7 ? 'VERY HIGH - Shorts highly trapped' :
                   shortSqueeze.daysToCover > 4 ? 'ELEVATED - Meaningful short interest' :
                   'MODEST - Limited squeeze catalyst'}
                </div>
              </div>
            )}

            {shortSqueeze.shortFloat !== null && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-text-secondary">Short Float %</span>
                  <span className="text-lg font-semibold text-text-primary">{shortSqueeze.shortFloat.toFixed(1)}%</span>
                </div>
                <div className="text-xs text-text-muted">
                  {shortSqueeze.shortFloat > 20 ? 'EXTREME - Heavily shorted' :
                   shortSqueeze.shortFloat > 10 ? 'SIGNIFICANT - Notable short interest' :
                   'LIGHT - Limited short pressure'}
                </div>
              </div>
            )}

            {shortSqueeze.shortVolumeZ !== null && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-text-secondary">Short Volume Z-Score</span>
                  <span className="text-lg font-semibold text-text-primary">{shortSqueeze.shortVolumeZ.toFixed(2)}</span>
                </div>
                <div className="text-xs text-text-muted capitalize">
                  Trend: {shortSqueeze.shortVolumeTrend}
                </div>
              </div>
            )}

            {shortSqueeze.triggers.length > 0 && (
              <div className="mt-3 p-3 bg-profit/10 border border-profit/20 rounded-lg">
                <div className="text-xs font-semibold text-profit mb-2">Triggers:</div>
                <ul className="space-y-1">
                  {shortSqueeze.triggers.slice(0, 3).map((trigger, idx) => (
                    <li key={idx} className="text-xs text-profit flex items-start">
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
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <h4 className="text-lg font-semibold text-text-primary">TTM Squeeze</h4>
            <span className={`px-2 py-1 rounded text-xs font-medium border ${getSqueezeStateColor(ttmSqueeze.current.state)}`}>
              {ttmSqueeze.current.state}
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-text-secondary">Volatility State</span>
                <span className="text-lg font-semibold text-text-primary">{ttmSqueeze.current.state}</span>
              </div>
              <div className="text-xs text-text-muted">
                {ttmSqueeze.current.state === 'FIRE' ? 'Just FIRED - Breakout happening NOW!' :
                 ttmSqueeze.current.state === 'ON' ? `Building pressure (${ttmSqueeze.squeezeDuration} bars)` :
                 'No squeeze active'}
              </div>
            </div>

            {ttmSqueeze.current.state !== 'OFF' && (
              <>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-text-secondary">Duration</span>
                    <span className="text-lg font-semibold text-text-primary">{ttmSqueeze.squeezeDuration} bars</span>
                  </div>
                  <div className="text-xs text-text-muted">
                    {ttmSqueeze.squeezeDuration >= 10 ? 'Extended squeeze = bigger potential move' :
                     ttmSqueeze.squeezeDuration >= 5 ? 'Solid compression duration' :
                     'Recently entered squeeze'}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-text-secondary">Momentum Direction</span>
                    <span className={`text-lg font-semibold ${
                      ttmSqueeze.current.momentumDirection === 'bullish' ? 'text-profit' :
                      ttmSqueeze.current.momentumDirection === 'bearish' ? 'text-loss' :
                      'text-text-muted'
                    }`}>
                      {ttmSqueeze.current.momentumDirection.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-xs text-text-muted">
                    Strength: {ttmSqueeze.current.momentumStrength.toFixed(0)}% • Histogram: {ttmSqueeze.current.histogram.toFixed(3)}
                  </div>
                </div>

                {ttmSqueeze.fireConfirmed && (
                  <div className="p-3 bg-surface-2 border border-border rounded-lg">
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="text-sm font-semibold text-text-primary">Fire Confirmed</div>
                        <div className="text-xs text-text-secondary">
                          Breakout with {ttmSqueeze.potentialBreakout} momentum
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {ttmSqueeze.triggers.length > 0 && (
              <div className="mt-3 p-3 bg-surface-2 border border-border rounded-lg">
                <div className="text-xs font-semibold text-text-secondary mb-2">Triggers:</div>
                <ul className="space-y-1">
                  {ttmSqueeze.triggers.slice(0, 3).map((trigger, idx) => (
                    <li key={idx} className="text-xs text-text-secondary flex items-start">
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
      <div className="mt-6 p-4 bg-surface-2 border border-border rounded-lg">
        <div className="text-sm font-semibold text-text-secondary mb-2">Combined Analysis:</div>
        <div className="text-sm text-text-primary leading-relaxed">{combined.recommendation}</div>
      </div>

      {/* Warnings */}
      {combined.warnings.length > 0 && (
        <div className="mt-4 p-4 bg-surface-2 border border-border rounded-lg">
          <div className="text-sm font-semibold text-loss mb-2">Squeeze Risks:</div>
          <ul className="space-y-1">
            {combined.warnings.slice(0, 3).map((warning, idx) => (
              <li key={idx} className="text-sm text-text-secondary flex items-start">
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
