import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react"

type WindowState = "normal" | "collapsed" | "expanded" | "closed"

// Panels remember whether the user closed/collapsed them, per browser, so a
// refresh doesn't quietly bring back something they dismissed on purpose.
// Keyed by a slug of the panel's own label — good enough since labels here are
// static per-card ("Tasks", "Reminders", ...) rather than user-authored text.
const STORAGE_PREFIX = "caven:panel:"
function slugOf(label: ReactNode): string {
  return String(label).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "panel"
}
function readStoredWin(key: string): WindowState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key)
    return raw === "collapsed" || raw === "closed" ? raw : null
  } catch {
    return null
  }
}
function writeStoredWin(key: string, win: WindowState) {
  try {
    // Only "closed"/"collapsed" are worth remembering — "expanded" is a
    // momentary focus view, not a layout preference, so it always resets.
    if (win === "closed" || win === "collapsed") window.localStorage.setItem(STORAGE_PREFIX + key, win)
    else window.localStorage.removeItem(STORAGE_PREFIX + key)
  } catch {
    // Best-effort only — a private window or blocked storage just means the
    // preference doesn't survive a refresh, not that the panel misbehaves.
  }
}

/**
 * Every board panel is a little window: it can be picked up and moved
 * (press-hold or drag from any empty part of the panel), and the three
 * traffic lights in the corner close it (red), shrink it to just its
 * heading (yellow), or blow it up to a centred overlay (green).
 *
 * All of this lives here so the four cards stay declarative — they only
 * describe their label, title and rows and inherit the window behaviour.
 */
