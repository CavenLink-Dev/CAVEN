import type { CSSProperties } from 'react'
import type { CavenState } from '../../lib/cavenState'

type Line = { title: string; hint: string }

// Understated, never breathless. Nothing here claims work that hasn't happened:
// 'complete' is only reached once something was actually written away.
const COPY: Record<CavenState, Line> = {
  idle: { title: 'Tap to speak', hint: 'At your service whenever you are ready' },
  listening: { title: 'Listening, take your time', hint: 'Tap again to stand down' },
  thinking: { title: 'Considering the matter', hint: 'A moment, if you would' },
  acting: { title: 'Seeing to it', hint: 'Tap again to stand down' },
  speaking: { title: 'Replying', hint: 'Tap again to hush me' },
  complete: { title: 'Noted and filed', hint: 'Tap when you need me again' },
}

const BARS = 12

// Bar heights follow live amplitude rather than a decorative timer, so the
// waveform is honest about whether anything is actually being heard.
function barStyle(index: number, amplitude: number): CSSProperties {
  const amp = Math.max(0, Math.min(1, amplitude))
  // Centre bars swing widest, edges stay restrained.
  const centre = (BARS - 1) / 2
  const weight = 1 - Math.abs(index - centre) / (centre + 1)
  const scale = 0.18 + amp * (0.35 + weight * 1.1)
  return {
    transform: `scaleY(${scale.toFixed(3)})`,
    opacity: 0.45 + amp * weight * 0.55,
    transition: 'transform 90ms linear, opacity 140ms linear',
    animation: 'none',
  }
}

export function VoiceBar({
  state,
  amplitude,
  onToggle,
}: {
  state: CavenState
  amplitude: number
  onToggle: () => void
}) {
  const line = COPY[state]
  const actionLabel = state === 'idle' ? 'Start speaking to CAVEN' : 'Stop the conversation with CAVEN'

  return (
    <button
      onClick={onToggle}
      className="voice-bar"
      type="button"
      data-state={state}
      aria-label={`${actionLabel}. ${line.title}`}
    >
      <span className="waveform" aria-hidden="true">
        {Array.from({ length: BARS }, (_, i) => (
          <i key={i} style={barStyle(i, amplitude)} />
        ))}
      </span>
      <span className="voice-copy">
        <b>{line.title}</b>
        <small>{line.hint}</small>
      </span>
      <span className="mic-button" aria-hidden="true">⌁</span>
    </button>
  )
}
