import { memo, useEffect, useRef, useState } from 'react';
import { playSfx } from '../lib/sfx';
import { useWidgets, WidgetOverlay } from './widgetData';

// Scattered luminescent cloud: phyllotaxis spread on a plane with depth so
// every tile faces the viewer and stays readable (nothing wraps out of sight).
function place(i: number) {
  const golden = 2.399963;
  const r = 66 * Math.sqrt(i + 0.5);
  const theta = i * golden;
  const x = Math.cos(theta) * r;
  const y = Math.sin(theta) * r * 0.66; // flatten to a widescreen field
  const z = Math.sin(i * 1.7) * 120 - 20; // gentle depth variation
  return `translate3d(${x}px, ${y}px, ${z}px)`;
}

// Pan bounds so the cloud can't be dragged off into nowhere.
const PAN = 520;
const clampPan = (v: number) => Math.max(-PAN, Math.min(PAN, v));

// The WIDGETS board: the same scattered 3D holographic field as the plasma
// board, but with no plasma ball at its center.
function FlatBoardBase() {
  const widgets = useWidgets();
  const stageRef = useRef<HTMLDivElement>(null);
  const pan = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const focusedRef = useRef(false);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const sway = focusedRef.current ? 0 : Math.sin(Date.now() / 2600) * 3;
      const ry = -pan.current.x * 0.022 + sway;
      const rx = pan.current.y * 0.022 + sway * 0.3;
      const s = stageRef.current;
      if (s) s.style.transform = `translate3d(${pan.current.x}px, ${pan.current.y}px, 0) rotateX(${rx}deg) rotateY(${ry}deg)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, px: pan.current.x, py: pan.current.y, moved: false };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = dragStart.current;
    if (!dragging.current || !d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) d.moved = true;
    pan.current.x = clampPan(d.px + dx);
    pan.current.y = clampPan(d.py + dy);
  };
  const onUp = () => {
    dragging.current = false;
  };
  const onWheel = (e: React.WheelEvent) => {
    pan.current.x = clampPan(pan.current.x - e.deltaX);
    pan.current.y = clampPan(pan.current.y - e.deltaY);
  };

  const openFocus = (i: number) => {
    if (dragStart.current?.moved) return; // was a drag, not a tap
    playSfx('start');
    focusedRef.current = true;
    setFocused(i);
  };
  const closeFocus = () => {
    playSfx('fade');
    focusedRef.current = false;
    dragging.current = false;
    dragStart.current = null;
    setFocused(null);
  };

  return (
    <div
      className="absolute inset-0 touch-none select-none overflow-hidden"
      style={{ perspective: 1700, cursor: 'grab' }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onWheel={onWheel}
    >
      <div className="absolute left-1/2 top-1/2 h-0 w-0" style={{ transformStyle: 'preserve-3d' }} ref={stageRef}>
        {widgets.map((wgt, i) => (
          <div
            key={wgt.title}
            className="absolute"
            style={{ width: 168, transform: `translate(-50%,-50%) ${place(i)}`, transformStyle: 'preserve-3d' }}
          >
            <div className="holo-panel holo-soft" onPointerEnter={() => playSfx('select', 320)} onClick={() => openFocus(i)}>
              <div className="font-display text-[11px] tracking-[0.2em]" style={{ color: 'var(--caven-cyan-bright)' }}>{wgt.title}</div>
              <div className="mt-1 text-[11px] opacity-70">{wgt.hint}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="world-frame" />

      <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 text-[10px] tracking-[0.3em]" style={{ color: 'var(--caven-steel)', opacity: 0.5 }}>
        DRAG TO EXPLORE
      </div>

      {focused !== null && <WidgetOverlay index={focused} onClose={closeFocus} />}
    </div>
  );
}

export const FlatBoard = memo(FlatBoardBase);
