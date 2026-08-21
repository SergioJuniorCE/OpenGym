import { describe, expect, it } from 'vitest'
import { createMediaMiddleware } from './dev-media'

const MEDIA_ROOT = new URL('../../../../media/', import.meta.url)

function invoke(url: string) {
  return new Promise<{ statusCode: number; contentType: string | undefined; body: Buffer; next: boolean }>((resolve, reject) => {
    const chunks: Buffer[] = []
    const response = {
      statusCode: 0,
      headers: new Map<string, string>(),
      setHeader(name: string, value: string) { this.headers.set(name, value) },
      end(body?: Uint8Array) {
        if (body) chunks.push(Buffer.from(body))
        resolve({
          statusCode: this.statusCode,
          contentType: this.headers.get('Content-Type'),
          body: Buffer.concat(chunks),
          next: false,
        })
      },
    }
    createMediaMiddleware(MEDIA_ROOT)(
      { url },
      response,
      () => resolve({ statusCode: 404, contentType: undefined, body: Buffer.alloc(0), next: true }),
    ).catch(reject)
  })
}

describe('local development media middleware', () => {
  it('serves the tracked GIF files through the Vite URL', async () => {
    const result = await invoke('/gif/0001-2gPfomN.gif')

    expect(result.next).toBe(false)
    expect(result.statusCode).toBe(200)
    expect(result.contentType).toBe('image/gif')
    expect(result.body.subarray(0, 6).toString('ascii')).toBe('GIF89a')
  })

  it('passes unknown or unsafe media paths to Vite', async () => {
    await expect(invoke('/gif/missing.gif')).resolves.toMatchObject({ next: true })
    await expect(invoke('/gif/../package.json')).resolves.toMatchObject({ next: true })
  })
})
