import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { extractMcpkEntry, listMcpkEntries } from './mcpk.mjs'

const [archivePath, outputPath, patternText = '.'] = process.argv.slice(2)

if (!archivePath || !outputPath) {
  console.error('Usage: node tools/extract-game-files.mjs <archive.pak> <output-directory> [path-regex]')
  process.exitCode = 1
} else {
  const outputRoot = resolve(outputPath)
  const pattern = new RegExp(patternText, 'i')
  const archive = await readFile(archivePath)
  const inspected = listMcpkEntries(archive)
  const entries = inspected.entries.filter((entry) => pattern.test(entry.name))

  for (const entry of entries) {
    const destination = resolve(outputRoot, ...entry.name.split('/'))
    if (!destination.startsWith(`${outputRoot}${sep}`)) {
      throw new Error(`Refusing unsafe archive path: ${entry.name}`)
    }
    await mkdir(dirname(destination), { recursive: true })
    await writeFile(destination, extractMcpkEntry(archive, entry))
  }

  console.log(`Extracted ${entries.length} of ${inspected.entries.length} files into ${outputRoot}`)
}
