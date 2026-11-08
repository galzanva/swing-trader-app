'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

type Shot = { id: string; url: string };

// Chart screenshots need their detail: keep up to 2560px and good JPEG quality.
const MAX_SIDE = 2560;
const QUALITY = 0.86;

async function compressImage(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not read image');
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not read image'))), 'image/jpeg', QUALITY);
  });
}

function Viewer({ shots, index, onIndex, onClose }: {
  shots: Shot[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const [zoomed, setZoomed] = useState(false);
  const shot = shots[index];

  useEffect(() => { setZoomed(false); }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && index < shots.length - 1) onIndex(index + 1);
      if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1);
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [index, shots.length, onIndex, onClose]);

  if (!shot) return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] bg-black/95 flex flex-col" role="dialog" aria-label="Screenshot">
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-white/80">
        <span>{shots.length > 1 ? `${index + 1} of ${shots.length}` : 'Screenshot'} · click the image to {zoomed ? 'fit the screen' : 'see full size'}</span>
        <div className="flex items-center gap-3">
          <a href={shot.url} target="_blank" rel="noreferrer" className="hover:text-white underline">Open in new tab</a>
          <button type="button" onClick={onClose} className="px-3 py-1 rounded-lg border border-white/30 hover:bg-white/10">Close</button>
        </div>
      </div>
      <div
        className={`relative flex-1 ${zoomed ? 'overflow-auto' : 'overflow-hidden flex items-center justify-center p-4'}`}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <img
          src={shot.url}
          alt="Trade screenshot"
          onClick={() => setZoomed((z) => !z)}
          className={zoomed
            ? 'max-w-none cursor-zoom-out'
            : 'max-h-full max-w-full object-contain cursor-zoom-in select-none'}
        />
        {index > 0 && (
          <button
            type="button"
            onClick={() => onIndex(index - 1)}
            className="fixed left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 border border-white/30 text-white text-lg"
            aria-label="Previous screenshot"
          >
            ‹
          </button>
        )}
        {index < shots.length - 1 && (
          <button
            type="button"
            onClick={() => onIndex(index + 1)}
            className="fixed right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 border border-white/30 text-white text-lg"
            aria-label="Next screenshot"
          >
            ›
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}

export default function TradeScreenshots({ tradeId }: { tradeId: string | null }) {
  const [shots, setShots] = useState<Shot[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState<number | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

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
      const image = await compressImage(file);
      const form = new FormData();
      form.append('file', image, 'screenshot.jpg');
      const res = await fetch(`/api/journal/${tradeId}/screenshots`, { method: 'POST', body: form });
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
    if (!tradeId || removing) return;
    setRemoving(shotId);
    setError('');
    try {
      const res = await fetch(`/api/journal/${tradeId}/screenshots?shotId=${encodeURIComponent(shotId)}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error || 'Could not delete the screenshot. Try again.');
        return;
      }
      setShots((prev) => prev.filter((s) => s.id !== shotId));
    } finally {
      setRemoving(null);
    }
  };

  if (!tradeId) {
    return <p className="text-sm text-text-muted">Save the trade first, then you can attach screenshots.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {shots.map((s, i) => (
          <div key={s.id} className="relative">
            <button type="button" onClick={() => setViewing(i)} className="block" title="View full size">
              <img src={s.url} alt="Trade screenshot" className="h-24 w-36 object-cover rounded-lg border border-border cursor-zoom-in" />
            </button>
            <button
              type="button"
              onClick={() => void remove(s.id)}
              disabled={removing === s.id}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-surface-1 border border-border text-text-muted hover:text-loss text-xs disabled:opacity-50"
              title="Delete permanently"
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
      <p className="text-xs text-text-muted">Optional. Up to 4 images, stored privately with the trade. × deletes it for good.</p>
      {viewing !== null && (
        <Viewer shots={shots} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}
