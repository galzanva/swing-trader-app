'use client';

import { useCallback, useEffect, useState } from 'react';

type Shot = { id: string; data: string };

async function compressImage(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const max = 1400;
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not read image');
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return canvas.toDataURL('image/jpeg', 0.72);
}

export default function TradeScreenshots({ tradeId }: { tradeId: string | null }) {
  const [shots, setShots] = useState<Shot[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (id: string) => {
    const res = await fetch(`/api/journal/${id}/screenshots`);
    const data = await res.json();
    if (data.success) setShots(data.screenshots || []);
  }, []);

  useEffect(() => {
    if (!tradeId) {
      setShots([]);
      return;
    }
    void load(tradeId);
  }, [tradeId, load]);

  const onFile = async (file: File | undefined) => {
    if (!file || !tradeId) return;
    setBusy(true);
    setError('');
    try {
      const dataUrl = await compressImage(file);
      const res = await fetch(`/api/journal/${tradeId}/screenshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: dataUrl }),
      });
      const json = await res.json();
      if (!res.ok) setError(json.error || 'Upload failed');
      else setShots((prev) => [...prev, json.screenshot]);
    } catch {
      setError('Could not read that image');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (shotId: string) => {
    if (!tradeId) return;
    await fetch(`/api/journal/${tradeId}/screenshots?shotId=${encodeURIComponent(shotId)}`, { method: 'DELETE' });
    setShots((prev) => prev.filter((s) => s.id !== shotId));
  };

  if (!tradeId) {
    return <p className="text-sm text-text-muted">Save the trade first, then you can attach screenshots.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {shots.map((s) => (
          <div key={s.id} className="relative">
            <a href={s.data} target="_blank" rel="noreferrer">
              <img src={s.data} alt="Trade screenshot" className="h-24 w-36 object-cover rounded-lg border border-border" />
            </a>
            <button
              type="button"
              onClick={() => void remove(s.id)}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-surface-1 border border-border text-text-muted hover:text-loss text-xs"
              title="Remove"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {shots.length < 4 && (
        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-surface-2 text-sm text-text-secondary cursor-pointer hover:bg-surface-3">
          {busy ? 'Attaching…' : 'Attach screenshot'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              void onFile(file);
            }}
          />
        </label>
      )}
      {error && <p className="text-sm text-loss">{error}</p>}
      <p className="text-xs text-text-muted">Optional. Up to 4 images, stored with the trade.</p>
    </div>
  );
}