export function GlassPanel({
  label,
  title,
  children,
  className = "",
  isVisible = true,
  largeLabel = false,
  showTitle = true,
  headerRelative = false,
  headerAction,
}: {
  label: ReactNode
  title: string
  children: ReactNode
  className?: string
  isVisible?: boolean
  largeLabel?: boolean
  showTitle?: boolean
  headerRelative?: boolean
  headerAction?: ReactNode
}) {
  const headingId = useId()
  const storageKey = slugOf(label)

  const [win, setWin] = useState<WindowState>(() => readStoredWin(storageKey) ?? "normal")
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [resizing, setResizing] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)

  // Refs so the window listeners read live values without re-binding.
  const offsetRef = useRef(offset)
  offsetRef.current = offset
  const drag = useRef({ sx: 0, sy: 0, bx: 0, by: 0, moving: false, hold: 0 })

  const stopListening = useCallback((onMove: (e: PointerEvent) => void, onUp: () => void) => {
    window.removeEventListener("pointermove", onMove)
    window.removeEventListener("pointerup", onUp)
    window.clearTimeout(drag.current.hold)
  }, [])

  const canDrag = win === "normal" || win === "collapsed"

  const onPointerDown = (e: React.PointerEvent) => {
    if (!canDrag || e.button !== 0) return
    // Never hijack a real control — task ticks, the traffic lights, inputs.
    if ((e.target as HTMLElement).closest('button, a, input, textarea, select, [role="button"]')) return

    const d = drag.current
    d.sx = e.clientX
    d.sy = e.clientY
    d.bx = offsetRef.current.x
    d.by = offsetRef.current.y
    d.moving = false

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - d.sx
      const dy = ev.clientY - d.sy
      if (!d.moving) {
        if (Math.hypot(dx, dy) < 6) return
        d.moving = true
        setDragging(true)
      }
      setOffset({ x: d.bx + dx, y: d.by + dy })
    }
    const onUp = () => {
      d.moving = false
      setDragging(false)
      stopListening(onMove, onUp)
    }

    // Press-and-hold also arms the drag, so it lifts off without moving first.
    d.hold = window.setTimeout(() => {
      d.moving = true
      setDragging(true)
    }, 160)

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

  // Safety net: drop any stray listeners if the panel unmounts mid-drag.
  useEffect(() => () => window.clearTimeout(drag.current.hold), [])

  // Corner / edge resize. The handle's name lists the directions it pulls
  // (n/s/e/w); a west or north drag also shifts the panel so the opposite
  // edge stays put, which is what "pull that direction" should feel like.
  const startResize = (dir: string) => (e: React.PointerEvent) => {
    if (win !== "normal" || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const el = sectionRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const sx = e.clientX
    const sy = e.clientY
    const startW = rect.width
    const startH = rect.height
    const base = { ...offsetRef.current }
    const hasE = dir.includes("e")
    const hasW = dir.includes("w")
    const hasS = dir.includes("s")
    const hasN = dir.includes("n")
    const MIN_W = 240
    const MIN_H = 120

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - sx
      const dy = ev.clientY - sy
      let w = startW
      let h = startH
      let ox = base.x
      let oy = base.y
      if (hasE) w = Math.max(MIN_W, startW + dx)
      if (hasW) {
        w = Math.max(MIN_W, startW - dx)
        ox = base.x + (startW - w)
      }
      if (hasS) h = Math.max(MIN_H, startH + dy)
      if (hasN) {
        h = Math.max(MIN_H, startH - dy)
        oy = base.y + (startH - h)
      }
      setSize({ w, h })
      setOffset({ x: ox, y: oy })
    }
    const onUp = () => {
      setResizing(false)
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
    setResizing(true)
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

  const setWinPersisted = (next: WindowState) => {
    setWin(next)
    writeStoredWin(storageKey, next)
  }

  const closePanel = () => {
    setDragging(false)
    setWinPersisted("closed")
  }
  const toggleCollapse = () => setWinPersisted(win === "collapsed" ? "normal" : "collapsed")
  const toggleExpand = () => setWin(prev => (prev === "expanded" ? "normal" : "expanded"))
  const reopen = () => {
    setOffset({ x: 0, y: 0 })
    setSize(null)
    setWinPersisted("normal")
  }

  if (win === "closed") {
    return (
      <button type="button" className="panel-reopen" onClick={reopen}>
        <span className="win-light win-light--max" aria-hidden="true" />
        <span className="hud-label text-cyan-300/80">{label}</span>
        <span className="t-meta text-white/40 ml-auto">Reopen</span>
      </button>
    )
  }

  const transform = win === "expanded" ? undefined : `translate(${offset.x}px, ${offset.y}px)`
  const sectionStyle: CSSProperties = {}
  if (transform) sectionStyle.transform = transform
  if (win === "normal" && size) {
    sectionStyle.width = size.w
    sectionStyle.height = size.h
    sectionStyle.overflowY = "auto"
  }

  return (
    <>
      {win === "expanded" && (
        <div className="panel-backdrop" onClick={toggleExpand} aria-hidden="true" />
      )}
      <section
        ref={sectionRef}
        aria-labelledby={headingId}
        onPointerDown={onPointerDown}
        style={sectionStyle}
        className={`glass-panel holo-board ${isVisible ? "holo-in" : "holo-out"}${
          canDrag ? " is-draggable" : ""
        }${dragging ? " is-dragging" : ""}${resizing ? " is-resizing" : ""}${
          win === "collapsed" ? " glass-panel--collapsed" : ""
        }${win === "expanded" ? " glass-panel--expanded" : ""} ${className}`}
      >
        {/* Hologram Emitter Beams & Metal Frame Accents */}
        <div className="holo-frame-top" />
        <div className="holo-frame-bottom" />

        {/* Holographic Scanline Overlay */}
        <div className="holo-scanlines" />

        {/* Edge & corner resize handles — only while the window is at normal size. */}
        {win === "normal" &&
          ["n", "s", "e", "w", "ne", "nw", "se", "sw"].map(dir => (
            <span
              key={dir}
              className={`panel-resize panel-resize--${dir}`}
              onPointerDown={startResize(dir)}
              aria-hidden="true"
            />
          ))}

        {/* Card Header */}
        <div
          className={`flex items-start justify-between gap-4 z-10${
            win === "collapsed" ? "" : " mb-4"
          }${headerRelative ? " relative" : ""}`}
        >
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h2
                id={headingId}
                className={`hud-label${largeLabel ? " hud-label--large" : ""} text-cyan-100`}
                style={largeLabel ? undefined : { fontSize: "calc(var(--fs-micro) * 1.2)" }}
              >
                {label}
              </h2>
            </div>
            {showTitle && (
              <p className="mt-1 t-h2 text-white/95 flex items-center gap-2">{title}</p>
            )}
          </div>

          {/* Manual add toggle sits beside the traffic-light window controls. */}
          <div className="flex items-center gap-2 mt-1">
            {win === "normal" && headerAction}
            {/* Traffic-light window controls: exit / shrink / expand. */}
            <div className="win-lights">
            <button
              type="button"
              className="win-light win-light--close"
              onClick={closePanel}
              aria-label="Close panel (remembered until you reopen it)"
            >
              <svg viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                <path d="M1.5 1.5l5 5M6.5 1.5l-5 5" />
              </svg>
            </button>
            <button
              type="button"
              className="win-light win-light--min"
              onClick={toggleCollapse}
              aria-label={win === "collapsed" ? "Expand panel body" : "Shrink panel"}
            >
              <svg viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                <path d="M1.5 4h5" />
              </svg>
            </button>
            <button
              type="button"
              className="win-light win-light--max"
              onClick={toggleExpand}
              aria-label={win === "expanded" ? "Restore panel size" : "Expand panel"}
            >
              <svg viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                {win === "expanded" ? (
                  <path d="M1.5 4h5M4 1.5v5" transform="rotate(45 4 4)" />
                ) : (
                  <path d="M1.5 4h5M4 1.5v5" />
                )}
              </svg>
            </button>
            </div>
          </div>
        </div>

        {win !== "collapsed" && <div className="relative z-10">{children}</div>}
      </section>
    </>
  )
}

/**
 * A quiet line of copy for the states where there is nothing to show:
 * still loading, failed to load, or a genuinely empty board.
 * Plain utility classes only, so it never competes with the panel design.
 *
 * Pass onRetry (with a failed load) to turn the note into a real, clickable
 * retry — not just the word "retry" sitting there with nothing behind it.
 */
export function PanelNote({
  children,
  onRetry,
  retryLabel = "Retry",
}: {
  children: ReactNode
  onRetry?: () => void
  retryLabel?: string
}) {
  if (!onRetry) return <p className="t-caption text-white/45">{children}</p>
  return (
    <p className="t-caption text-white/45 flex flex-wrap items-center gap-2">
      <span>{children}</span>
      <button
        type="button"
        onClick={onRetry}
        className="t-caption text-cyan-300/90 underline underline-offset-2 hover:text-cyan-200"
      >
        {retryLabel}
      </button>
    </p>
  )
}
