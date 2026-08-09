import { createHash } from 'node:crypto'
import { mkdir, open, readFile, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import {
  createMcpkArchive,
  extractMcpkEntry,
  listMcpkEntries,
  listMcpkTable
} from '../../tools/mcpk.mjs'

const EXPECTED_DATA_PAK_SHA256 = 'aadac92c0e2e8dd8649066b21a1a9af18f4639332b54d227faeb1991894bf8f4'
const EXPECTED_BUILD = 955
const OUTPUT_NAME = 'zzz_PersonalIntercityRail_0_1_0.patch'
const PROJECT_TAG = 'PersonalIntercityRail'

const SOURCE = {
  rail: 'data/design/buildings/construction/trainstation/r_railroad_10x40.class',
  station: 'data/design/buildings/construction/trainstation/b_transport_railstation_t3.class',
  cityLink: 'data/design/buildings/construction/citylink/citylinkintercity_rail.class',
  multiline: 'data/design/buildings/construction/massplacementtool/multilines_citylink_rail.class'
}

const OUTPUT = {
  rail: 'data/design/buildings/construction/trainstation/personal_r_railroad_10x40.class',
  station: 'data/design/buildings/construction/trainstation/personal_b_transport_railstation_t3.class',
  cityLink: 'data/design/buildings/construction/citylink/personal_citylinkintercity_rail.class',
  multiline: 'data/design/buildings/construction/massplacementtool/personal_multilines_citylink_rail.class'
}

const DEPENDENCIES = {
  'data2.pak': [
    'data/design/layout/road/special/r_railroad_10x40.layout',
    'data/design/layout/b_service/b_transport_railstation_t3_base.layout',
    'data/design/layout/b_service/b_roadconnect01_t1_base.layout',
    'data/interface/ddstexture/buildings/r_railroad_10x40.dds',
    'data/interface/ddstexture/buildings/b_transport_railstation_t3.dds',
    'data/interface/ddstexture/layer/layer_citylink_rail.dds'
  ],
  'sgbin.pak': [
    'data/gfx/placeholder/b_aaedu_t3.sgbin',
    'data/gfx/road/r_wy_roadrail_10x20x40.sgbin'
  ],
  'buildings.pak': [
    'data/gfx/building/b_transport_railstation_t3.sgbin',
    'data/gfx/building/b_roadconnect01_t1.sgbin'
  ]
}

function countOf(text, value) {
  return text.split(value).length - 1
}

function replaceExactOnce(text, previous, next, description) {
  const count = countOf(text, previous)
  if (count !== 1) throw new Error(`Expected one ${description}, found ${count}.`)
  return text.replace(previous, next)
}

function transformTag(text, { remove = [], add = [] } = {}) {
  const matches = [...text.matchAll(/<Tag>([^<]*)<\/Tag>/gi)]
  if (matches.length !== 1) throw new Error(`Expected one <Tag> element, found ${matches.length}.`)

  const removals = new Set(remove.map((value) => value.toLowerCase()))
  const tags = matches[0][1]
    .split(';')
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => !removals.has(value.toLowerCase()))

  for (const value of add) {
    if (!tags.some((candidate) => candidate.toLowerCase() === value.toLowerCase())) tags.push(value)
  }
  return text.replace(matches[0][0], `<Tag>${tags.join(';')}</Tag>`)
}

function sourceText(archive, path) {
  const entry = archive.index.entries.find((candidate) => candidate.name === path)
  if (!entry) throw new Error(`Missing source prototype ${path}.`)
  return extractMcpkEntry(archive.bytes, entry).toString('latin1')
}

function resourceProduction(text, resourceName) {
  const productions = [...text.matchAll(/<Production\d+>[\s\S]*?<\/Production\d+>/gi)]
  const selected = productions.filter((match) => new RegExp(`<ResourceName>${resourceName}</ResourceName>`, 'i').test(match[0]))
  if (selected.length !== 1) throw new Error(`Expected one production block for ${resourceName}, found ${selected.length}.`)
  const value = selected[0][0].match(/<ResourceNumber>(-?\d+)<\/ResourceNumber>/i)
  if (!value) throw new Error(`Missing ResourceNumber for ${resourceName}.`)
  return Number(value[1])
}

