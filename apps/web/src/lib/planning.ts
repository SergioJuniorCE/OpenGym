export const REST_DAY = 'rest'
export const CYCLE_WEEKS = [1, 2, 3, 4] as const
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

export type ScheduleMap = Record<string, string>
export type CyclePlan = Record<string, ScheduleMap>

function dayNumber(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number)
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000)
}

export function isoForDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function mondayISO(iso: string): string {
  const date = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(date.getTime())) return iso
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return isoForDate(date.getFullYear(), date.getMonth(), date.getDate())
}

export function defaultCycleStart(date = new Date()): string {
  return mondayISO(isoForDate(date.getFullYear(), date.getMonth(), date.getDate()))
}

/** Return the repeating Week 1–4 number for an ISO date. */
export function cycleWeekForDate(iso: string, cycleStart = ''): number {
  const start = mondayISO(cycleStart || defaultCycleStart())
  const elapsedWeeks = Math.floor((dayNumber(iso) - dayNumber(start)) / 7)
  return ((elapsedWeeks % CYCLE_WEEKS.length) + CYCLE_WEEKS.length) % CYCLE_WEEKS.length + 1
}

export function cycleAssignment(plan: CyclePlan | undefined, iso: string, cycleStart = ''): string | undefined {
  const week = cycleWeekForDate(iso, cycleStart)
  const day = new Date(`${iso}T12:00:00`).getDay()
  return plan?.[String(week)]?.[String(day)]
}

/** Copy the recurring week to all four cycle weeks, including explicit rest days. */
export function copyWeekToCycle(week: ScheduleMap | undefined): CyclePlan {
  const cycle: CyclePlan = {}
  CYCLE_WEEKS.forEach(cycleWeek => {
    cycle[String(cycleWeek)] = {}
    WEEK_ORDER.forEach(day => {
      cycle[String(cycleWeek)][String(day)] = week?.[String(day)] || REST_DAY
    })
  })
  return cycle
}

/** Copy the selected cycle week to every week, preserving its explicit assignments and fallbacks. */
export function copyCycleWeekToAll(cyclePlan: CyclePlan | undefined, sourceWeek: number): CyclePlan {
  const source = cyclePlan?.[String(sourceWeek)] || {}
  const cycle: CyclePlan = {}
  CYCLE_WEEKS.forEach(cycleWeek => {
    cycle[String(cycleWeek)] = { ...source }
  })
  return cycle
}

/** Copy the selected cycle week to one destination week without changing the others. */
export function copyCycleWeekTo(cyclePlan: CyclePlan | undefined, sourceWeek: number, targetWeek: number): CyclePlan {
  const cycle: CyclePlan = { ...(cyclePlan || {}) }
  cycle[String(targetWeek)] = { ...(cyclePlan?.[String(sourceWeek)] || {}) }
  return cycle
}
