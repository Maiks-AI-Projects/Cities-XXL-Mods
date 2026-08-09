import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractMcpkEntry, listMcpkEntries } from '../../tools/mcpk.mjs'

const VERSION = '0.1.0-observer'
const PATCH_NAME = 'zzz_CitiesXXL_IntercityCommutersObserver_1_5_0.patch'
const DLL_NAME = 'cxxlcommuters.dll'
const EXTENSION_PATH = 'data/design/script/interface/mapsavemgr.master'

const modRoot = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(modRoot, '..', '..')
const nativePath = join(modRoot, 'dist', DLL_NAME)
const patchPath = join(repositoryRoot, 'dist', 'intercity-commuters-fix', PATCH_NAME)
const output = join(repositoryRoot, 'dist', 'intercity-commuters-fix', VERSION)

function sha256(contents) {
  return createHash('sha256').update(contents).digest('hex')
}

const [dll, patch] = await Promise.all([readFile(nativePath), readFile(patchPath)])
if (dll.subarray(0, 2).toString('ascii') !== 'MZ') throw new Error('Native observer is not a PE file.')
const peOffset = dll.readUInt32LE(0x3c)
if (dll.subarray(peOffset, peOffset + 4).toString('binary') !== 'PE\0\0') throw new Error('Native observer has no PE signature.')
if (dll.readUInt16LE(peOffset + 4) !== 0x14c) throw new Error('Native observer is not x86/i386.')
if ((dll.readUInt16LE(peOffset + 22) & 0x2000) === 0) throw new Error('Native observer is not marked as a DLL.')
if (dll.readUInt16LE(peOffset + 24) !== 0x10b) throw new Error('Native observer is not PE32.')
if (!dll.includes(Buffer.from('luaopen_cxxlcommuters\0', 'ascii'))) {
  throw new Error('Native observer is missing the Lua entry-point name.')
}
if (!dll.includes(Buffer.from('observer-only mode; no hooks installed\0', 'ascii'))) {
  throw new Error('Native observer is missing the no-hooks status marker.')
}

const archive = listMcpkEntries(patch)
if (archive.entries.length !== 1 || archive.entries[0].name !== EXTENSION_PATH) {
  throw new Error('Observer patch is not the expected single additive Lua entry.')
}
const loader = extractMcpkEntry(patch, archive.entries[0])
if (!loader.includes(Buffer.from('observer-only bootstrap', 'ascii'))) {
  throw new Error('Observer patch is missing its read-only bootstrap marker.')
}

await mkdir(output, { recursive: true })
await Promise.all([
  copyFile(nativePath, join(output, DLL_NAME)),
  copyFile(patchPath, join(output, PATCH_NAME))
])
const manifest = {
  version: VERSION,
  target: 'Cities XXL 1.5.0 / CitiesXXL.exe 2.0.1.5 / x86',
  observerOnly: true,
  behaviorHooks: false,
  saveWrites: false,
  files: {
    [DLL_NAME]: {
      sha256: sha256(dll),
      install: '<Cities XXL>/cxxlcommuters.dll'
    },
    [PATCH_NAME]: {
      sha256: sha256(patch),
      install: `<Cities XXL>/Paks/${PATCH_NAME}`,
      entries: [EXTENSION_PATH]
    }
  },
  expectedGame: {
    executableSha256: 'fe80c2974dd71c488c7da7037466b1756e6e2e6be5d5d6727c23ac8f1ed760f4',
    dataPakSha256: 'aadac92c0e2e8dd8649066b21a1a9af18f4639332b54d227faeb1991894bf8f4'
  },
  removal: `Close Cities XXL, then delete only ${DLL_NAME} and ${PATCH_NAME}.`
}
await writeFile(join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Packaged observer test at ${output}`)
console.log(`DLL SHA-256:   ${manifest.files[DLL_NAME].sha256}`)
console.log(`Patch SHA-256: ${manifest.files[PATCH_NAME].sha256}`)
