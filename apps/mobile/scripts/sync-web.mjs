#!/usr/bin/env node
// Flatten the Vite mobile build into the single HTML asset consumed by the Expo WebView.
// The mobile Vite config already inlines dynamic imports; this step also inlines the emitted
// CSS and entry script so the native bundle does not need a second local asset server.

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..', '..', '..')
const dist = join(root, 'apps', 'web', 'dist')
const source = join(dist, 'index.html')
const output = join(root, 'apps', 'mobile', 'assets', 'opengym.html')

const assetPath = ref => join(dist, decodeURIComponent(ref.split(/[?#]/, 1)[0]).replace(/^\.?\//, '').replace(/^\/+/, ''))

async function replaceAsync(input, pattern, replace) {
  const matches = [...input.matchAll(pattern)]
  let result = ''
  let offset = 0
  for (const match of matches) {
    result += input.slice(offset, match.index)
    result += await replace(match[0], ...match.slice(1))
    offset = match.index + match[0].length
  }
  return result + input.slice(offset)
}

let html
try {
  html = await readFile(source, 'utf8')
} catch (error) {
  throw new Error(`Missing ${source}. Run the frontend mobile build first.`, { cause: error })
}

// Modulepreload hints only point at files that are about to be inlined.
html = html.replace(/<link\b[^>]*rel=["']modulepreload["'][^>]*>\s*/gi, '')

html = await replaceAsync(html, /<link\b([^>]*?)>/gi, async (tag, attrs) => {
  if (!/rel=["']stylesheet["']/i.test(attrs)) return tag
  const href = attrs.match(/href=["']([^"']+)["']/i)?.[1]
  if (!href) return tag
  const css = await readFile(assetPath(href), 'utf8')
  return `<style data-opengym-source="${href}">\n${css}\n</style>`
})

html = await replaceAsync(html, /<script\b([^>]*?)src=["']([^"']+)["']([^>]*)><\/script>/gi, async (tag, before, src, after) => {
  const js = await readFile(assetPath(src), 'utf8')
  // A literal closing script tag would terminate the HTML wrapper before WebView sees it.
  return `<script${before}${after}>${js.replace(/<\/script/gi, '<\\/script')}</script>`
})

await mkdir(dirname(output), { recursive: true })
await writeFile(output, html)
console.log(`Expo WebView bundle: ${output}`)
