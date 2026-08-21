import { beforeEach, describe, expect, it } from 'vitest'

const storage = new Map<string, string>()
globalThis.localStorage = {
  getItem: key => storage.get(key) || null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key)
} as any
globalThis.document = {
  addEventListener() {},
  removeEventListener() {}
} as any

const [{ bwSheet }, { useUI }] = await Promise.all([
  import('./sheets'),
  import('./store/useUI')
])

describe('start check-in sheet', () => {
  beforeEach(() => useUI.setState({ sheets: [] }))

  it('can be dismissed before starting a workout', () => {
    const handle = bwSheet({ required: true })
    const [sheet] = useUI.getState().sheets

    expect(sheet.locked).toBe(false)

    handle.close()
    expect(useUI.getState().sheets).toHaveLength(0)
  })
})
