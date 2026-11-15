import { formatDate } from '../lib/format'

const LEVELS = [
  'bg-slate-100',
  'bg-emerald-100',
  'bg-emerald-200',
  'bg-emerald-300',
  'bg-emerald-500',
]

function parseISO(value) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function iso(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(date, amount) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + amount)
  return copy
}

function levelFor(day) {
  if (!day || day.empty || day.completed === 0) return 0
  let level = Math.min(4, day.completed)
  if (day.total > 0 && day.ratio >= 1) level = 4
  return level
}

function dayLabel(day) {
  if (day.total > 0) {
    return `${day.completed}/${day.total} tasks completed`
  }
  return `${day.completed} task${day.completed === 1 ? '' : 's'} completed`
}

function buildWeeks(days, limitWeeks) {
  if (!days.length) return []
  const byDate = new Map(days.map((day) => [day.date, day]))
  const first = parseISO(days[0].date)
  const last = parseISO(days[days.length - 1].date)
  const gridStart = addDays(first, -first.getDay())
  const totalDays = Math.round((last - gridStart) / 86400000) + 1
  let weekCount = Math.ceil(totalDays / 7)
  weekCount = limitWeeks ? Math.min(limitWeeks, weekCount) : weekCount
  const startWeek = limitWeeks ? Math.max(0, Math.ceil(totalDays / 7) - weekCount) : 0

  const weeks = []
  for (let weekIndex = startWeek; weekIndex < startWeek + weekCount; weekIndex++) {
    const week = []
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const date = addDays(gridStart, weekIndex * 7 + dayIndex)
      const dateString = iso(date)
      const value = byDate.get(dateString)
      week.push({
        date: dateString,
        completed: value?.completed || 0,
        total: value?.total || 0,
        ratio: value?.ratio || 0,
        empty: date < first || date > last,
      })
    }
    weeks.push(week)
  }
  return weeks
}

export default function ActivityHeatmap({
  days = [],
  onSelect,
  selectedDate,
  limitWeeks,
  showLegend = true,
  showMonths = true,
}) {
  const weeks = buildWeeks(days, limitWeeks)

  if (!days.length) {
    return <p className="text-sm text-slate-500">No activity yet. Complete a habit to start the map.</p>
  }

  return (
    <div>
      {showMonths && (
        <div className="mb-1 flex gap-[3px] overflow-hidden">
          {weeks.map((week, index) => {
            const month = new Date(`${week[0].date}T00:00:00`).toLocaleDateString(undefined, {
              month: 'short',
            })
            const previousMonth =
              index > 0
                ? new Date(`${weeks[index - 1][0].date}T00:00:00`).toLocaleDateString(undefined, {
                    month: 'short',
                  })
                : null
            return (
              <div
                key={week[0].date}
                className="w-3 shrink-0 text-[9px] font-medium uppercase tracking-wide text-slate-400"
              >
                {month !== previousMonth ? month : ''}
              </div>
            )
          })}
        </div>
      )}

      <div className="flex gap-[3px] overflow-x-auto pb-1">
        {weeks.map((week) => (
          <div key={week[0].date} className="flex shrink-0 flex-col gap-[3px]">
            {week.map((day) => {
              const selected = selectedDate === day.date
              return (
                <button
                  key={day.date}
                  type="button"
                  disabled={day.empty}
                  onClick={() => !day.empty && onSelect?.(day)}
                  title={
                    day.empty
                      ? ''
                      : `${formatDate(day.date)} · ${dayLabel(day)}`
                  }
                  aria-label={
                    day.empty ? '' : `${formatDate(day.date)}: ${dayLabel(day)}`
                  }
                  className={`h-3 w-3 rounded-[3px] transition ${
                    day.empty ? 'cursor-default bg-transparent' : LEVELS[levelFor(day)]
                  } ${
                    selected
                      ? 'ring-2 ring-brand-500 ring-offset-1'
                      : !day.empty
                        ? 'hover:ring-2 hover:ring-brand-300'
                        : ''
                  }`}
                />
              )
            })}
          </div>
        ))}
      </div>

      {showLegend && (
        <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-slate-400">
          <span>Less</span>
          {LEVELS.map((level) => (
            <span key={level} className={`h-3 w-3 rounded-[3px] ${level}`} />
          ))}
          <span>More</span>
        </div>
      )}
    </div>
  )
}
