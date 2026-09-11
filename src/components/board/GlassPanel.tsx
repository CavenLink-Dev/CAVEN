import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react"

type WindowState = "normal" | "collapsed" | "expanded" | "closed"

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
}: {
  label: ReactNode
  title: string
  children: ReactNode
  className?: string
  isVisible?: boolean
  largeLabel?: boolean
  showTitle?: boolean
  headerRelative?: boolean
}) {
  const headingId = useId()

  const [win, setWin] = useState<WindowState>("normal")
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)

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

  const closePanel = () => {
    setDragging(false)
    setWin("closed")
  }
  const toggleCollapse = () => setWin(prev => (prev === "collapsed" ? "normal" : "collapsed"))
  const toggleExpand = () => setWin(prev => (prev === "expanded" ? "normal" : "expanded"))
  const reopen = () => {
    setOffset({ x: 0, y: 0 })
    setWin("normal")
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

  return (
    <>
      {win === "expanded" && (
        <div className="panel-backdrop" onClick={toggleExpand} aria-hidden="true" />
      )}
      <section
        aria-labelledby={headingId}
        onPointerDown={onPointerDown}
        style={transform ? { transform } : undefined}
        className={`glass-panel holo-board ${isVisible ? "holo-in" : "holo-out"}${
          canDrag ? " is-draggable" : ""
        }${dragging ? " is-dragging" : ""}${
          win === "collapsed" ? " glass-panel--collapsed" : ""
        }${win === "expanded" ? " glass-panel--expanded" : ""} ${className}`}
      >
        {/* Hologram Emitter Beams & Metal Frame Accents */}
        <div className="holo-frame-top" />
        <div className="holo-frame-bottom" />

        {/* Holographic Scanline Overlay */}
        <div className="holo-scanlines" />

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
                className={`hud-label${largeLabel ? " hud-label--large" : ""} text-cyan-300/80`}
              >
                {label}
              </h2>
            </div>
            {showTitle && (
              <p className="mt-1 t-h2 text-white/95 flex items-center gap-2">{title}</p>
            )}
          </div>

          {/* Traffic-light window controls: exit / shrink / expand. */}
          <div className="win-lights mt-1">
            <button
              type="button"
              className="win-light win-light--close"
              onClick={closePanel}
              aria-label="Close panel"
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

        {win !== "collapsed" && <div className="relative z-10">{children}</div>}
      </section>
    </>
  )
}

/**
 * A quiet line of copy for the states where there is nothing to show:
 * still loading, failed to load, or a genuinely empty board.
 * Plain utility classes only, so it never competes with the panel design.
 */
export function PanelNote({ children }: { children: ReactNode }) {
  return <p className="t-caption text-white/45">{children}</p>
}
