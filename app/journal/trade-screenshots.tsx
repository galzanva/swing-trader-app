'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { compressImage } from './screenshot-image';
import ScreenshotEditor from './trade-screenshot-editor';

type Shot = { id: string; url: string };

function bust(url: string) {
  return `${url.split('?')[0]}?v=${Date.now()}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function Viewer({
  shots,
  index,
  tradeId,
  onIndex,
  onClose,
  onReplaced,
}: {
  shots: Shot[];
  index: number;
  tradeId: string;
  onIndex: (i: number) => void;
  onClose: () => void;
  onReplaced: (id: string, url: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const viewRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  const drag = useRef<{ x: number; y: number } | null>(null);
  zoomRef.current = zoom;
  panRef.current = pan;
  const shot = shots[index];

  const fit = useCallback(() => {
    const view = viewRef.current;
    const img = imgRef.current;
    if (!view || !img?.naturalWidth) return;
    const z = Math.min(view.clientWidth / img.naturalWidth, view.clientHeight / img.naturalHeight);
    setZoom(z);
    setPan({
      x: (view.clientWidth - img.naturalWidth * z) / 2,
      y: (view.clientHeight - img.naturalHeight * z) / 2,
    });
  }, []);

  useEffect(() => {
    setEditing(false);
    const img = imgRef.current;
    if (!img) return;
    const onLoad = () => fit();
    if (img.complete && img.naturalWidth) fit();
    else img.addEventListener('load', onLoad);
    return () => img.removeEventListener('load', onLoad);
  }, [index, shot?.url, fit]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editing) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && index < shots.length - 1) onIndex(index + 1);
      if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1);
      if (e.key === '0') fit();
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [index, shots.length, onIndex, onClose, editing, fit]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || editing) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = view.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const z = zoomRef.current;
      const p = panRef.current;
      const next = clamp(z * (e.deltaY < 0 ? 1.12 : 1 / 1.12), 0.15, 8);
      setZoom(next);
      setPan({ x: mx - ((mx - p.x) / z) * next, y: my - ((my - p.y) / z) * next });
    };
    view.addEventListener('wheel', onWheel, { passive: false });
    return () => view.removeEventListener('wheel', onWheel);
  }, [editing]);

  if (!shot) return null;

  const saveEdit = async (blob: Blob) => {
    const form = new FormData();
    form.append('file', blob, 'screenshot.jpg');
    const res = await fetch(`/api/journal/${tradeId}/screenshots/${shot.id}`, { method: 'PUT', body: form });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Save failed');
    onReplaced(shot.id, bust(json.screenshot?.url || shot.url));
    setEditing(false);
  };

  return createPortal(
    <div className="fixed inset-0 z-[120] bg-black flex flex-col" role="dialog" aria-label={editing ? 'Edit screenshot' : 'Screenshot'}>
      {!editing && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-white/80">
          <span>
            {shots.length > 1 ? `${index + 1} of ${shots.length}` : 'Screenshot'}
            {' · '}scroll to zoom, drag to move
          </span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={fit} className="px-3 py-1 rounded-lg border border-white/30 hover:bg-white/10">Fit</button>
            <button type="button" onClick={() => setEditing(true)} className="px-3 py-1 rounded-lg bg-accent text-white">Edit</button>
            <button type="button" onClick={onClose} className="px-3 py-1 rounded-lg border border-white/30 hover:bg-white/10">Close</button>
          </div>
        </div>
      )}
      {editing ? (
        <ScreenshotEditor src={shot.url} onCancel={() => setEditing(false)} onSaved={saveEdit} />
      ) : (
        <div
          ref={viewRef}
          className="relative flex-1 overflow-hidden touch-none cursor-grab active:cursor-grabbing"
          onPointerDown={(e) => {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            const dx = e.clientX - drag.current.x;
            const dy = e.clientY - drag.current.y;
            drag.current = { x: e.clientX, y: e.clientY };
            setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
          }}
          onPointerUp={() => { drag.current = null; }}
          onPointerCancel={() => { drag.current = null; }}
          onDoubleClick={fit}
        >
          <img
            ref={imgRef}
            src={shot.url}
            alt="Trade screenshot"
            draggable={false}
            className="absolute top-0 left-0 max-w-none select-none origin-top-left"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          />
          {index > 0 && (
            <button
              type="button"
              onClick={() => onIndex(index - 1)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 border border-white/30 text-white text-lg"
              aria-label="Previous screenshot"
            >
              ‹
            </button>
          )}
          {index < shots.length - 1 && (
            <button
              type="button"
              onClick={() => onIndex(index + 1)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 border border-white/30 text-white text-lg"
              aria-label="Next screenshot"
            >
              ›
            </button>
          )}
        </div>
      )}
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
      <p className="text-xs text-text-muted">Optional. Up to 4 images, stored privately with the trade. × deletes it for good. Open one to mark it up — save replaces that file.</p>
      {viewing !== null && (
        <Viewer
          shots={shots}
          index={viewing}
          tradeId={tradeId}
          onIndex={setViewing}
          onClose={() => setViewing(null)}
          onReplaced={(id, url) => setShots((prev) => prev.map((s) => (s.id === id ? { ...s, url } : s)))}
        />
      )}
    </div>
  );
}
