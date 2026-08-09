import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { extractMcpkEntry, listMcpkEntries } from './mcpk.mjs'

const [archivePath, entryPath, patternText = '', contextText = '0'] = process.argv.slice(2)
if (!archivePath || !entryPath) {
  console.error('Usage: node tools/inspect-game-entry.mjs <archive.pak> <entry-path> [content-regex] [context-lines]')
  process.exitCode = 1
} else {
  const context = Number(contextText)
  if (!Number.isSafeInteger(context) || context < 0) throw new Error('Context lines must be a non-negative integer.')

  const archive = await readFile(archivePath)
  const inspected = listMcpkEntries(archive)
  const entry = inspected.entries.find((candidate) => candidate.name === entryPath)
  if (!entry) throw new Error(`Archive entry not found: ${entryPath}`)

  const lines = extractMcpkEntry(archive, entry).toString('latin1').split(/\r?\n/)
  const selected = new Set()
  if (patternText === '') {
    for (let index = 0; index < lines.length; index += 1) selected.add(index)
  } else {
    const pattern = new RegExp(patternText, 'i')
    for (let index = 0; index < lines.length; index += 1) {
      if (!pattern.test(lines[index])) continue
      const first = Math.max(0, index - context)
      const last = Math.min(lines.length - 1, index + context)
      for (let selectedIndex = first; selectedIndex <= last; selectedIndex += 1) selected.add(selectedIndex)
    }
  }

  console.error(`${basename(archivePath)} (MCPK build ${inspected.build}): ${entryPath}`)
  let previous = -2
  for (const index of [...selected].sort((left, right) => left - right)) {
    if (index > previous + 1) console.log('...')
    console.log(`${String(index + 1).padStart(5)} | ${lines[index]}`)
    previous = index
  }
}
