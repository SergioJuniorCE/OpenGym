#!/usr/bin/env node
// Regenerates the per-language exercise instruction packs in apps/web/src/instr/
// from the upstream dataset (hasaneyldrm/exercises-dataset). English stays inline
// in exercises-data.ts; every other language ships as its own lazy-loaded pack.
//
//   node scripts/build-instructions.ts [path-to-exercises.json]
//
// Without an argument the dataset is downloaded from the upstream repo.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const UPSTREAM =
  'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json'
const LANGUAGES = ['es', 'fr', 'it', 'tr', 'ru', 'zh', 'hi', 'pl', 'ko'] as const

type Language = (typeof LANGUAGES)[number]
type JsonObject = Record<string, unknown>
type InstructionPack = Record<string, string[]>

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readInstructionSteps(
  exercise: JsonObject,
  language: Language,
): string[] | undefined {
  const translations = exercise.instruction_steps
  if (!isObject(translations)) return undefined

  const steps = translations[language]
  return Array.isArray(steps) && steps.every(step => typeof step === 'string')
    ? steps
    : undefined
}

async function readDataset(sourcePath?: string): Promise<unknown> {
  if (sourcePath) return JSON.parse(readFileSync(sourcePath, 'utf8')) as unknown

  console.log('Downloading upstream dataset…')
  const response = await fetch(UPSTREAM)
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`)
  return (await response.json()) as unknown
}

export async function buildInstructionPacks(sourcePath?: string): Promise<void> {
  const data = await readDataset(sourcePath)
  if (!Array.isArray(data)) throw new TypeError('Exercise dataset must be an array')

  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const outputDirectory = join(root, 'apps', 'web', 'src', 'instr')
  mkdirSync(outputDirectory, { recursive: true })

  for (const language of LANGUAGES) {
    const pack: InstructionPack = Object.create(null) as InstructionPack

    data.forEach((candidate, index) => {
      if (!isObject(candidate)) {
        throw new TypeError(`Exercise at index ${index} must be an object`)
      }

      const { id } = candidate
      if (typeof id !== 'string' && typeof id !== 'number') {
        throw new TypeError(`Exercise at index ${index} has no string or numeric id`)
      }

      const steps = readInstructionSteps(candidate, language)
      if (steps?.length) pack[String(id)] = steps
    })

    const outputPath = join(outputDirectory, `${language}.ts`)
    const generatedSource =
      `// generated instruction data — do not edit\n` +
      `export default ${JSON.stringify(pack)}\n`
    writeFileSync(outputPath, generatedSource, 'utf8')
    console.log(`${outputPath}: ${Object.keys(pack).length} exercises`)
  }
}

const entryPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined
if (entryPath === import.meta.url) {
  await buildInstructionPacks(process.argv[2] ? resolve(process.argv[2]) : undefined)
}
