import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { listMcpkEntries } from './mcpk.mjs'

const [archivePath, patternText = ''] = process.argv.slice(2)
if (!archivePath) {
  console.error('Usage: npm run scan -- <archive.pak> [regular-expression]')
  process.exitCode = 1
} else {
  const pattern = new RegExp(patternText, 'i')
  const archive = await readFile(archivePath)
  const inspected = listMcpkEntries(archive)
  const matches = inspected.entries.filter((entry) => pattern.test(entry.name))
  console.log(`${basename(archivePath)}: MCPK build ${inspected.build}, ${inspected.entries.length} files, ${matches.length} matches`)
  for (const entry of matches) console.log(entry.name)
}