function assertIncludes(text, expected, description) {
  if (!text.toLowerCase().includes(expected.toLowerCase())) throw new Error(`Missing ${description}: ${expected}`)
}

async function readArchiveIndex(path) {
  const handle = await open(path, 'r')
  try {
    const stat = await handle.stat()
    const header = Buffer.alloc(0x30)
    const headerRead = await handle.read(header, 0, header.length, 0)
    if (headerRead.bytesRead !== header.length) throw new Error(`Could not read MCPK header from ${path}.`)
    const tableAddress = header.readUInt32LE(32)
    if (tableAddress < header.length || tableAddress > stat.size) throw new Error(`Invalid MCPK table address in ${path}.`)
    const encryptedTable = Buffer.alloc(stat.size - tableAddress)
    const tableRead = await handle.read(encryptedTable, 0, encryptedTable.length, tableAddress)
    if (tableRead.bytesRead !== encryptedTable.length) throw new Error(`Could not read MCPK table from ${path}.`)
    return { ...listMcpkTable(header, encryptedTable), size: stat.size }
  } finally {
    await handle.close()
  }
}

const gameInstall = resolve(process.argv[2] ?? process.env.CITIES_XXL_INSTALL ?? '')
if (!process.argv[2] && !process.env.CITIES_XXL_INSTALL) {
  throw new Error('Pass the Cities XXL installation folder or set CITIES_XXL_INSTALL.')
}

const paksFolder = join(gameInstall, 'Paks')
const dataPath = join(paksFolder, 'data.pak')
const dataBytes = await readFile(dataPath)
const dataHash = createHash('sha256').update(dataBytes).digest('hex')
if (dataHash !== EXPECTED_DATA_PAK_SHA256) {
  throw new Error(`Refusing unknown data.pak (${dataHash}). Expected Cities XXL 1.5.0 ${EXPECTED_DATA_PAK_SHA256}.`)
}

const dataIndex = listMcpkEntries(dataBytes)
if (dataIndex.build !== EXPECTED_BUILD) throw new Error(`Expected MCPK build ${EXPECTED_BUILD}, found ${dataIndex.build}.`)
const sourceArchive = { bytes: dataBytes, index: dataIndex }

let rail = transformTag(sourceText(sourceArchive, SOURCE.rail), { remove: ['Deprecated'], add: [PROJECT_TAG] })
rail = replaceExactOnce(rail, SOURCE.multiline, OUTPUT.multiline, 'rail placement delegate')

let station = transformTag(sourceText(sourceArchive, SOURCE.station), { remove: ['Deprecated'], add: [PROJECT_TAG] })
station = replaceExactOnce(station, '<Thumb>""</Thumb>', '<Thumb>b_transport_railstation_t3.tga</Thumb>', 'station thumbnail')

const cityLink = transformTag(sourceText(sourceArchive, SOURCE.cityLink), { add: [PROJECT_TAG] })

let multiline = sourceText(sourceArchive, SOURCE.multiline)
multiline = replaceExactOnce(multiline, 'Data/Design/Buildings/Construction/CityLink/CityLinkInterCity_rail.class', OUTPUT.cityLink, 'city-link placement prototype')

const generated = [
  { role: 'rail', name: OUTPUT.rail, contents: Buffer.from(rail, 'latin1') },
  { role: 'station', name: OUTPUT.station, contents: Buffer.from(station, 'latin1') },
  { role: 'cityLink', name: OUTPUT.cityLink, contents: Buffer.from(cityLink, 'latin1') },
  { role: 'multiline', name: OUTPUT.multiline, contents: Buffer.from(multiline, 'latin1') }
]

if (generated.length !== 4) throw new Error(`Expected four generated prototypes, found ${generated.length}.`)
if (new Set(generated.map((file) => file.name)).size !== generated.length) throw new Error('Generated prototype paths are not unique.')
for (const file of generated) {
  if (Object.values(SOURCE).includes(file.name)) throw new Error(`Generated file overwrites vanilla source ${file.name}.`)
}

