import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createMcpkArchive, extractMcpkEntry, listMcpkEntries } from '../../tools/mcpk.mjs'

const EXPECTED_DATA_PAK_SHA256 = 'aadac92c0e2e8dd8649066b21a1a9af18f4639332b54d227faeb1991894bf8f4'
const RESOURCES_PATH = 'data/design/script/siminfo/resources.lua'
const EXPECTED_RESOURCES_SHA256 = '34e40a5d3868e5bd91f480bcbe4260da1435765471f26091514f2535ff622217'
const OUTPUT_NAME = 'zzz_CitiesXXL_SelfFundingAirports_Diagnostic_1_5_0.patch'

function sha256(contents) {
  return createHash('sha256').update(contents).digest('hex')
}

function replaceOnce(text, before, after, label) {
  const occurrences = text.split(before).length - 1
  if (occurrences !== 1) throw new Error(`Expected one ${label} hook anchor, found ${occurrences}.`)
  return text.replace(before, after)
}

const gameInstall = resolve(process.argv[2] ?? process.env.CITIES_XXL_INSTALL ?? '')
if (!process.argv[2] && !process.env.CITIES_XXL_INSTALL) {
  throw new Error('Pass the Cities XXL installation folder or set CITIES_XXL_INSTALL.')
}

const sourcePath = join(gameInstall, 'Paks', 'data.pak')
const source = await readFile(sourcePath)
const sourceHash = sha256(source)
if (sourceHash !== EXPECTED_DATA_PAK_SHA256) {
  throw new Error(`Refusing unknown data.pak (${sourceHash}). Expected Cities XXL 1.5.0 ${EXPECTED_DATA_PAK_SHA256}.`)
}

const archive = listMcpkEntries(source)
const entry = archive.entries.find((candidate) => candidate.name === RESOURCES_PATH)
if (!entry) throw new Error(`Vanilla callback script was not found: ${RESOURCES_PATH}`)
const original = extractMcpkEntry(source, entry)
if (sha256(original) !== EXPECTED_RESOURCES_SHA256) throw new Error('Vanilla resources.lua did not match the verified 1.5.0 input.')

let text = original.toString('latin1')
text = replaceOnce(
  text,
  '\tResources:ResetResourcesInfos()\r\nend\r\n',
  '\tResources:ResetResourcesInfos()\r\n\tif SelfFundingAirportsDiagnostic ~= nil then SelfFundingAirportsDiagnostic:Reset() end\r\nend\r\n',
  'scene-create'
)
text = replaceOnce(
  text,
  '\tResources:UpdateResourcesInfos()\r\n\r\nend\r\n\r\n\r\nfunction Resources:OnPostNewStep()',
  '\tResources:UpdateResourcesInfos()\r\n\tif SelfFundingAirportsDiagnostic ~= nil then SelfFundingAirportsDiagnostic:SafeSample("post-load", true) end\r\n\r\nend\r\n\r\n\r\nfunction Resources:OnPostNewStep()',
  'post-load'
)
text = replaceOnce(
  text,
  '\t\tResources.NeedUpdate = false\r\n\tend\r\nend\r\n',
  '\t\tResources.NeedUpdate = false\r\n\tend\r\n\tif SelfFundingAirportsDiagnostic ~= nil then SelfFundingAirportsDiagnostic:SafeSample("turn", false) end\r\nend\r\n',
  'post-step'
)

const diagnosticPath = new URL('./diagnostic.lua', import.meta.url)
const diagnostic = await readFile(diagnosticPath, 'latin1')
const contents = Buffer.from(`${text}\r\n${diagnostic.replace(/\r?\n/g, '\r\n')}\r\n`, 'latin1')
const patch = createMcpkArchive([{ name: RESOURCES_PATH, contents }], { build: archive.build })
const verification = listMcpkEntries(patch)
if (verification.entries.length !== 1 || verification.entries[0]?.name !== RESOURCES_PATH) {
  throw new Error('Generated archive does not contain exactly the diagnostic callback override.')
}
const verified = extractMcpkEntry(patch, verification.entries[0])
if (!verified.equals(contents)) throw new Error('Generated archive changed the diagnostic payload.')

const outputFolder = resolve('dist')
await mkdir(outputFolder, { recursive: true })
await writeFile(join(outputFolder, OUTPUT_NAME), patch)
await writeFile(join(outputFolder, 'self-funding-airports-diagnostic-report.json'), `${JSON.stringify({
  status: 'read-only diagnostic; economic implementation intentionally withheld',
  source: { path: sourcePath, sha256: sourceHash, build: archive.build, resourcesSha256: sha256(original) },
  output: OUTPUT_NAME,
  files: [RESOURCES_PATH],
  simulationWrites: false,
}, null, 2)}\n`)

console.log(`Built ${join(outputFolder, OUTPUT_NAME)}`)
console.log('Verified one read-only Lua callback override; no airport classes, budgets, cash, routes, or saves are modified.')
