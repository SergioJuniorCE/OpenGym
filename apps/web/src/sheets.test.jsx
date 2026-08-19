import { beforeEach, describe, expect, it } from 'vitest'

const storage = new Map()
globalThis.localStorage = {
  getItem: key => storage.get(key) || null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key)
}
globalThis.document = {
  addEventListener() {},
  removeEventListener() {}
}

const [{ bwSheet }, { useUI }] = await Promise.all([
  import('./sheets.jsx'),
  import('./store/useUI.js')
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