if (/\bDeprecated\b/i.test(rail) || /\bDeprecated\b/i.test(station)) throw new Error('Generated selectable prototypes remain deprecated.')
if (resourceProduction(station, 'RPAS_0') !== 1000) throw new Error('Passenger production changed from the original 1000.')
if (resourceProduction(station, 'RFRE_0') !== 3000) throw new Error('Freight production changed from the original 3000.')
assertIncludes(rail, `<DelegatePrototype>${OUTPUT.multiline}</DelegatePrototype>`, 'generated multiline reference')
assertIncludes(multiline, `<PrototypeFile>${OUTPUT.cityLink}</PrototypeFile>`, 'generated city-link reference')
assertIncludes(cityLink, '<IsCityLink>rail</IsCityLink>', 'native rail city-link type')
assertIncludes(cityLink, '<CityLinkPlanetRange>5000</CityLinkPlanetRange>', 'native rail city-link range')
assertIncludes(cityLink, '<LayerName>Sim_CityLinkInterCity_rail</LayerName>', 'native rail map mask')
assertIncludes(rail, 'Data/Design/Layout/Road/Special/r_railroad_10x40.layout', 'native rail layout')
if (/TrafficEnabled>1</i.test(generated.map((file) => file.contents.toString('latin1')).join('\n'))) {
  throw new Error('Generated package unexpectedly enables moving traffic.')
}

const dependencyReport = []
for (const [archiveName, requiredPaths] of Object.entries(DEPENDENCIES)) {
  const path = join(paksFolder, archiveName)
  const index = await readArchiveIndex(path)
  if (index.build !== EXPECTED_BUILD) throw new Error(`${archiveName} has unexpected MCPK build ${index.build}.`)
  const available = new Set(index.entries.map((entry) => entry.name))
  for (const required of requiredPaths) {
    if (!available.has(required)) throw new Error(`${archiveName} is missing dependency ${required}.`)
  }
  dependencyReport.push({
    archive: archiveName,
    size: index.size,
    build: index.build,
    payloadSha1: index.payloadSha1,
    verified: requiredPaths
  })
}

const patch = createMcpkArchive(generated, { build: dataIndex.build })
const verification = listMcpkEntries(patch)
if (verification.entries.length !== generated.length) throw new Error('Generated archive file count does not match.')
for (const expected of generated) {
  const entry = verification.entries.find((candidate) => candidate.name === expected.name)
  if (!entry) throw new Error(`Generated archive omitted ${expected.name}.`)
  const actual = extractMcpkEntry(patch, entry)
  if (!actual.equals(expected.contents)) throw new Error(`Generated archive changed ${expected.name}.`)
}

const outputFolder = resolve('dist')
await mkdir(outputFolder, { recursive: true })
const outputPath = join(outputFolder, OUTPUT_NAME)
await writeFile(outputPath, patch)
const outputHash = createHash('sha256').update(patch).digest('hex')
const reportPath = join(outputFolder, 'personal-intercity-rail-report.json')
await writeFile(reportPath, `${JSON.stringify({
  status: 'statically-verified-not-runtime-tested',
  source: {
    archive: basename(dataPath),
    path: dataPath,
    sha256: dataHash,
    build: dataIndex.build,
    payloadSha1: dataIndex.payloadSha1
  },
  dependencies: dependencyReport,
  output: {
    file: OUTPUT_NAME,
    sha256: outputHash,
    bytes: patch.length,
    prototypes: generated.map(({ role, name, contents }) => ({ role, path: name, bytes: contents.length }))
  },
  preservedGameplay: {
    passengerCapacity: 1000,
    freightCapacity: 3000,
    cityLinkType: 'rail',
    planetRange: 5000,
    movingTrafficEnabled: false
  }
}, null, 2)}\n`)

console.log(`Built ${outputPath}`)
console.log(`SHA256 ${outputHash}`)
console.log(`Verified ${generated.length} generated prototypes and ${dependencyReport.reduce((sum, item) => sum + item.verified.length, 0)} installed dependencies.`)
console.log('Runtime status: not tested by agreement.')

