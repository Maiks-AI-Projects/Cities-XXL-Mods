import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { extractMcpkEntry, listMcpkEntries } from './mcpk.mjs'

const [archivePath, pathPatternText = '[.]class$', contentPatternText = 'bonus'] = process.argv.slice(2)
if (!archivePath) {
  console.error('Usage: npm run inspect-classes -- <archive.pak> [path-regex] [content-regex]')
  process.exitCode = 1
} else {
  const pathPattern = new RegExp(pathPatternText, 'i')
  const contentPattern = new RegExp(contentPatternText, 'i')
  const archive = await readFile(archivePath)
  const inspected = listMcpkEntries(archive)
  let matches = 0
  for (const entry of inspected.entries.filter((candidate) => pathPattern.test(candidate.name))) {
    const text = extractMcpkEntry(archive, entry).toString('utf8')
    const lines = text.split(/\r?\n/).filter((line) => contentPattern.test(line))
    if (lines.length === 0) continue
    matches += 1
    console.log(entry.name)
    for (const line of lines) console.log(`  ${line.trim()}`)
  }
  console.error(`${basename(archivePath)}: ${matches} matching files`)
}
