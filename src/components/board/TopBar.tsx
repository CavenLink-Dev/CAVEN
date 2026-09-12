import type { ReactNode } from "react"
import { memo, useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import logoImg from "../../imports/image-6.png"
import wordmarkImg from "../../imports/image-5.png"

export type Page = "main" | "finance" | "journal" | "brain" | "settings"

const NAV_PAGES: { id: Page label: string }[] = [
  { id: "main", label: "CAVEN" },
  { id: "finance", label: "FINANCE" },
  { id: "journal", label: "JOURNAL" },
  { id: "brain", label: "BRAIN" },
  { id: "settings", label: "SETTING" },
]

const TIME_FMT = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})
const DATE_FMT = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
})

function stamp(now: Date): string {
  // "09:42 · Thu 11 Sep" — locale order kept, separators normalised.
  return `${TIME_FMT.format(now)} · ${DATE_FMT.format(now).replace(/,/g, "")}`
}

function useClock(): string {
  const [now, setNow] = useState(() => stamp(new Date()))
  useEffect(() => {
    const id = window.setInterval(() => setNow(stamp(new Date())), 15_000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

function useAccountInitial(): string {
  const [initial, setInitial] = useState("·")
  useEffect(() => {
    let live = true
    const read = (email: string | null | undefined) => {
      const letter = email?.trim().charAt(0)
      setInitial(letter ? letter.toUpperCase() : "·")
    }
    supabase.auth.getSession().then(({ data }) => {
      if (live) read(data.session?.user.email)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (live) read(session?.user.email)
    })
    return () => {
      live = false
      data.subscription.unsubscribe()
    }
  }, [])
  return initial
}

function TopBarBase({
  page,
  onPageChange,
  actions,
}: {
  page: Page
  onPageChange: (p: Page) => void
  actions?: ReactNode
}) {
  const clock = useClock()
  const initial = useAccountInitial()

  return (
    <header
      className="topbar"
      style={{ paddingTop: "0px", paddingBottom: "0px" }}
    >
      <div
        className="relative flex items-center gap-3 group select-none"
        style={{ rowGap: "12px" }}
      >
        <div className="absolute inset-0 bg-cyan-500/20 opacity-0 group-hover:opacity-100 blur-xl rounded-full transition-opacity duration-700"></div>
        <img
          src={logoImg}
          alt="CAVEN Logo"
          className="relative h-[52px] w-[52px] object-contain drop-shadow-[0_0_8px_rgba(34,211,238,0.4)] [filter:invert(1)_hue-rotate(180deg)_drop-shadow(0_0_8px_rgba(34,211,238,0.4))]"
        />
        <img
          src={wordmarkImg}
          alt="CAVEN"
          className="relative h-[24px] w-auto object-contain [filter:invert(1)_hue-rotate(180deg)_drop-shadow(0_0_6px_rgba(34,211,238,0.45))]"
        />
      </div>
      <nav
        className="topbar-nav"
        style={{
          width: "fit-content",
          paddingTop: "4px",
          paddingBottom: "4px",
          alignItems: "center",
        }}
      >
        {NAV_PAGES.map(({ id, label }) => {
          const active = page === id
          return (
            <button
              key={id}
              onClick={() => onPageChange(id)}
              className={`topbar-nav-item ${active ? "is-active" : ""}`}
              style={
                active
                  ? { color: "rgb(255, 255, 255)", fontWeight: 700 }
                  : { color: "rgb(171, 171, 171)" }
              }
              type="button"
              aria-current={active ? "page" : undefined}
            >
              {label}
            </button>
          )
        })}
      </nav>
      <div className="flex items-center gap-4" style={{ alignItems: "center" }}>
        <span
          className="rounded-full border border-cyan-200/15 bg-cyan-100/5 font-bold text-cyan-100"
          style={{
            height: "47px",
            width: "47px",
            paddingTop: "0px",
            paddingRight: "16px",
            paddingBottom: "0px",
            paddingLeft: "16px",
            fontSize: "var(--fs-h2)",
            fontFamily: "var(--font-body)",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {initial}
        </span>
        <time
          className="hud-label"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--fs-meta)",
            color: "rgba(255, 255, 255, 0.9)",
            padding: "0px",
          }}
        >
          {clock}
        </time>
        {actions}
      </div>
    </header>
  )
}

// Memoised: useCaven() streams amplitude from App, and without this every
// frame of CAVEN speaking re-rendered this component for no reason.
export const TopBar = memo(TopBarBase)
