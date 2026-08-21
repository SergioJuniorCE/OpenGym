import { describe, expect, it } from 'vitest'
import { CYCLE_WEEKS, REST_DAY, copyCycleWeekTo, copyCycleWeekToAll, copyWeekToCycle, cycleAssignment, cycleWeekForDate, defaultCycleStart, mondayISO } from './planning'

describe('four-week planning', () => {
  it('normalises cycle starts to Monday and repeats every four weeks', () => {
    expect(mondayISO('2026-01-07')).toBe('2026-01-05')
    expect(defaultCycleStart(new Date(2026, 0, 7))).toBe('2026-01-05')
    expect(CYCLE_WEEKS).toEqual([1, 2, 3, 4])
    expect(cycleWeekForDate('2026-01-05', '2026-01-05')).toBe(1)
    expect(cycleWeekForDate('2026-01-26', '2026-01-05')).toBe(4)
    expect(cycleWeekForDate('2026-02-02', '2026-01-05')).toBe(1)
  })

  it('resolves a date to the cycle week and weekday assignment', () => {
    const plan = {
      '1': { '1': 'push', '3': 'pull' },
      '2': { '1': 'legs' },
    }
    expect(cycleAssignment(plan, '2026-01-05', '2026-01-05')).toBe('push')
    expect(cycleAssignment(plan, '2026-01-12', '2026-01-05')).toBe('legs')
    expect(cycleAssignment(plan, '2026-01-13', '2026-01-05')).toBeUndefined()
  })

  it('copies the recurring week to all four weeks with explicit rest days', () => {
    const plan = copyWeekToCycle({ '1': 'push', '3': 'pull', '5': 'legs' })
    expect(Object.keys(plan)).toEqual(['1', '2', '3', '4'])
    expect(plan['1']['1']).toBe('push')
    expect(plan['4']['3']).toBe('pull')
    expect(plan['2']['0']).toBe(REST_DAY)
    expect(Object.keys(plan['1'])).toHaveLength(7)
  })

  it('copies the selected cycle week to all four weeks', () => {
    const plan = copyCycleWeekToAll({
      '1': { '1': 'push', '3': REST_DAY },
      '2': { '1': 'wrong' },
      '3': { '5': 'wrong' },
      '4': { '0': 'wrong' },
    }, 1)

    expect(plan).toEqual({
      '1': { '1': 'push', '3': REST_DAY },
      '2': { '1': 'push', '3': REST_DAY },
      '3': { '1': 'push', '3': REST_DAY },
      '4': { '1': 'push', '3': REST_DAY },
    })
  })

  it('copies the selected cycle week to one destination week', () => {
    const plan = copyCycleWeekTo({
      '1': { '1': 'push', '3': REST_DAY },
      '2': { '1': 'wrong' },
      '3': { '5': 'keep' },
      '4': { '0': 'keep' },
    }, 1, 2)

    expect(plan).toEqual({
      '1': { '1': 'push', '3': REST_DAY },
      '2': { '1': 'push', '3': REST_DAY },
      '3': { '5': 'keep' },
      '4': { '0': 'keep' },
    })
  })
})
