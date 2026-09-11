import { useId, type ReactNode } from "react"

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
  return (
    <section
      aria-labelledby={headingId}
      className={`glass-panel holo-board ${
        isVisible ? "holo-in" : "holo-out"
      } ${className}`}
    >
      {/* Hologram Emitter Beams & Metal Frame Accents */}
      <div className="holo-frame-top" />
      <div className="holo-frame-bottom" />

      {/* Holographic Scanline Overlay */}
      <div className="holo-scanlines" />

      {/* Card Header */}
      <div
        className={`flex items-start justify-between gap-4 mb-4 z-10${
          headerRelative ? " relative" : ""
        }`}
      >
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h2
              id={headingId}
              className={`hud-label${
                largeLabel ? " hud-label--large" : ""
              } text-cyan-300/80`}
            >
              {label}
            </h2>
          </div>
          {showTitle && (
            <p className="mt-1 t-h2 text-white/95 flex items-center gap-2">
              {title}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-2">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_#0377FD] animate-pulse" />
          <span className="h-1 w-3 rounded-full" style={{ backgroundColor: '#0377FD' }} />
        </div>
      </div>

      <div className="relative z-10">{children}</div>
    </section>
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
