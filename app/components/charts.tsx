'use client';

import { useMemo, useState, useRef } from 'react';

/* ── Horizontal bar chart — category breakdowns ──────────────── */

interface HBarDatum {
  label: string;
  value: number;
  extra?: string;
}

export function HBarChart({
  data,
  title,
  valueFormatter = (v) => v.toFixed(2),
  colorByValue = true,
}: {
  data: HBarDatum[];
  title?: string;
  valueFormatter?: (v: number) => string;
  colorByValue?: boolean;
}) {
  const maxAbs = useMemo(() => Math.max(...data.map(d => Math.abs(d.value)), 1), [data]);

  if (data.length === 0) return null;

  return (
    <div className="bg-surface-1 border border-border rounded-2xl overflow-hidden">
      {title && (
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-text-primary">{title}</h3>
        </div>
      )}
      <div className="p-5 lg:p-6 space-y-3">
        {data.map((d) => {
          const pct = Math.abs(d.value) / maxAbs * 100;
          const isPos = d.value >= 0;
          const barColor = colorByValue
            ? isPos ? 'bg-profit' : 'bg-loss'
            : 'bg-accent';
          return (
            <div key={d.label} className="flex items-center gap-3 lg:gap-4">
              <div className="w-28 sm:w-36 lg:w-40 text-sm text-text-secondary truncate shrink-0 text-right">{d.label}</div>
              <div className="flex-1 h-8 bg-surface-2 rounded-lg relative overflow-hidden">
                <div
                  className={`h-full rounded-lg ${barColor} opacity-80 transition-all duration-300`}
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
                <span className="absolute inset-y-0 right-2 flex items-center text-sm font-semibold tabular-nums text-text-primary">
                  {valueFormatter(d.value)}
                </span>
              </div>
              {d.extra && <span className="text-sm text-text-muted shrink-0 w-20 sm:w-24 text-right">{d.extra}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Line/Area chart — cumulative P/L ────────────────────────── */

interface LinePoint {
  label: string;
  value: number;
  detail?: string;
}

export function LineChart({
  data,
  title,
  height = 200,
  valueFormatter = (v) => v.toFixed(2),
}: {
  data: LinePoint[];
  title?: string;
  height?: number;
  valueFormatter?: (v: number) => string;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { minVal, maxVal, range } = useMemo(() => {
    const vals = data.map(d => d.value);
    const mn = Math.min(...vals, 0);
    const mx = Math.max(...vals, 0);
    const r = mx - mn || 1;
    return { minVal: mn, maxVal: mx, range: r };
  }, [data]);

  if (data.length < 2) return null;

  const pad = 8;
  const chartH = height - pad * 2;

  const toYPct = (v: number) => pad + chartH - ((v - minVal) / range) * chartH;
  const toXPct = (i: number) => (i / (data.length - 1)) * 100;

  const zeroYPct = ((maxVal) / range) * 100;

  const handleMouse = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const xFrac = (e.clientX - rect.left) / rect.width;
    const idx = Math.round(xFrac * (data.length - 1));
    setHoverIdx(Math.max(0, Math.min(data.length - 1, idx)));
  };

  const labelInterval = Math.max(1, Math.floor(data.length / 6));

  const svgPoints = data.map((d, i) => `${toXPct(i)},${toYPct(d.value)}`);
  const linePath = svgPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p}`).join(' ');
  const areaPath = linePath + ` L${toXPct(data.length - 1)},${toYPct(0)} L${toXPct(0)},${toYPct(0)} Z`;
  const isPositive = data[data.length - 1].value >= 0;
  const lineColor = isPositive ? '#22c55e' : '#ef4444';
  const areaColor = isPositive ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)';

  return (
    <div className="bg-surface-1 border border-border rounded-2xl overflow-hidden">
      {title && (
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-text-primary">{title}</h3>
        </div>
      )}
      <div className="px-5 lg:px-6 pt-5 pb-3">
        {/* Y-axis labels */}
        <div className="flex justify-between text-xs text-text-muted mb-2 tabular-nums">
          <span>{valueFormatter(maxVal)}</span>
          {minVal < 0 && <span>{valueFormatter(minVal)}</span>}
        </div>

        {/* Chart area */}
        <div
          ref={containerRef}
          className="relative w-full cursor-crosshair"
          style={{ height: `${height}px` }}
          onMouseMove={handleMouse}
          onMouseLeave={() => setHoverIdx(null)}
        >
          <svg
            viewBox={`0 0 100 ${height}`}
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full"
          >
            {/* Zero line */}
            <line x1={0} y1={toYPct(0)} x2={100} y2={toYPct(0)}
              stroke="var(--color-border)" strokeWidth={0.3} strokeDasharray="1,1"
              vectorEffect="non-scaling-stroke" />
            {/* Area */}
            <path d={areaPath} fill={areaColor} />
            {/* Line */}
            <path d={linePath} fill="none" stroke={lineColor} strokeWidth={2}
              vectorEffect="non-scaling-stroke" />
          </svg>

          {/* Hover crosshair + dot (HTML positioned, not SVG) */}
          {hoverIdx !== null && (
            <>
              <div
                className="absolute top-0 bottom-0 w-px bg-text-muted/30 pointer-events-none"
                style={{ left: `${toXPct(hoverIdx)}%` }}
              />
              <div
                className="absolute w-3 h-3 rounded-full pointer-events-none border-2"
                style={{
                  left: `${toXPct(hoverIdx)}%`,
                  top: `${toYPct(data[hoverIdx].value)}px`,
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: lineColor,
                  borderColor: 'var(--color-bg)',
                }}
              />
            </>
          )}

          {/* Tooltip */}
          {hoverIdx !== null && (
            <div
              className="absolute bg-surface-4 text-sm text-text-primary px-4 py-3 rounded-xl shadow-lg pointer-events-none z-10 whitespace-nowrap"
              style={{
                left: `${Math.min(80, Math.max(5, toXPct(hoverIdx)))}%`,
                top: '8px',
                transform: 'translateX(-50%)',
              }}
            >
              <div className="font-semibold">{data[hoverIdx].label}</div>
              <div className={`text-base font-bold tabular-nums ${data[hoverIdx].value >= 0 ? 'text-profit' : 'text-loss'}`}>
                {valueFormatter(data[hoverIdx].value)}
              </div>
              {data[hoverIdx].detail && (
                <div className="text-text-muted text-sm mt-0.5">{data[hoverIdx].detail}</div>
              )}
            </div>
          )}
        </div>

        {/* X-axis labels */}
        <div className="flex justify-between mt-2 gap-1">
          {data.map((d, i) => (
            i % labelInterval === 0 || i === data.length - 1 ? (
              <span key={i} className="text-xs text-text-muted tabular-nums">{d.label}</span>
            ) : null
          )).filter(Boolean)}
        </div>
      </div>
    </div>
  );
}

/* ── Vertical bar chart — daily P/L ──────────────────────────── */

interface VBarPoint {
  label: string;
  value: number;
  tooltip?: string;
}

export function VBarChart({
  data,
  title,
  height = 200,
}: {
  data: VBarPoint[];
  title?: string;
  height?: number;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { maxVal, minVal } = useMemo(() => {
    const vals = data.map(d => d.value);
    return {
      maxVal: Math.max(...vals, 0),
      minVal: Math.min(...vals, 0),
    };
  }, [data]);

  if (data.length === 0) return null;

  const range = maxVal - minVal || 1;
  const zeroFrac = maxVal / range;
  const zeroY = zeroFrac * height;

  const labelInterval = Math.max(1, Math.floor(data.length / 8));

  return (
    <div className="bg-surface-1 border border-border rounded-2xl overflow-hidden">
      {title && (
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-text-primary">{title}</h3>
        </div>
      )}
      <div className="p-5 lg:p-6">
        <div ref={containerRef} className="relative overflow-x-auto">
          <div className="flex items-stretch gap-px" style={{ height: `${height}px` }}>
            {data.map((p, i) => {
              const barFrac = Math.abs(p.value) / range;
              const barH = barFrac * height;
              const isPos = p.value >= 0;
              return (
                <div
                  key={i}
                  className="relative flex-1 min-w-[3px]"
                  style={{ height: `${height}px` }}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                >
                  <div
                    className={`absolute left-0 right-0 rounded-sm ${isPos ? 'bg-profit' : 'bg-loss'}`}
                    style={{
                      height: `${barH}px`,
                      top: isPos ? `${zeroY - barH}px` : `${zeroY}px`,
                      opacity: hoveredIdx === i ? 1 : 0.7,
                    }}
                  />
                </div>
              );
            })}
          </div>
          {/* Zero line */}
          <div className="absolute left-0 right-0 border-t border-text-muted/30" style={{ top: `${zeroY}px` }} />

          {/* Tooltip */}
          {hoveredIdx !== null && data[hoveredIdx].tooltip && (
            <div
              className="absolute top-2 bg-surface-4 text-sm text-text-primary px-4 py-3 rounded-xl shadow-lg pointer-events-none z-10 whitespace-nowrap"
              style={{
                left: `${Math.min(85, Math.max(5, (hoveredIdx / data.length) * 100))}%`,
                transform: 'translateX(-50%)',
              }}
            >
              {data[hoveredIdx].tooltip}
            </div>
          )}
        </div>
        {/* X-axis labels */}
        {data.length > 0 && (
          <div className="flex justify-between mt-2 px-1 overflow-hidden gap-1">
            {data.map((d, i) => (
              i % labelInterval === 0 || i === data.length - 1 ? (
                <span key={i} className="text-xs text-text-muted tabular-nums">{d.label}</span>
              ) : null
            )).filter(Boolean)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Win Rate Donut ──────────────────────────────────────────── */

export function WinRateRing({ winRate, size = 80 }: { winRate: number; size?: number }) {
  const stroke = Math.max(6, Math.round(size * 0.055));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (winRate / 100) * circumference;
  const labelClass =
    size >= 112 ? 'text-2xl' : size >= 96 ? 'text-xl' : size >= 88 ? 'text-lg' : 'text-sm';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} stroke="var(--color-surface-3)" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} stroke={winRate >= 50 ? '#22c55e' : '#ef4444'} fill="none"
          strokeDasharray={circumference} strokeDashoffset={circumference - filled} strokeLinecap="round" />
      </svg>
      <span className={`absolute font-bold tabular-nums text-text-primary ${labelClass}`}>{winRate}%</span>
    </div>
  );
}
