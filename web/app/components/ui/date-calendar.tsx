import React from "react"
import { Temporal } from "@js-temporal/polyfill"
import { Button } from "~/components/ui/button"
import { Link } from "react-router"

export type DateCalendarProps = {
  month: Temporal.PlainDate
  setMonth: (next: Temporal.PlainDate) => void
  lang: string
  datesWithPosts: string[] | Set<string>
  currentDateStr: string
  toPath: (dateStr: string) => string
  onNavigate?: () => void
}

export function DateCalendar({
  month,
  setMonth,
  lang,
  datesWithPosts,
  currentDateStr,
  toPath,
  onNavigate,
}: DateCalendarProps) {
  const [view, setView] = React.useState<"days" | "months">("days")
  const datesSet = React.useMemo(() => new Set(datesWithPosts as string[]), [datesWithPosts])

  // Derive the min/max month boundaries from available post dates
  const { minMonth, maxMonth } = React.useMemo(() => {
    let min: Temporal.PlainDate | undefined
    let max: Temporal.PlainDate | undefined
    for (const s of datesSet) {
      const d = Temporal.PlainDate.from(s)
      if (!min || Temporal.PlainDate.compare(d, min) < 0) min = d
      if (!max || Temporal.PlainDate.compare(d, max) > 0) max = d
    }
    return {
      minMonth: min ? min.with({ day: 1 }) : undefined,
      maxMonth: max ? max.with({ day: 1 }) : undefined,
    }
  }, [datesSet])

  const startOfCalendar = React.useMemo(() => {
    const offset = month.dayOfWeek % 7
    return month.subtract({ days: offset })
  }, [month])

  const days = React.useMemo(() => Array.from({ length: 42 }, (_, i) => startOfCalendar.add({ days: i })), [startOfCalendar])

  const isSamePlainDate = (a: Temporal.PlainDate, b: Temporal.PlainDate) => a.equals(b)

  // Reset calendar state and align displayed month to the active date on change
  React.useEffect(() => {
    if (!currentDateStr) return
    setView("days")
    try {
      const activeMonth = Temporal.PlainDate.from(currentDateStr).with({ day: 1 })
      // If parent already controls `month`, this will keep them in sync as well
      setMonth(activeMonth)
    } catch {
      // Ignore invalid dates silently
    }
  }, [currentDateStr, setMonth])

  // Navigation targets and disabled states based on range
  const prevTarget = React.useMemo(
    () => (view === "days" ? month.subtract({ months: 1 }) : month.subtract({ years: 1 })),
    [month, view]
  )
  const nextTarget = React.useMemo(
    () => (view === "days" ? month.add({ months: 1 }) : month.add({ years: 1 })),
    [month, view]
  )
  const prevDisabled = React.useMemo(() => {
    if (!minMonth) return false
    return Temporal.PlainDate.compare(prevTarget, minMonth) < 0
  }, [prevTarget, minMonth])
  const nextDisabled = React.useMemo(() => {
    if (!maxMonth) return false
    return Temporal.PlainDate.compare(nextTarget, maxMonth) > 0
  }, [nextTarget, maxMonth])

  return (
    <div className="w-80 rounded-md border bg-white shadow">
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            disabled={prevDisabled}
            onClick={() => {
              if (prevDisabled) return
              setMonth(prevTarget)
            }}
          >
            ‹
          </Button>
          <button
            type="button"
            className="text-sm font-medium px-2 py-1 rounded hover:bg-gray-100 cursor-pointer"
            onClick={() => setView(view === "days" ? "months" : "days")}
            aria-label={view === "days" ? "Choose month" : "Choose day"}
          >
            {view === "days"
              ? new Intl.DateTimeFormat(lang, { year: "numeric", month: "long" }).format(
                  new Date(`${month.year}-${String(month.month).padStart(2, "0")}-01T00:00:00Z`)
                )
              : `${month.year}`}
          </button>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            disabled={nextDisabled}
            onClick={() => {
              if (nextDisabled) return
              setMonth(nextTarget)
            }}
          >
            ›
          </Button>
        </div>
        {view === "days" ? (
          <>
            <div className="grid grid-cols-7 text-center text-xs text-gray-500 mb-1">
              <div>Sun</div>
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((d) => {
                const inMonth = d.month === month.month && d.year === month.year
                const dateStr = d.toString()
                const clickable = datesSet.has(dateStr)
                const isCurrent = isSamePlainDate(d, Temporal.PlainDate.from(currentDateStr))
                const baseCls = "relative h-9 w-9 select-none rounded-md text-sm flex items-center justify-center transition-colors"
                const inMonthCls = inMonth ? "" : " text-gray-300"
                const currentCls = isCurrent ? " ring-2 ring-blue-400" : ""
                if (clickable) {
                  return (
                    <Link
                      key={dateStr}
                      to={toPath(dateStr)}
                      onClick={onNavigate}
                      className={`${baseCls} ${inMonth ? "text-gray-900" : "text-gray-400"} hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400${currentCls}`}
                      aria-label={dateStr}
                    >
                      {String(d.day)}
                      <span className="absolute bottom-1 h-1 w-1 rounded-full bg-blue-500"></span>
                    </Link>
                  )
                }
                return (
                  <div key={dateStr} className={`${baseCls}${inMonthCls}${currentCls}`}>{String(d.day)}</div>
                )
              })}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
              const isSelected = m === month.month
              const candidate = Temporal.PlainDate.from({ year: month.year, month: m, day: 1 })
              const outOfRange = (minMonth && Temporal.PlainDate.compare(candidate, minMonth) < 0) ||
                (maxMonth && Temporal.PlainDate.compare(candidate, maxMonth) > 0)
              return (
                <button
                  key={m}
                  type="button"
                  className={`h-9 rounded-md text-sm border transition-colors ${
                    isSelected ? "bg-blue-50 border-blue-300 text-blue-700" : outOfRange ? "opacity-40" : "hover:bg-gray-100"
                  } ${
                    outOfRange ? "cursor-not-allowed" : "cursor-pointer"
                  }`}
                  disabled={!!outOfRange}
                  onClick={() => {
                    if (outOfRange) return
                    setMonth(candidate)
                    setView("days")
                  }}
                >
                  {new Intl.DateTimeFormat(lang, { month: "short" }).format(
                    new Date(`${month.year}-${String(m).padStart(2, "0")}-01T00:00:00Z`)
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default DateCalendar
