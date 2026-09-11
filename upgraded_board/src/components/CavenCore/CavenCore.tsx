import { useRef } from "react"
import { useCore } from "../../lib/coreState"

// Polar helper for arc-reactor geometry (no gear teeth — smooth alien nano-tech arcs)
function polar(cx: number, cy: number, r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

// SVG arc segment path from startDeg → endDeg on a circle
function arcSeg(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
) {
  const s = polar(cx, cy, r, endDeg)
  const e = polar(cx, cy, r, startDeg)
  const large = endDeg - startDeg <= 180 ? 0 : 1
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y}`
}

// Generate a ring of `count` arc segments, each spanning `fill`% of its slot
function ringSegments(r: number, count: number, fill = 0.62) {
  const step = 360 / count
  const span = step * fill
  return Array.from({ length: count }, (_, i) => {
    const start = i * step
    return arcSeg(200, 200, r, start, start + span)
  })
}

// Floating 3D hexagonal crystal — a hexagonal bipyramid rendered as shaded
// facets. The equator is a perspective ellipse (rx > ry) so the flat facets
// read as a solid gem catching light from the upper-left.
const CRYSTAL = (() => {
  const cx = 200
  const cy = 200
  const rx = 30 // equator half-width
  const ry = 12 // equator half-height (perspective squash)
  const topY = cy - 44 // upper apex
  const botY = cy + 44 // lower apex
  const eq = Array.from({ length: 6 }, (_, i) => {
    const a = (i * 60 * Math.PI) / 180
    return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) }
  })
  // Alternate facet shading around the gem for a machined, luminous look.
  const fills = [
    "url(#gemLight)",
    "url(#gemMid)",
    "url(#gemDark)",
    "url(#gemMid)",
    "url(#gemLight)",
    "url(#gemMid)",
  ]
  const upper = eq.map((p, i) => {
    const n = eq[(i + 1) % 6]
    return { pts: `${cx},${topY} ${p.x},${p.y} ${n.x},${n.y}`, fill: fills[i] }
  })
  const lower = eq.map((p, i) => {
    const n = eq[(i + 1) % 6]
    return {
      pts: `${cx},${botY} ${p.x},${p.y} ${n.x},${n.y}`,
      fill: fills[(i + 3) % 6],
    }
  })
  const equatorPts = eq.map((p) => `${p.x},${p.y}`).join(" ")
  return {
    upper,
    lower,
    equatorPts,
    top: { x: cx, y: topY },
    bot: { x: cx, y: botY },
  }
})()

const POWER_LABEL: Record<string, string> = {
  off: "offline",
  on: "online",
  "powering-off": "powering down",
  locked: "locked",
}

export function CavenCore() {
  const { state, power, pulse, powerOn, powerOff, lock, lastAction } = useCore()

  // Distinguish tap / double-tap / press-and-hold from a single pointer stream.
  const holdTimer = useRef<number | undefined>(undefined)
  const clickTimer = useRef<number | undefined>(undefined)
  const didHold = useRef(false)

  const down = () => {
    didHold.current = false
    holdTimer.current = window.setTimeout(() => {
      didHold.current = true
      powerOff() // red pulse → fade → off
    }, 600)
  }

  const release = () => {
    window.clearTimeout(holdTimer.current)
    if (didHold.current) return // hold already handled power-off

    if (clickTimer.current) {
      // Second tap within the window → double tap → lock.
      window.clearTimeout(clickTimer.current)
      clickTimer.current = undefined
      lock()
    } else {
      clickTimer.current = window.setTimeout(() => {
        clickTimer.current = undefined
        powerOn() // single tap → green energize
      }, 240)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      if (e.shiftKey) lock()
      else if (power === "off") powerOn()
      else powerOff()
    }
  }

  // Pre-computed arc-reactor ring segments (alien nano-tech — no gears)
  const outerSegments = ringSegments(150, 5, 0.7)
  const midSegments = ringSegments(118, 18, 0.34)
  const innerSegments = ringSegments(78, 7, 0.58)

  // Status indicator color: off/powering-off = red, on = green, locked = yellow
  const dotColor =
    power === "on"
      ? "rgb(35, 157, 14)"
      : power === "locked"
        ? "#ffd53d"
        : "#ff5a4b"

  return (
    <div className={`core-zone core-${power} core-${state}`}>
      {/* Holographic Projection Core Button */}
      <button
        className="core-button"
        onPointerDown={down}
        onPointerUp={release}
        onPointerLeave={release}
        onKeyDown={onKeyDown}
        aria-label={`Caven core, currently ${POWER_LABEL[power]}. Tap to power on, double-tap to lock, press and hold to power off.`}
      >
        <svg className="core-svg" viewBox="0 0 400 400" aria-hidden="true">
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="heavy-glow">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Metallic titanium and cyan steel gradients */}
            <radialGradient id="orb">
              <stop stopColor="#eaffff" />
              <stop offset=".22" stopColor="#74edf2" />
              <stop offset=".58" stopColor="#1b9baa" stopOpacity=".62" />
              <stop offset="1" stopColor="#0c3340" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="metalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8beeff" stopOpacity="0.8" />
              <stop offset="35%" stopColor="#225966" stopOpacity="0.6" />
              <stop offset="70%" stopColor="#0e2a33" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#4bcbd6" stopOpacity="0.7" />
            </linearGradient>
            <linearGradient id="brassGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#d4af37" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#574614" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#f5d77f" stopOpacity="0.85" />
            </linearGradient>
            {/* Accent gradients for the inner reactor detail */}
            <linearGradient id="violetGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#c79bff" stopOpacity="0.9" />
              <stop offset="55%" stopColor="#5b2f8f" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#9d6bff" stopOpacity="0.85" />
            </linearGradient>
            <radialGradient id="reactorCoreGrad">
              <stop stopColor="#ffffff" />
              <stop offset=".35" stopColor="#a9f6ff" />
              <stop offset=".7" stopColor="#7be0a3" stopOpacity=".8" />
              <stop offset="1" stopColor="#0c3340" stopOpacity="0" />
            </radialGradient>
            {/* Faceted gem shading for the floating 3D hex crystal */}
            <linearGradient id="gemLight" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="45%" stopColor="#8ff0ff" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#1f8bff" stopOpacity="0.7" />
            </linearGradient>
            <linearGradient id="gemMid" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#9fe9ff" stopOpacity="0.8" />
              <stop offset="60%" stopColor="#0377fd" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#0a3b74" stopOpacity="0.75" />
            </linearGradient>
            <linearGradient id="gemDark" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0377fd" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#06213f" stopOpacity="0.85" />
            </linearGradient>
          </defs>

          {/* Outer Arc-Reactor Segment Ring — slow-rotating alien containment arcs */}
          <g className="reactor-ring reactor-ring-outer">
            {outerSegments.map((d, i) => (
              <path
                key={`outer-${i}`}
                d={d}
                fill="none"
                stroke="url(#metalGrad)"
                strokeWidth="6"
                strokeLinecap="round"
                filter="url(#glow)"
              />
            ))}
            {/* Node caps at each arc terminus */}
            {Array.from({ length: 5 }, (_, i) => {
              const p = polar(200, 200, 150, i * 72)
              return (
                <circle
                  key={`onode-${i}`}
                  cx={p.x}
                  cy={p.y}
                  r="3.2"
                  fill="#d8fdff"
                  filter="url(#glow)"
                />
              )
            })}
          </g>

          <circle className="orbit orbit-dash" cx="200" cy="200" r="146" />

          {/* Radar Sweep & Mechanical Micro Ticks */}
          <line
            className="sweep"
            x1="200"
            y1="200"
            x2="200"
            y2="27"
            filter="url(#glow)"
          />
          {Array.from({ length: 24 }, (_, i) => (
            <line
              className="tick"
              key={i}
              x1="200"
              y1="34"
              x2="200"
              y2={i % 3 === 0 ? "46" : "41"}
              transform={`rotate(${i * 15} 200 200)`}
            />
          ))}
          {Array.from({ length: 60 }, (_, i) => (
            <line
              className="microtick"
              key={`m${i}`}
              x1="200"
              y1="88"
              x2="200"
              y2="92"
              transform={`rotate(${i * 6} 200 200)`}
            />
          ))}

          {/* Fine Nano-Tick Ring — dense counter-rotating micro-segments */}
          <g className="reactor-ring reactor-ring-mid">
            {midSegments.map((d, i) => (
              <path
                key={`mid-${i}`}
                d={d}
                fill="none"
                stroke="#7fe6ef"
                strokeWidth="2"
                opacity="0.7"
              />
            ))}
          </g>

          {/* Inner Containment Arc Ring — the nano-tech reactor cage */}
          <g className="reactor-ring reactor-ring-inner">
            {innerSegments.map((d, i) => (
              <path
                key={`inner-${i}`}
                d={d}
                fill="none"
                stroke="url(#metalGrad)"
                strokeWidth="4.5"
                strokeLinecap="round"
                filter="url(#glow)"
              />
            ))}
          </g>

          <circle className="orbit orbit-inner" cx="200" cy="200" r="112" />

          {/* Orbiting Satellite Nodes */}
          <g className="sat-group sat-1">
            <circle className="sat" cx="200" cy="9" r="2.6" />
          </g>
          <g className="sat-group sat-2">
            <circle className="sat sat-sm" cx="200" cy="54" r="1.8" />
          </g>
          <g className="sat-group sat-3">
            <circle className="sat" cx="200" cy="88" r="2.2" />
          </g>

          {/* Mechanical Core Armature Spokes (JARVIS Core Frame) */}
          <g className="core-spokes">
            {Array.from({ length: 6 }, (_, i) => (
              <g key={`spoke-${i}`} transform={`rotate(${i * 60} 200 200)`}>
                <line
                  x1="200"
                  y1="135"
                  x2="200"
                  y2="82"
                  stroke="#52c8d2"
                  strokeWidth="1.2"
                  opacity="0.65"
                />
                <rect
                  x="198"
                  y="110"
                  width="4"
                  height="8"
                  fill="#71e8f0"
                  opacity="0.8"
                />
                <circle cx="200" cy="82" r="2" fill="#d8fdff" />
              </g>
            ))}
          </g>

          {/* Riveted Mounting Ring — fixed steel bolts around the inner rig */}
          <g className="rivet-ring">
            {Array.from({ length: 12 }, (_, i) => {
              const rad = (i * 30 * Math.PI) / 180
              const cx = 200 + Math.cos(rad) * 128
              const cy = 200 + Math.sin(rad) * 128
              return (
                <g key={`rivet-${i}`}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r="3.4"
                    fill="#0e2027"
                    stroke="#6fd6e0"
                    strokeWidth="0.7"
                  />
                  <circle className="metal-rivet" cx={cx} cy={cy} r="1.4" />
                  <line
                    x1={cx - 2.2}
                    y1={cy}
                    x2={cx + 2.2}
                    y2={cy}
                    stroke="#0a171d"
                    strokeWidth="0.6"
                    transform={`rotate(${i * 30 + 45} ${cx} ${cy})`}
                  />
                </g>
              )
            })}
          </g>

          {/* Precision Clamp Brackets — machined mounts at the cardinal points */}
          <g className="core-clamps">
            {[0, 90, 180, 270].map((a) => (
              <g key={`clamp-${a}`} transform={`rotate(${a} 200 200)`}>
                <path
                  d="M186 62 L214 62 L214 68 L208 68 L208 74 L192 74 L192 68 L186 68 Z"
                  fill="url(#metalGrad)"
                  stroke="#95f4fb"
                  strokeWidth="0.6"
                  opacity="0.85"
                />
                <circle cx="200" cy="66" r="1.3" className="metal-rivet" />
              </g>
            ))}
          </g>

          {/* Drifting Glints */}
          {Array.from({ length: 7 }, (_, i) => (
            <circle
              className="glint"
              key={`g${i}`}
              cx="200"
              cy="200"
              r="1.4"
              style={{
                ["--ga" as string]: `${i * 51}deg`,
                ["--gd" as string]: `${96 + (i % 4) * 26}px`,
                ["--gs" as string]: `${14 + (i % 5) * 5}s`,
                ["--gdl" as string]: `${i * -2.1}s`,
              }}
            />
          ))}

          {/* Inner Reactor Detail — layered multi-color mechanism */}
          <g className="reactor-detail">
            {/* Counter-rotating violet segment ring */}
            <g className="reactor-vio-ring">
              {Array.from({ length: 18 }, (_, i) => (
                <rect
                  key={`vio-${i}`}
                  x="199"
                  y="150"
                  width="2"
                  height={i % 2 === 0 ? "9" : "5"}
                  rx="1"
                  fill="url(#violetGrad)"
                  transform={`rotate(${i * 20} 200 200)`}
                />
              ))}
            </g>

            {/* Machined hex plate framing the core */}
            <polygon
              className="reactor-hex"
              points="200,158 236.4,179 236.4,221 200,242 163.6,221 163.6,179"
              fill="none"
              stroke="#8ff5fa"
              strokeWidth="1"
              opacity="0.5"
            />
            <polygon
              className="reactor-hex-inner"
              points="200,170 231.2,185 231.2,215 200,230 168.8,215 168.8,185"
              fill="none"
              stroke="#c79bff"
              strokeWidth="0.7"
              opacity="0.45"
            />

            {/* Diagnostic LED cluster — four distinct status colors */}
            {[
              { a: 30, c: "#63f0a0" },
              { a: 120, c: "#f5b642" },
              { a: 210, c: "#7fdcff" },
              { a: 300, c: "#e07bff" },
            ].map(({ a, c }, i) => {
              const rad = (a * Math.PI) / 180
              const lx = 200 + Math.cos(rad) * 50
              const ly = 200 + Math.sin(rad) * 50
              return (
                <circle
                  key={`led-${i}`}
                  className="reactor-led"
                  cx={lx}
                  cy={ly}
                  r="2"
                  fill={c}
                  style={{
                    ["--led" as string]: c,
                    ["--ldl" as string]: `${i * 0.4}s`,
                  }}
                />
              )
            })}
          </g>

          {/* Luminous Central Reactor Core */}
          <circle className="core-halo" cx="200" cy="200" r="82" />
          <circle
            className="core-orb"
            cx="200"
            cy="200"
            r="63"
            fill="url(#orb)"
            filter="url(#heavy-glow)"
          />

          {/* Floating 3D Hexagonal Crystal — the intelligence at the heart of the core */}
          <g className="hex-crystal" filter="url(#glow)">
            <g className="hex-crystal-spin">
              {CRYSTAL.lower.map((f, i) => (
                <polygon
                  key={`cl-${i}`}
                  points={f.pts}
                  fill={f.fill}
                  stroke="#bff4ff"
                  strokeWidth="0.4"
                  strokeOpacity="0.4"
                />
              ))}
              {CRYSTAL.upper.map((f, i) => (
                <polygon
                  key={`cu-${i}`}
                  points={f.pts}
                  fill={f.fill}
                  stroke="#dffbff"
                  strokeWidth="0.5"
                  strokeOpacity="0.6"
                />
              ))}
              {/* Bright equator edge + apex ridge lines for crisp faceting */}
              <polygon
                points={CRYSTAL.equatorPts}
                fill="none"
                stroke="#ffffff"
                strokeWidth="0.7"
                strokeOpacity="0.7"
              />
              <line
                x1={CRYSTAL.top.x}
                y1={CRYSTAL.top.y}
                x2={CRYSTAL.bot.x}
                y2={CRYSTAL.bot.y}
                stroke="#eafcff"
                strokeWidth="0.5"
                strokeOpacity="0.35"
              />
              {/* Specular apex glints */}
              <circle
                className="hex-crystal-glint"
                cx={CRYSTAL.top.x}
                cy={CRYSTAL.top.y}
                r="2"
                fill="#ffffff"
              />
              <circle
                className="hex-crystal-glint"
                cx={CRYSTAL.bot.x}
                cy={CRYSTAL.bot.y}
                r="1.6"
                fill="#cbf6ff"
              />
            </g>
          </g>

          <circle className="core-center" cx="200" cy="200" r="12" />

          {/* Interactive Pulse — colored per action (green on / red off / blue lock) */}
          <circle
            key={pulse.id}
            className={`ripple pulse-${pulse.type}`}
            cx="200"
            cy="200"
            r="70"
          />
          {Array.from({ length: 12 }, (_, i) => (
            <circle
              key={`${pulse.id}-${i}`}
              className={`particle pulse-${pulse.type}`}
              cx="200"
              cy="200"
              r="2.2"
              style={{
                ["--a" as string]: `${i * 30}deg`,
                ["--d" as string]: `${80 + (i % 4) * 20}px`,
              }}
            />
          ))}

          {/* Double-tap lock beam — vertical light-blue surge */}
          {pulse.type === "blue" && (
            <g key={`beam-${pulse.id}`} className="lock-beam">
              <rect x="196" y="-40" width="8" height="480" rx="4" />
              <rect x="-40" y="196" width="480" height="8" rx="4" />
            </g>
          )}
        </svg>
      </button>

      {/* Hologram Board Controls & HUD Status Bar */}
      <div
        className="holo-hud-controls mt-3 flex flex-col items-center gap-2"
        style={{ paddingBottom: "127px" }}
      >
        <div className="text-[14px] font-mono tracking-widest text-white uppercase flex items-center gap-2">
          <span
            className="w-[13px] h-[13px] rounded-full animate-pulse text-[22px]"
            style={{
              backgroundColor: dotColor,
              boxShadow: `0 0 10px ${dotColor}`,
            }}
          />
          <span className="text-white" style={{ fontSize: "22px" }}>
            {lastAction || "JARVIS HUD PROJECTION MATRIX ONLINE"}
          </span>
        </div>
      </div>
    </div>
  )
}
