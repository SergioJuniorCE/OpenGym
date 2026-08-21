import { readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { isAbsolute, relative, resolve } from 'node:path'

type MediaRequest = { url?: string }
type MediaResponse = {
  statusCode: number
  setHeader(name: string, value: string): void
  end(body?: Uint8Array): void
}

const CONTENT_TYPES: Record<string, string> = {
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

function asPath(root: string | URL) {
  return root instanceof URL ? fileURLToPath(root) : root
}

function isInside(root: string, file: string) {
  const child = relative(root, file)
  return child !== '' && !child.startsWith('..') && !isAbsolute(child)
}

/**
 * Serves the checked-in exercise media when Vite runs without a MEDIA_TARGET.
 * Production keeps serving the same /img and /gif URLs from nginx; this only
 * fills the local-dev gap where Vite cannot serve a directory outside apps/web.
 */
export function createMediaMiddleware(mediaRoot: string | URL) {
  const root = resolve(asPath(mediaRoot))

  return async (request: MediaRequest, response: MediaResponse, next: () => void) => {
    const pathname = new URL(request.url || '/', 'http://localhost').pathname
    const match = /^\/(img|gif)\/(.+)$/.exec(pathname)
    if (!match) return next()

    let relativeName: string
    try {
      relativeName = decodeURIComponent(match[2])
    } catch {
      return next()
    }

    const file = resolve(root, match[1], relativeName)
    if (!isInside(root, file)) return next()

    try {
      const details = await stat(file)
      if (!details.isFile()) return next()
      response.statusCode = 200
      response.setHeader('Content-Type', CONTENT_TYPES[file.slice(file.lastIndexOf('.')).toLowerCase()] || 'application/octet-stream')
      response.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      response.end(await readFile(file))
    } catch {
      next()
    }
  }
}
