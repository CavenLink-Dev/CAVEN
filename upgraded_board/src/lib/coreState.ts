import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import type { ReactNode } from "react"

export type CoreState = "idle" | "listening" | "thinking" | "speaking" | "success"

// V6 power model — three colors only: green (on), red (off), blue (locked / listening).
export type PowerState = "off" | "on" | "powering-off" | "locked"
export type PulseType = "green" | "red" | "blue"

export type ActiveModule = "overview" | "tasks" | "calendar" | "reminders"

const states: CoreState[] = [
  "idle",
  "listening",
  "thinking",
  "speaking",
  "success",
]
const CoreContext = createContext<{
  state: CoreState
  advance: () => void
  setState: (state: CoreState) => void
  power: PowerState
  pulse: { id: number type: PulseType }
  powerOn: () => void
  powerOff: () => void
  lock: () => void
  activeModules: Record<ActiveModule, boolean>
  toggleModule: (module: ActiveModule) => void
  setAllModules: (active: boolean) => void
  lastAction: string | null
}>({
  state: "idle",
  advance: () => {},
  setState: () => {},
  power: "off",
  pulse: { id: 0, type: "green" },
  powerOn: () => {},
  powerOff: () => {},
  lock: () => {},
  activeModules: {
    overview: true,
    tasks: true,
    calendar: true,
    reminders: true,
  },
  toggleModule: () => {},
  setAllModules: () => {},
  lastAction: null,
})

export function CoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CoreState>("idle")
  const [activeModules, setActiveModules] =
    useState<Record<ActiveModule, boolean>>({
      overview: true,
      tasks: true,
      calendar: true,
      reminders: true,
    })
  const [lastAction, setLastAction] = useState<string | null>("CORE OFFLINE ")

  const [power, setPower] = useState<PowerState>("off")
  const [pulse, setPulse] = useState<{ id: number type: PulseType }>({
    id: 0,
    type: "green",
  })
  const pulseId = useRef(0)
  const offTimer = useRef<number | undefined>(undefined)

  const emitPulse = (type: PulseType) => {
    pulseId.current += 1
    setPulse({ id: pulseId.current, type })
  }

  // Single tap → energize. Green pulse, gears spin up.
  const powerOn = () => {
    window.clearTimeout(offTimer.current)
    setPower("on")
    emitPulse("green")
    setLastAction("CORE online")
  }

  // Press & hold → red pulse, then fade to no color and off.
  const powerOff = () => {
    setPower("powering-off")
    emitPulse("red")
    setLastAction("CORE POWERING DOWN...")
    window.clearTimeout(offTimer.current)
    offTimer.current = window.setTimeout(() => {
      setPower("off")
      setLastAction("CORE OFFLINE")
    }, 780)
  }

  // Double tap → toggle lock. Stays locked (light-blue) until double-tapped again,
  // which releases it back to the online state.
  const lock = () => {
    window.clearTimeout(offTimer.current)
    setPower((prev) => {
      if (prev === "locked") {
        emitPulse("green")
        setLastAction("CORE UNLOCKED")
        return "on"
      }
      emitPulse("blue")
      setLastAction("CORE LOCKED")
      return "locked"
    })
  }

  useEffect(() => () => window.clearTimeout(offTimer.current), [])

  const advance = () => {
    const nextIndex = (states.indexOf(state) + 1) % states.length
    const nextState = states[nextIndex]
    setState(nextState)
  }

  const toggleModule = (mod: ActiveModule) => {
    setActiveModules((prev) => {
      const nextVal = !prev[mod]
      setLastAction(
        `CAVEN ${
          nextVal ? "PROJECTED" : "BEAMED OUT"
        } ${mod.toUpperCase()} BOARD`,
      )
      return { ...prev, [mod]: nextVal }
    })
  }

  const setAllModules = (active: boolean) => {
    setActiveModules({
      overview: active,
      tasks: active,
      calendar: active,
      reminders: active,
    })
    setLastAction(
      active
        ? "CAVEN RE-PROJECTED ALL HOLO-BOARDS"
        : "CAVEN STOWED ALL HOLO-BOARDS",
    )
  }

  useEffect(() => {
    if (state === "listening") {
      setLastAction("ANALYZING VOICE COMMAND...")
    } else if (state === "thinking") {
      setLastAction("PROCESSING CORE INTELLIGENCE...")
      const timer = window.setTimeout(() => {
        setState("speaking")
        // Randomly toggle or re-project a board on conversation
        setLastAction('CAVEN: "Projection matrix updated based on query."')
      }, 1700)
      return () => window.clearTimeout(timer)
    } else if (state === "speaking") {
      setLastAction("CAVEN RESPONDING VIA HUD PROJECTION")
      const timer = window.setTimeout(() => {
        setState("idle")
      }, 2500)
      return () => window.clearTimeout(timer)
    } else if (state === "success") {
      setLastAction("COMMAND EXECUTED SUCCESSFULLY")
      const timer = window.setTimeout(() => setState("idle"), 1300)
      return () => window.clearTimeout(timer)
    }
  }, [state])

  return createElement(
    CoreContext.Provider,
    {
      value: {
        state,
        setState,
        advance,
        power,
        pulse,
        powerOn,
        powerOff,
        lock,
        activeModules,
        toggleModule,
        setAllModules,
        lastAction,
      },
    },
    children,
  )
}

export const useCore = () => useContext(CoreContext)
