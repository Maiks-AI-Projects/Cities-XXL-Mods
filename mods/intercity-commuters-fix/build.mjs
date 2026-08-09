import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createMcpkArchive, extractMcpkEntry, listMcpkEntries } from '../../tools/mcpk.mjs'

const EXPECTED_DATA_PAK_SHA256 = 'aadac92c0e2e8dd8649066b21a1a9af18f4639332b54d227faeb1991894bf8f4'
const OUTPUT_NAME = 'zzz_CitiesXXL_IntercityCommutersObserver_1_5_0.patch'
const MAP_SAVE_PATH = 'data/design/script/interface/mapsavemgr.lua'
const EXTENSION_PATH = 'data/design/script/interface/mapsavemgr.master'
const EXPECTED_EXTENSION_CALL = 'GameUpdate:DoFile("Data/Design/Script/interface/MapSaveMgr.master")'

const modRoot = dirname(fileURLToPath(import.meta.url))
const gameInstall = resolve(process.argv[2] ?? process.env.CITIES_XXL_INSTALL ?? '')
if (!process.argv[2] && !process.env.CITIES_XXL_INSTALL) {
  throw new Error('Pass the Cities XXL installation folder or set CITIES_XXL_INSTALL.')
}

const sourcePath = join(gameInstall, 'Paks', 'data.pak')
const source = await readFile(sourcePath)
const sourceHash = createHash('sha256').update(source).digest('hex')
if (sourceHash !== EXPECTED_DATA_PAK_SHA256) {
  throw new Error(`Refusing unknown data.pak (${sourceHash}). Expected Cities XXL 1.5.0 ${EXPECTED_DATA_PAK_SHA256}.`)
}

const sourceArchive = listMcpkEntries(source)
const mapSaveEntry = sourceArchive.entries.find((entry) => entry.name.toLowerCase() === MAP_SAVE_PATH)
if (!mapSaveEntry) throw new Error(`Verified data.pak is missing ${MAP_SAVE_PATH}.`)
const mapSaveSource = extractMcpkEntry(source, mapSaveEntry).toString('latin1')
const hookCount = mapSaveSource.split(EXPECTED_EXTENSION_CALL).length - 1
if (hookCount !== 1) {
  throw new Error(`Expected exactly one stock MapSaveMgr.master extension call, found ${hookCount}.`)
}
if (sourceArchive.entries.some((entry) => entry.name.toLowerCase() === EXTENSION_PATH)) {
  throw new Error(`Stock data.pak unexpectedly contains ${EXTENSION_PATH}; refusing to replace it.`)
}

const loader = await readFile(join(modRoot, 'lua', 'mapsavemgr.master'))
if (!loader.includes(Buffer.from('observer-only bootstrap', 'ascii'))) {
  throw new Error('Loader source is missing its observer-only marker.')
}
const patch = createMcpkArchive([{ name: EXTENSION_PATH, contents: loader }], { build: sourceArchive.build })
const verification = listMcpkEntries(patch)
if (verification.entries.length !== 1 || verification.entries[0].name !== EXTENSION_PATH) {
  throw new Error('Generated observer patch contains unexpected entries.')
}
if (!extractMcpkEntry(patch, verification.entries[0]).equals(loader)) {
  throw new Error('Generated observer patch changed the Lua loader bytes.')
}

const outputFolder = resolve('dist', 'intercity-commuters-fix')
await mkdir(outputFolder, { recursive: true })
await writeFile(join(outputFolder, OUTPUT_NAME), patch)
await writeFile(join(outputFolder, 'observer-build-report.json'), `${JSON.stringify({
  source: { path: sourcePath, sha256: sourceHash, build: sourceArchive.build },
  output: OUTPUT_NAME,
  entries: [EXTENSION_PATH],
  behaviorHooks: false,
  saveWrites: false
}, null, 2)}\n`)

console.log(`Built ${join(outputFolder, OUTPUT_NAME)}`)
console.log('Verified one additive MapSaveMgr.master entry; no stock script override and no simulation hooks.')
