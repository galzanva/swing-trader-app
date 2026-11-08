'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { compressImage } from './screenshot-image';

type Tool = 'select' | 'pan' | 'pen' | 'highlight' | 'arrow' | 'box' | 'circle' | 'text';
type Point = { x: number; y: number };
type Anno =
  | { kind: 'pen'; color: string; width: number; alpha: number; points: Point[]; rot: number }
  | { kind: 'arrow'; color: string; width: number; from: Point; to: Point; rot: number }
  | { kind: 'box'; color: string; width: number; x: number; y: number; w: number; h: number; rot: number }
  | { kind: 'circle'; color: string; width: number; x: number; y: number; w: number; h: number; rot: number }
  | { kind: 'text'; color: string; bg: string | null; x: number; y: number; size: number; text: string; rot: number };

type Bounds = { x: number; y: number; w: number; h: number; cx: number; cy: number };

let measureCtx: CanvasRenderingContext2D | null = null;
const LINE = 1.35;

function textWidth(text: string, size: number) {
  if (typeof document === 'undefined') return Math.max(8, text.length * size * 0.6);
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  if (!measureCtx) return Math.max(8, text.length * size * 0.6);
  measureCtx.font = `700 ${size}px ui-sans-serif, system-ui, sans-serif`;
  return Math.max(8, measureCtx.measureText(text).width);
}

function textBlock(text: string, size: number) {
  const lines = text.split('\n');
  const safe = lines.length ? lines : [''];
  const w = Math.max(...safe.map((line) => textWidth(line, size)));
  const h = size * LINE * safe.length;
  return { lines: safe, w, h };
}

const COLORS = ['#ef4444', '#22c55e', '#eab308', '#38bdf8', '#f8fafc'] as const;
const WIDTHS = [4, 8, 16, 28] as const;

function textPad(size: number) {
  return Math.max(10, size * 0.42);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function capturePointer(el: HTMLElement, pointerId: number) {
  try { el.setPointerCapture(pointerId); } catch { /* pointer already released */ }
}

function drawArrow(ctx: CanvasRenderingContext2D, from: Point, to: Point, color: string, width: number) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const head = Math.min(72, Math.max(14, width * 3.5));
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x - ux * head * 0.6, to.y - uy * head * 0.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - ux * head + uy * head * 0.4, to.y - uy * head - ux * head * 0.4);
  ctx.lineTo(to.x - ux * head - uy * head * 0.4, to.y - uy * head + ux * head * 0.4);
  ctx.closePath();
  ctx.fill();
}

function boundsOf(anno: Anno): Bounds {
  if (anno.kind === 'text') {
    const block = textBlock(anno.text, anno.size);
    const top = anno.y - anno.size;
    return { x: anno.x, y: top, w: block.w, h: block.h, cx: anno.x + block.w / 2, cy: top + block.h / 2 };
  }
  if (anno.kind === 'box' || anno.kind === 'circle') {
    return { x: anno.x, y: anno.y, w: anno.w, h: anno.h, cx: anno.x + anno.w / 2, cy: anno.y + anno.h / 2 };
  }
  const pts = anno.kind === 'arrow' ? [anno.from, anno.to] : anno.points;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  const pad = anno.kind === 'pen' ? anno.width : 14;
  return {
    x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2,
    cx: (minX + maxX) / 2, cy: (minY + maxY) / 2,
  };
}

function spin(cx: number, cy: number, p: Point, rot: number): Point {
  const dx = p.x - cx;
  const dy = p.y - cy;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c };
}

function unspin(cx: number, cy: number, p: Point, rot: number): Point {
  return spin(cx, cy, p, -rot);
}

