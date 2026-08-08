import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createMcpkArchive, extractMcpkEntry, listMcpkEntries } from '../../tools/mcpk.mjs'

const EXPECTED_DATA_PAK_SHA256 = 'aadac92c0e2e8dd8649066b21a1a9af18f4639332b54d227faeb1991894bf8f4'
const EXPECTED_BUILDING_COUNT = 38
const OUTPUT_NAME = 'zzz_CitiesXXL_BalancedProductionBonuses_1_5_0.patch'

function valueOf(text, element) {
  const match = text.match(new RegExp(`<${element}>(-?\\d+)</${element}>`, 'i'))
  if (!match) throw new Error(`Missing numeric <${element}> field.`)
  return Number(match[1])
}

function replaceOnce(text, element, value) {
  const pattern = new RegExp(`(<${element}>)(-?\\d+)(</${element}>)`, 'i')
  const matches = text.match(new RegExp(pattern.source, 'gi')) ?? []
  if (matches.length !== 1) throw new Error(`Expected one <${element}> field, found ${matches.length}.`)
  return text.replace(pattern, `$1${value}$3`)
}

function productionBonusSection(text) {
  return text.match(/<CityBonus>[\s\S]*?<\/CityBonus>/i)?.[0] ?? ''
}

function specializationTag(text) {
  return text.match(/<Tag>([^<]*)<\/Tag>/i)?.[1] ?? ''
}

function isProductionBonusBuilding(text) {
  return /<FirmProduction>/i.test(productionBonusSection(text)) &&
    /(?:^|;)EduSpe[1-4](?:;|$)/i.test(specializationTag(text))
}

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
const modified = []
const report = []
for (const entry of sourceArchive.entries.filter((candidate) => candidate.name.endsWith('.class'))) {
  const original = extractMcpkEntry(source, entry)
  const text = original.toString('latin1')
  if (!isProductionBonusBuilding(text)) continue

  const previousMaximum = valueOf(text, 'MaxMonthlyCost')
  const previousUpkeep = valueOf(text, 'UpkeepCost')
  const maximum = Math.round(previousMaximum / 2)
  const upkeep = Math.round(previousUpkeep / 2)
  const patchedText = replaceOnce(replaceOnce(text, 'MaxMonthlyCost', maximum), 'UpkeepCost', upkeep)
  const contents = Buffer.from(patchedText, 'latin1')
  modified.push({ name: entry.name, contents })
  report.push({ path: entry.name, maximum: [previousMaximum, maximum], upkeep: [previousUpkeep, upkeep] })
}

if (modified.length !== EXPECTED_BUILDING_COUNT) {
  throw new Error(`Expected ${EXPECTED_BUILDING_COUNT} production bonus buildings, selected ${modified.length}.`)
}

const patch = createMcpkArchive(modified, { build: sourceArchive.build })
const verification = listMcpkEntries(patch)
if (verification.entries.length !== modified.length) throw new Error('Generated archive file count does not match.')
for (const expected of modified) {
  const entry = verification.entries.find((candidate) => candidate.name === expected.name)
  if (!entry) throw new Error(`Generated archive omitted ${expected.name}.`)
  const actual = extractMcpkEntry(patch, entry)
  if (!actual.equals(expected.contents)) throw new Error(`Generated archive changed ${expected.name}.`)
}

const outputFolder = resolve('dist')
await mkdir(outputFolder, { recursive: true })
await writeFile(join(outputFolder, OUTPUT_NAME), patch)
await writeFile(join(outputFolder, 'balanced-production-bonuses-report.json'), `${JSON.stringify({
  source: { path: sourcePath, sha256: sourceHash, build: sourceArchive.build },
  output: OUTPUT_NAME,
  buildings: report
}, null, 2)}\n`)

console.log(`Built ${join(outputFolder, OUTPUT_NAME)}`)
console.log(`Verified ${modified.length} production-bonus building overrides.`)
for (const item of report) {
  console.log(`${item.maximum[0]} -> ${item.maximum[1]} max, ${item.upkeep[0]} -> ${item.upkeep[1]} upkeep  ${item.path}`)
}
