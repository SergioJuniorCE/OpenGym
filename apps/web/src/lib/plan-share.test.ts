import { describe, expect, it } from 'vitest'
import { buildPlanBundle, mergePlan, parsePlan } from './plan-share'

describe('four-week plan sharing', () => {
  it('round-trips cycle assignments alongside the weekly schedule', () => {
    const state = {
      unit: 'kg',
      routines: [{ id: 'push', name: 'Push', emoji: 'P', ex: [{ id: '0025', sets: 3, reps: 10 }] }],
      week: { 1: 'push' },
      cycleStart: '2026-01-05',
      cyclePlan: { '1': { '1': 'push', '2': 'rest' }, '3': { '5': 'push' } },
      customEx: [],
    }

    const parsed = parsePlan(buildPlanBundle(state, 'Four-week plan'))
    expect(parsed.cyclePlan).toEqual(state.cyclePlan)
    expect(parsed.cycleStart).toBe(state.cycleStart)
    expect(parsed.scheduledDays).toBe(4)
  })

  it('maps imported cycle routine ids to fresh local routines', () => {
    const bundle = parsePlan({
      opengym_plan: 3,
      routines: [{ id: 'remote', name: 'Remote', ex: [] }],
      week: {},
      cycleStart: '2026-01-05',
      cyclePlan: { '1': { '1': 'remote', '2': 'rest' } },
      customEx: [],
    })
    const state = { routines: [], week: {}, cyclePlan: {}, cycleStart: '' }

    mergePlan(state, bundle, { schedule: true })

    expect(state.cyclePlan['1']['1']).toBe(state.routines[0].id)
    expect(state.cyclePlan['1']['2']).toBe('rest')
    expect(state.cycleStart).toBe('2026-01-05')
  })
})