function distToSeg(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function hits(anno: Anno, pt: Point): boolean {
  const b = boundsOf(anno);
  const local = unspin(b.cx, b.cy, pt, anno.rot);
  if (anno.kind === 'arrow') return distToSeg(local, anno.from, anno.to) <= Math.max(14, anno.width + 8);
  if (anno.kind === 'pen') {
    const reach = Math.max(12, anno.width / 2 + 6);
    for (let i = 1; i < anno.points.length; i++) {
      if (distToSeg(local, anno.points[i - 1], anno.points[i]) <= reach) return true;
    }
    return false;
  }
  if (anno.kind === 'circle') {
    const rx = Math.max(8, anno.w / 2 + anno.width / 2 + 8);
    const ry = Math.max(8, anno.h / 2 + anno.width / 2 + 8);
    const nx = (local.x - (anno.x + anno.w / 2)) / rx;
    const ny = (local.y - (anno.y + anno.h / 2)) / ry;
    return nx * nx + ny * ny <= 1;
  }
  const pad = anno.kind === 'text' && anno.bg ? textPad(anno.size) : anno.kind === 'box' ? anno.width / 2 + 6 : 0;
  return local.x >= b.x - pad && local.x <= b.x + b.w + pad && local.y >= b.y - pad && local.y <= b.y + b.h + pad;
}

function scaleAround(p: Point, c: Point, f: number): Point {
  return { x: c.x + (p.x - c.x) * f, y: c.y + (p.y - c.y) * f };
}

function resizeAnno(start: Anno, pt: Point, center: Point, startDist: number): Anno {
  if (start.kind === 'box' || start.kind === 'circle') {
    const local = unspin(center.x, center.y, pt, start.rot);
    const w = clamp(Math.abs(local.x - center.x) * 2, 8, 4000);
    const h = clamp(Math.abs(local.y - center.y) * 2, 8, 4000);
    return { ...start, w, h, x: center.x - w / 2, y: center.y - h / 2 };
  }
  const dist = Math.hypot(pt.x - center.x, pt.y - center.y) || 1;
  const f = clamp(dist / startDist, 0.2, 8);
  if (start.kind === 'text') {
    const size = clamp(start.size * f, 12, 240);
    const block = textBlock(start.text, size);
    return { ...start, size, x: center.x - block.w / 2, y: center.y - block.h / 2 + size };
  }
  if (start.kind === 'arrow') {
    return {
      ...start,
      width: clamp(start.width * f, 2, 28),
      from: scaleAround(start.from, center, f),
      to: scaleAround(start.to, center, f),
    };
  }
  return {
    ...start,
    width: clamp(start.width * f, 2, 80),
    points: start.points.map((p) => scaleAround(p, center, f)),
  };
}

function translateAnno(anno: Anno, dx: number, dy: number): Anno {
  if (anno.kind === 'text') return { ...anno, x: anno.x + dx, y: anno.y + dy };
  if (anno.kind === 'box' || anno.kind === 'circle') return { ...anno, x: anno.x + dx, y: anno.y + dy };
  if (anno.kind === 'arrow') {
    return { ...anno, from: { x: anno.from.x + dx, y: anno.from.y + dy }, to: { x: anno.to.x + dx, y: anno.to.y + dy } };
  }
  return { ...anno, points: anno.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
}

function paintAnno(ctx: CanvasRenderingContext2D, anno: Anno) {
  const b = boundsOf(anno);
  ctx.save();
  ctx.translate(b.cx, b.cy);
  ctx.rotate(anno.rot);
  ctx.translate(-b.cx, -b.cy);
  paintRaw(ctx, anno);
  ctx.restore();
}

function paintRaw(ctx: CanvasRenderingContext2D, anno: Anno) {
  if (anno.kind === 'pen') {
    if (anno.points.length < 2) return;
    ctx.save();
    ctx.globalAlpha = anno.alpha;
    ctx.strokeStyle = anno.color;
    ctx.lineWidth = anno.width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(anno.points[0].x, anno.points[0].y);
    for (let i = 1; i < anno.points.length; i++) ctx.lineTo(anno.points[i].x, anno.points[i].y);
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (anno.kind === 'arrow') {
    drawArrow(ctx, anno.from, anno.to, anno.color, anno.width);
    return;
  }
  if (anno.kind === 'box') {
    ctx.strokeStyle = anno.color;
    ctx.lineWidth = anno.width;
    ctx.strokeRect(anno.x, anno.y, anno.w, anno.h);
    return;
  }
  if (anno.kind === 'circle') {
    ctx.strokeStyle = anno.color;
    ctx.lineWidth = anno.width;
    ctx.beginPath();
    ctx.ellipse(anno.x + anno.w / 2, anno.y + anno.h / 2, Math.max(1, anno.w / 2), Math.max(1, anno.h / 2), 0, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }
  const block = textBlock(anno.text, anno.size);
  if (anno.bg) {
    const pad = textPad(anno.size);
    ctx.fillStyle = anno.bg;
    roundRect(ctx, anno.x - pad, anno.y - anno.size - pad, block.w + pad * 2, block.h + pad * 2, Math.max(6, anno.size * 0.25));
    ctx.fill();
  }
  ctx.font = `700 ${anno.size}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.lineWidth = Math.max(4, anno.size / 6);
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.fillStyle = anno.color;
  block.lines.forEach((line, i) => {
    const y = anno.y + i * anno.size * LINE;
    ctx.strokeText(line, anno.x, y);
    ctx.fillText(line, anno.x, y);
  });
}

function ToolBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-lg text-sm border ${
        active ? 'bg-white/20 border-white/60 text-white' : 'border-white/20 text-white/80 hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  );
}

export default function ScreenshotEditor({
  src,
  onCancel,
  onSaved,
}: {
  src: string;
  onCancel: () => void;
  onSaved: (blob: Blob) => Promise<void>;
}) {
  const viewRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState<string>(COLORS[0]);
  const [width, setWidth] = useState<number>(8);
  const [textBg, setTextBg] = useState<string | null>(null);
  const [annos, setAnnos] = useState<Anno[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [textDraft, setTextDraft] = useState<{
    x: number; y: number; screenX: number; screenY: number; value: string; editIndex: number | null;
  } | null>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const textDraftRef = useRef(textDraft);
  textDraftRef.current = textDraft;
  const textBgRef = useRef(textBg);
  textBgRef.current = textBg;
  const colorRef = useRef(color);
  colorRef.current = color;
  const widthRef = useRef(width);
  widthRef.current = width;
  const drag = useRef<{
    mode: 'pan' | 'draw' | 'arrow' | 'box' | 'circle' | 'move' | 'rotate' | 'resize' | null;
    last: Point;
    start: Point;
    space: boolean;
    index: number;
    startRot: number;
    center: Point;
    startAngle: number;
    startDist: number;
    startAnno: Anno | null;
  }>({
    mode: null, last: { x: 0, y: 0 }, start: { x: 0, y: 0 }, space: false,
    index: -1, startRot: 0, center: { x: 0, y: 0 }, startAngle: 0, startDist: 1, startAnno: null,
  });
  const annosRef = useRef(annos);
  annosRef.current = annos;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const live = useRef<Anno | null>(null);
  const size = useRef({ w: 0, h: 0 });
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  zoomRef.current = zoom;
  panRef.current = pan;

  const redraw = useCallback(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const skip = textDraftRef.current?.editIndex;
    const list = annosRef.current;
    for (let i = 0; i < list.length; i++) {
      if (i === skip) continue;
      paintAnno(ctx, list[i]);
    }
    if (live.current) paintAnno(ctx, live.current);
    const sel = selectedRef.current;
    const anno = sel != null ? list[sel] : null;
    if (anno && sel !== skip && toolRef.current === 'select') {
      const b = boundsOf(anno);
      ctx.save();
      ctx.translate(b.cx, b.cy);
      ctx.rotate(anno.rot);
      ctx.translate(-b.cx, -b.cy);
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.beginPath();
      ctx.moveTo(b.cx, b.y);
      ctx.lineTo(b.cx, b.y - 26);
      ctx.stroke();
      ctx.restore();
    }
  }, []);

  const toImage = (clientX: number, clientY: number): Point | null => {
    const view = viewRef.current;
    if (!view || !size.current.w) return null;
    const rect = view.getBoundingClientRect();
    const z = zoomRef.current;
    const p = panRef.current;
    return {
      x: clamp((clientX - rect.left - p.x) / z, 0, size.current.w),
      y: clamp((clientY - rect.top - p.y) / z, 0, size.current.h),
    };
  };

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
    const img = imgRef.current;
    if (!img) return;
    const onLoad = () => {
      size.current = { w: img.naturalWidth, h: img.naturalHeight };
      const canvas = overlayRef.current;
      if (canvas) {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
      }
      fit();
      redraw();
    };
    if (img.complete && img.naturalWidth) onLoad();
    else img.addEventListener('load', onLoad);
    return () => img.removeEventListener('load', onLoad);
  }, [src, fit, redraw]);

  useEffect(() => { redraw(); }, [annos, selected, tool, textDraft, redraw]);

  useEffect(() => {
    const typing = () => document.activeElement === textInputRef.current || Boolean(textDraftRef.current);
    const onKey = (e: KeyboardEvent) => {
      if (typing() && e.key !== 'Escape') {
        if (e.code === 'Space') e.stopPropagation();
        return;
      }
      if (e.key === 'Escape') {
        if (textDraftRef.current) setTextDraft(null);
        else if (selectedRef.current != null) setSelected(null);
        else onCancel();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedRef.current != null) {
        e.preventDefault();
        const i = selectedRef.current;
        setAnnos((prev) => prev.filter((_, idx) => idx !== i));
        setSelected(null);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        setAnnos((prev) => prev.slice(0, -1));
        setSelected((sel) => (sel != null && sel >= annosRef.current.length - 1 ? null : sel));
      }
      if (e.code === 'Space') drag.current.space = e.type === 'keydown';
      if (e.key === '1') setTool('pan');
      if (e.key === '2') setTool('pen');
      if (e.key === '3') setTool('arrow');
      if (e.key === '4') setTool('box');
      if (e.key === '5') setTool('text');
      if (e.key === '6') setTool('select');
      if (e.key === '8') setTool('circle');
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
    };
  }, [onCancel]);

  useEffect(() => {
    if (!textDraft) return;
    const id = window.setTimeout(() => textInputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [textDraft?.x, textDraft?.y, textDraft?.editIndex]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
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
  }, []);

  const commitText = useCallback(() => {
    const draft = textDraftRef.current;
    if (!draft) return;
    textDraftRef.current = null;
    const typed = (textInputRef.current?.value ?? draft.value ?? '').trim();
    if (draft?.editIndex != null) {
      const i = draft.editIndex;
      if (!typed) {
        setAnnos((prev) => prev.filter((_, idx) => idx !== i));
        setSelected(null);
      } else {
        setAnnos((prev) => prev.map((a, idx) => (
          idx === i && a.kind === 'text' ? { ...a, text: typed, color: colorRef.current, bg: textBgRef.current } : a
        )));
        setSelected(i);
        setTool('select');
      }
    } else if (typed && draft) {
      const index = annosRef.current.length;
      setAnnos((prev) => [...prev, {
        kind: 'text', color: colorRef.current, bg: textBgRef.current, x: draft.x, y: draft.y, size: 32, text: typed, rot: 0,
      }]);
      setSelected(index);
      setTool('select');
    }
    setTextDraft(null);
  }, []);

  const openEdit = (i: number) => {
    const a = annosRef.current[i];
    if (!a || a.kind !== 'text') return;
    const view = viewRef.current?.getBoundingClientRect();
    const sx = panRef.current.x + a.x * zoomRef.current;
    const sy = panRef.current.y + (a.y - a.size) * zoomRef.current;
    setSelected(i);
    setColor(a.color);
    setTextBg(a.bg);
    setTextDraft({
      x: a.x,
      y: a.y,
      screenX: Math.min(Math.max(8, sx), Math.max(8, (view?.width ?? 200) - 220)),
      screenY: Math.min(Math.max(8, sy), Math.max(8, (view?.height ?? 80) - 44)),
      value: a.text,
      editIndex: i,
    });
  };

  const removeSelected = () => {
    const i = selectedRef.current;
    if (i == null) return;
    setAnnos((prev) => prev.filter((_, idx) => idx !== i));
    setSelected(null);
  };

  const keepTyping = (e: React.MouseEvent) => {
    if (textDraftRef.current) e.preventDefault();
  };

  const applyColor = (next: string) => {
    setColor(next);
    const draft = textDraftRef.current;
    if (draft?.editIndex != null) {
      setAnnos((prev) => prev.map((a, idx) => (idx === draft.editIndex ? { ...a, color: next } : a)));
      return;
    }
    if (draft) return;
    const i = selectedRef.current;
    if (i == null) return;
    setAnnos((prev) => prev.map((a, idx) => (idx === i ? { ...a, color: next } : a)));
  };

  const applyBg = (next: string | null) => {
    setTextBg(next);
    const draft = textDraftRef.current;
    if (draft?.editIndex != null) {
      setAnnos((prev) => prev.map((a, idx) => (idx === draft.editIndex && a.kind === 'text' ? { ...a, bg: next } : a)));
      return;
    }
    if (draft) return;
    const i = selectedRef.current;
    if (i == null) return;
    setAnnos((prev) => prev.map((a, idx) => (idx === i && a.kind === 'text' ? { ...a, bg: next } : a)));
  };

  const applyWidth = (next: number) => {
    setWidth(next);
    if (textDraftRef.current) return;
    const i = selectedRef.current;
    if (i == null) return;
    setAnnos((prev) => prev.map((a, idx) => (idx === i && a.kind !== 'text' ? { ...a, width: next } : a)));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('textarea, input')) return;
    if (textDraftRef.current) {
      commitText();
      return;
    }
    const pt = toImage(e.clientX, e.clientY);
    if (!pt) return;
    const panning = tool === 'pan' || drag.current.space || e.button === 1;
    if (panning) {
      capturePointer(e.currentTarget as HTMLElement, e.pointerId);
      drag.current = { ...drag.current, mode: 'pan', last: { x: e.clientX, y: e.clientY }, start: pt };
      return;
    }
    if (tool === 'select') {
      const list = annosRef.current;
      let hit = -1;
      for (let i = list.length - 1; i >= 0; i--) {
        if (hits(list[i], pt)) { hit = i; break; }
      }
      if (hit < 0) {
        setSelected(null);
        return;
      }
      setSelected(hit);
      capturePointer(e.currentTarget as HTMLElement, e.pointerId);
      drag.current = { ...drag.current, mode: 'move', index: hit, last: pt, start: pt };
      return;
    }
    if (tool === 'text') {
      const view = viewRef.current?.getBoundingClientRect();
      const screenX = Math.min(Math.max(8, e.clientX - (view?.left ?? 0)), Math.max(8, (view?.width ?? 200) - 220));
      const screenY = Math.min(Math.max(8, e.clientY - (view?.top ?? 0) - 18), Math.max(8, (view?.height ?? 80) - 44));
      setTextBg(null);
      setTextDraft({ x: pt.x, y: pt.y, screenX, screenY, value: '', editIndex: null });
      return;
    }
    capturePointer(e.currentTarget as HTMLElement, e.pointerId);
    if (tool === 'pen' || tool === 'highlight') {
      live.current = {
        kind: 'pen',
        color,
        width,
        alpha: tool === 'highlight' ? 0.32 : 1,
        points: [pt],
        rot: 0,
      };
      drag.current.mode = 'draw';
      redraw();
      return;
    }
    if (tool === 'arrow') {
      live.current = { kind: 'arrow', color, width, from: pt, to: pt, rot: 0 };
      drag.current.mode = 'arrow';
      redraw();
      return;
    }
    if (tool === 'circle') {
      live.current = { kind: 'circle', color, width, x: pt.x, y: pt.y, w: 0, h: 0, rot: 0 };
      drag.current = { ...drag.current, mode: 'circle', start: pt, last: pt };
      redraw();
      return;
    }
    live.current = { kind: 'box', color, width, x: pt.x, y: pt.y, w: 0, h: 0, rot: 0 };
    drag.current = { ...drag.current, mode: 'box', start: pt, last: pt };
    redraw();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const mode = drag.current.mode;
    if (!mode) return;
    if (mode === 'pan') {
      setPan((p) => ({ x: p.x + (e.clientX - drag.current.last.x), y: p.y + (e.clientY - drag.current.last.y) }));
      drag.current.last = { x: e.clientX, y: e.clientY };
      return;
    }
    const pt = toImage(e.clientX, e.clientY);
    if (!pt) return;
    if (mode === 'move') {
      const dx = pt.x - drag.current.last.x;
      const dy = pt.y - drag.current.last.y;
      drag.current.last = pt;
      const i = drag.current.index;
      setAnnos((prev) => prev.map((a, idx) => (idx === i ? translateAnno(a, dx, dy) : a)));
      return;
    }
    if (mode === 'rotate') {
      const { center, startRot, startAngle, index } = drag.current;
      const angle = Math.atan2(pt.y - center.y, pt.x - center.x);
      const rot = startRot + (angle - startAngle);
      setAnnos((prev) => prev.map((a, idx) => (idx === index ? { ...a, rot } : a)));
      return;
    }
    if (mode === 'resize' && drag.current.startAnno) {
      const { center, startDist, startAnno, index } = drag.current;
      const next = resizeAnno(startAnno, pt, center, startDist);
      setAnnos((prev) => prev.map((a, idx) => (idx === index ? next : a)));
      return;
    }
    if (!live.current) return;
    if (mode === 'draw' && live.current.kind === 'pen') {
      live.current = { ...live.current, points: [...live.current.points, pt] };
    } else if (mode === 'arrow' && live.current.kind === 'arrow') {
      live.current = { ...live.current, to: pt };
    } else if ((mode === 'box' || mode === 'circle') && (live.current.kind === 'box' || live.current.kind === 'circle')) {
      const s = drag.current.start;
      live.current = {
        ...live.current,
        x: Math.min(s.x, pt.x),
        y: Math.min(s.y, pt.y),
        w: Math.abs(pt.x - s.x),
        h: Math.abs(pt.y - s.y),
      };
    }
    redraw();
  };

  const onPointerUp = () => {
    if (live.current) {
      const done = live.current;
      const emptyShape = (done.kind === 'box' || done.kind === 'circle') && (Math.abs(done.w) < 4 || Math.abs(done.h) < 4);
      const emptyPen = done.kind === 'pen' && done.points.length < 2;
      if (!emptyShape && !emptyPen) {
        const index = annosRef.current.length;
        setAnnos((prev) => [...prev, done]);
        setSelected(index);
        if (done.kind === 'arrow' || done.kind === 'box' || done.kind === 'circle') setTool('select');
      }
      live.current = null;
      redraw();
    }
    drag.current.mode = null;
  };

  const save = async () => {
    const img = imgRef.current;
    if (!img?.naturalWidth) return;
    setSaving(true);
    setError('');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not save');
      ctx.drawImage(img, 0, 0);
      const pending = (textInputRef.current?.value ?? textDraftRef.current?.value ?? '').trim();
      const draft = textDraftRef.current;
      let painted = annos;
      if (pending && draft?.editIndex != null) {
        const i = draft.editIndex;
        painted = annos.map((a, idx) => (
          idx === i && a.kind === 'text' ? { ...a, text: pending, color: colorRef.current, bg: textBgRef.current } : a
        ));
      } else if (pending && draft) {
        painted = [...annos, {
          kind: 'text', color: colorRef.current, bg: textBgRef.current, x: draft.x, y: draft.y, size: 32, text: pending, rot: 0,
        }];
      }
      for (const anno of painted) paintAnno(ctx, anno);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not save'))), 'image/jpeg', 0.86);
      });
      await onSaved(await compressImage(blob));
    } catch {
      setError('Could not save the edited image. Try again.');
      setSaving(false);
    }
  };

  const cursor = drag.current.space || tool === 'pan' ? 'grab' : tool === 'text' ? 'text' : tool === 'select' ? 'default' : 'crosshair';
  const selectedAnno = selected != null ? annos[selected] : null;
  const showFill = Boolean(textDraft) || selectedAnno?.kind === 'text';
  const shownBg = textDraft ? textBg : selectedAnno?.kind === 'text' ? selectedAnno.bg : null;
  const activeWidth = !textDraft && selectedAnno && selectedAnno.kind !== 'text' ? selectedAnno.width : width;
  let rotateHandle: Point | null = null;
  let resizeHandle: Point | null = null;
  if (tool === 'select' && selectedAnno && textDraft?.editIndex !== selected) {
    const b = boundsOf(selectedAnno);
    const p = spin(b.cx, b.cy, { x: b.cx, y: b.y - 26 }, selectedAnno.rot);
    const c = spin(b.cx, b.cy, { x: b.x + b.w, y: b.y + b.h }, selectedAnno.rot);
    rotateHandle = { x: pan.x + p.x * zoom, y: pan.y + p.y * zoom };
    resizeHandle = { x: pan.x + c.x * zoom, y: pan.y + c.y * zoom };
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm text-white/80 border-b border-white/10">
        <ToolBtn active={tool === 'select'} onClick={() => setTool('select')}>Select</ToolBtn>
        <ToolBtn active={tool === 'pan'} onClick={() => setTool('pan')}>Move</ToolBtn>
        <ToolBtn active={tool === 'pen'} onClick={() => setTool('pen')}>Draw</ToolBtn>
        <ToolBtn active={tool === 'highlight'} onClick={() => setTool('highlight')}>Highlight</ToolBtn>
        <ToolBtn active={tool === 'arrow'} onClick={() => setTool('arrow')}>Arrow</ToolBtn>
        <ToolBtn active={tool === 'box'} onClick={() => setTool('box')}>Box</ToolBtn>
        <ToolBtn active={tool === 'circle'} onClick={() => setTool('circle')}>Circle</ToolBtn>
        <ToolBtn active={tool === 'text'} onClick={() => setTool('text')}>Text</ToolBtn>
        <span className="w-px h-5 bg-white/20 mx-1" />
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onMouseDown={keepTyping}
            onClick={() => applyColor(c)}
            className={`w-6 h-6 rounded-full border ${color === c ? 'border-white scale-110' : 'border-white/30'}`}
            style={{ background: c }}
            aria-label={`Color ${c}`}
          />
        ))}
        <span className="w-px h-5 bg-white/20 mx-1" />
        {WIDTHS.map((w) => (
          <button
            key={w}
            type="button"
            onMouseDown={keepTyping}
            onClick={() => applyWidth(w)}
            className={`w-8 h-6 rounded border flex items-center justify-center ${activeWidth === w ? 'border-white bg-white/10' : 'border-white/20'}`}
            aria-label={`Line thickness ${w}`}
          >
            <span className="block w-5 rounded-full bg-white" style={{ height: Math.max(2, w / 4) }} />
          </button>
        ))}
        {showFill && (
          <>
            <span className="w-px h-5 bg-white/20 mx-1" />
            <span className="text-xs text-white/50">Fill</span>
            <button
              type="button"
              onMouseDown={keepTyping}
              onClick={() => applyBg(null)}
              className={`px-2 py-1 rounded-lg border text-xs ${shownBg == null ? 'border-white text-white' : 'border-white/20 text-white/70'}`}
            >
              None
            </button>
            {COLORS.map((c) => (
              <button
                key={`bg-${c}`}
                type="button"
                onMouseDown={keepTyping}
                onClick={() => applyBg(c)}
                className={`w-6 h-6 rounded border ${shownBg === c ? 'border-white scale-110' : 'border-white/30'}`}
                style={{ background: c }}
                aria-label={`Text background ${c}`}
              />
            ))}
          </>
        )}
        <span className="w-px h-5 bg-white/20 mx-1" />
        <button type="button" onClick={() => { setAnnos((prev) => prev.slice(0, -1)); setSelected((sel) => (sel != null && sel >= annosRef.current.length - 1 ? null : sel)); }} className="px-2 py-1 rounded-lg border border-white/20 hover:bg-white/10">Undo</button>
        {selected != null && (
          <button type="button" onClick={removeSelected} className="px-2 py-1 rounded-lg border border-white/20 hover:bg-white/10">Remove</button>
        )}
        {selectedAnno?.kind === 'text' && (
          <button type="button" onClick={() => openEdit(selected!)} className="px-2 py-1 rounded-lg border border-white/20 hover:bg-white/10">Edit text</button>
        )}
        <button type="button" onClick={fit} className="px-2 py-1 rounded-lg border border-white/20 hover:bg-white/10">Fit</button>
        <span className="ml-auto flex items-center gap-2">
          {error && <span className="text-red-300 text-xs">{error}</span>}
          <button type="button" onClick={onCancel} className="px-3 py-1 rounded-lg border border-white/30 hover:bg-white/10">Cancel</button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="px-3 py-1 rounded-lg bg-accent text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save over this image'}
          </button>
        </span>
      </div>
      <div
        ref={viewRef}
        className="relative flex-1 overflow-hidden touch-none"
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={(e) => {
          if (tool !== 'select') return;
          const pt = toImage(e.clientX, e.clientY);
          if (!pt) return;
          const list = annosRef.current;
          for (let i = list.length - 1; i >= 0; i--) {
            if (list[i].kind === 'text' && hits(list[i], pt)) { openEdit(i); return; }
          }
        }}
      >
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          <img ref={imgRef} src={src} alt="Trade screenshot" className="block select-none max-w-none" draggable={false} />
          <canvas ref={overlayRef} className="absolute inset-0 w-full h-full pointer-events-none" />
        </div>
        {textDraft && (
          <textarea
            ref={textInputRef}
            value={textDraft.value}
            rows={Math.max(2, textDraft.value.split('\n').length)}
            onChange={(e) => setTextDraft({ ...textDraft, value: e.target.value })}
            onBlur={() => commitText()}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Escape') {
                e.preventDefault();
                textDraftRef.current = null;
                setTextDraft(null);
              }
            }}
            placeholder={textDraft.editIndex != null ? 'Edit, then click away' : 'Type. Enter for a new line'}
            className="absolute z-20 min-w-[12rem] px-3 py-2 rounded-lg border-2 border-white text-base leading-snug outline-none resize-none"
            style={{ left: textDraft.screenX, top: textDraft.screenY, color, background: textBg ?? '#000' }}
          />
        )}
        {rotateHandle && (
          <button
            type="button"
            aria-label="Rotate"
            className="absolute z-30 w-8 h-8 -ml-4 -mt-4 rounded-full border-2 border-white bg-black text-white text-sm leading-none"
            style={{ left: rotateHandle.x, top: rotateHandle.y }}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (selected == null) return;
              const pt = toImage(e.clientX, e.clientY);
              const anno = annosRef.current[selected];
              if (!pt || !anno) return;
              const b = boundsOf(anno);
              drag.current = {
                ...drag.current,
                mode: 'rotate',
                index: selected,
                center: { x: b.cx, y: b.cy },
                startRot: anno.rot,
                startAngle: Math.atan2(pt.y - b.cy, pt.x - b.cx),
                last: pt,
                start: pt,
              };
              capturePointer(e.currentTarget as HTMLElement, e.pointerId);
            }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            ↻
          </button>
        )}
        {resizeHandle && (
          <button
            type="button"
            aria-label="Resize"
            className="absolute z-30 w-4 h-4 -ml-2 -mt-2 rounded-sm border-2 border-black bg-white"
            style={{ left: resizeHandle.x, top: resizeHandle.y }}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (selected == null) return;
              const pt = toImage(e.clientX, e.clientY);
              const anno = annosRef.current[selected];
              if (!pt || !anno) return;
              const b = boundsOf(anno);
              drag.current = {
                ...drag.current,
                mode: 'resize',
                index: selected,
                center: { x: b.cx, y: b.cy },
                startDist: Math.hypot(pt.x - b.cx, pt.y - b.cy) || 1,
                startAnno: anno,
                last: pt,
                start: pt,
              };
              capturePointer(e.currentTarget as HTMLElement, e.pointerId);
            }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          />
        )}
      </div>
      <p className="px-3 py-1.5 text-xs text-white/50">
        Enter adds a line. Click away to keep the text, then use Fill if you want a colored box behind it. The thickness buttons change lines, arrows, boxes, and circles. Save replaces this screenshot.
      </p>
    </div>
  );
}
