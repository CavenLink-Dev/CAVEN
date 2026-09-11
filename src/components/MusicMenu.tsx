import { memo, useEffect, useRef, useState } from "react"
import { playSfx } from "../lib/sfx"

// Background music the user can pick from the top-right. Files live in imports/.
const TRACKS = [
  {
    name: "First Light",
    url: new URL("../imports/First_Light.mp3", import.meta.url).href,
  },
  {
    name: "Sunbeam",
    url: new URL("../imports/Sunbeam.mp3", import.meta.url).href,
  },
  {
    name: "Afterglow",
    url: new URL("../imports/Afterglow.mp3", import.meta.url).href,
  },
  { name: "Orbit", url: new URL("../imports/Orbit.mp3", import.meta.url).href },
  {
    name: "Ascend",
    url: new URL("../imports/Ascend.mp3", import.meta.url).href,
  },
  {
    name: "Signal",
    url: new URL("../imports/Signal.mp3", import.meta.url).href,
  },
  {
    name: "Doodle",
    url: new URL("../imports/Doodle.mp3", import.meta.url).href,
  },
  {
    name: "Key Steps",
    url: new URL("../imports/Key_Steps.mp3", import.meta.url).href,
  },
  {
    name: "Heartbeat",
    url: new URL("../imports/Heartbeat.mp3", import.meta.url).href,
  },
  {
    name: "Stillwood",
    url: new URL("../imports/Stillwood.mp3", import.meta.url).href,
  },
] as const

function MusicMenuBase() {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(0.4)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  // Lazily create the single looping audio element.
  const audio = () => {
    if (!audioRef.current) {
      const a = new Audio()
      a.loop = true
      a.volume = volume
      audioRef.current = a
    }
    return audioRef.current
  }

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  // Close the dropdown when clicking elsewhere.
  useEffect(() => {
    if (!open) return
    const onDoc = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node))
        setOpen(false)
    }
    document.addEventListener("pointerdown", onDoc)
    return () => document.removeEventListener("pointerdown", onDoc)
  }, [open])

  useEffect(() => {
    return () => {
      audioRef.current?.pause()
    }
  }, [])

  const select = (i: number) => {
    const a = audio()
    if (current === i) {
      // Toggle play/pause on the active track.
      if (playing) {
        a.pause()
        setPlaying(false)
      } else {
        a.play().catch(() => {})
        setPlaying(true)
      }
      return
    }
    playSfx("select", 120)
    a.src = TRACKS[i].url
    a.currentTime = 0
    a.play().catch(() => {})
    setCurrent(i)
    setPlaying(true)
  }

  const stop = () => {
    audioRef.current?.pause()
    setPlaying(false)
  }

  const label = current !== null ? TRACKS[current].name : "Music"

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full px-3 py-1.5 metal-surface"
        style={{ color: "var(--caven-cyan-bright)" }}
        aria-label="Background music"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 18V5l12-2v13" />
          <circle
            cx="6"
            cy="18"
            r="3"
            fill={playing ? "currentColor" : "none"}
          />
          <circle
            cx="18"
            cy="16"
            r="3"
            fill={playing ? "currentColor" : "none"}
          />
        </svg>
        <span className="font-display t-micro tracking-[0.2em] max-w-[90px] truncate">
          {label.toUpperCase()}
        </span>
        {playing && (
          <span className="flex items-end gap-[2px] h-3" aria-hidden>
            <i className="eq-bar" style={{ animationDelay: "0ms" }} />
            <i className="eq-bar" style={{ animationDelay: "160ms" }} />
            <i className="eq-bar" style={{ animationDelay: "320ms" }} />
          </span>
        )}
      </button>

      {open && (
        <div
          className="anim-fade-up absolute right-0 mt-2 w-56 rounded-2xl p-2 metal-surface"
          style={{
            boxShadow:
              "0 12px 40px rgba(3,5,10,0.6), 0 0 22px rgba(63,208,255,0.15)",
          }}
        >
          <div className="mb-1 flex items-center justify-between px-2 pt-1">
            <span
              className="font-display t-micro tracking-[0.28em]"
              style={{ color: "var(--caven-steel)" }}
            >
              AMBIENT MUSIC
            </span>
            {playing && (
              <button
                onClick={stop}
                className="t-micro tracking-[0.2em]"
                style={{ color: "var(--caven-steel)" }}
              >
                STOP
              </button>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto">
            {TRACKS.map((t, i) => {
              const active = current === i
              return (
                <button
                  key={t.name}
                  onClick={() => select(i)}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors"
                  style={
                    active
                      ? {
                          background: "rgba(63,208,255,0.16)",
                          color: "var(--caven-cyan-bright)",
                        }
                      : { color: "var(--caven-cyan-bright)" }
                  }
                  onMouseEnter={() => playSfx("select", 320)}
                >
                  <span className="truncate">{t.name}</span>
                  <span
                    className="ml-2 t-micro"
                    style={{ color: "var(--caven-steel)" }}
                  >
                    {active && playing ? "❚❚" : "▶"}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="mt-2 flex items-center gap-2 px-2 pb-1">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--caven-steel)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 9v6h4l5 4V5L8 9H4z" />
              <path d="M16 8.5a4 4 0 0 1 0 7" />
            </svg>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-full accent-[var(--caven-cyan)]"
              aria-label="Music volume"
            />
          </div>
        </div>
      )}
    </div>
  )
}

// Memoised: useCaven() streams amplitude from App, and without this every
// frame of CAVEN speaking re-rendered this component for no reason.
export const MusicMenu = memo(MusicMenuBase)
