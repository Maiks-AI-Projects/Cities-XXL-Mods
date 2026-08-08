import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createMcpkArchive, extractMcpkEntry, listMcpkEntries } from '../../tools/mcpk.mjs'

const EXPECTED_DATA_PAK_SHA256 = 'aadac92c0e2e8dd8649066b21a1a9af18f4639332b54d227faeb1991894bf8f4'
const CLASS_PATH = 'data/design/buildings/construction/citylink/citylinkintercity_highway.class'
const OUTPUT_NAME = 'zzz_CitiesXXL_AffordableHighwayLink_1_5_0.patch'
const ORIGINAL_MONTHLY_COST = 50_000
const MOD_MONTHLY_COST = 1_000

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

const archive = listMcpkEntries(source)
const entry = archive.entries.find((candidate) => candidate.name === CLASS_PATH)
if (!entry) throw new Error(`Vanilla highway-link class was not found: ${CLASS_PATH}`)

const original = extractMcpkEntry(source, entry)
const text = original.toString('latin1')
if (valueOf(text, 'MaxMonthlyCost') !== ORIGINAL_MONTHLY_COST || valueOf(text, 'UpkeepCost') !== ORIGINAL_MONTHLY_COST) {
  throw new Error('The vanilla highway-link costs do not match the verified 50,000 values.')
}
if (!/<IsCityLink>highway<\/IsCityLink>/i.test(text) || !/<BudgetExpenseCategory>TRANSPORT_CITYLINKS<\/BudgetExpenseCategory>/i.test(text)) {
  throw new Error('The selected class is not the verified intercity highway link.')
}

const patchedText = replaceOnce(
  replaceOnce(text, 'MaxMonthlyCost', MOD_MONTHLY_COST),
  'UpkeepCost',
  MOD_MONTHLY_COST
)
const contents = Buffer.from(patchedText, 'latin1')
const patch = createMcpkArchive([{ name: CLASS_PATH, contents }], { build: archive.build })
const verification = listMcpkEntries(patch)
if (verification.entries.length !== 1 || verification.entries[0]?.name !== CLASS_PATH) {
  throw new Error('Generated archive does not contain exactly the highway-link override.')
}
const verifiedText = extractMcpkEntry(patch, verification.entries[0]).toString('latin1')
if (valueOf(verifiedText, 'MaxMonthlyCost') !== MOD_MONTHLY_COST || valueOf(verifiedText, 'UpkeepCost') !== MOD_MONTHLY_COST) {
  throw new Error('Generated archive did not preserve the intended 1,000 monthly costs.')
}

const outputFolder = resolve('dist')
await mkdir(outputFolder, { recursive: true })
await writeFile(join(outputFolder, OUTPUT_NAME), patch)
await writeFile(join(outputFolder, 'affordable-highway-link-report.json'), `${JSON.stringify({
  source: { path: sourcePath, sha256: sourceHash, build: archive.build },
  output: OUTPUT_NAME,
  classPath: CLASS_PATH,
  maxMonthlyCost: [ORIGINAL_MONTHLY_COST, MOD_MONTHLY_COST],
  upkeepCost: [ORIGINAL_MONTHLY_COST, MOD_MONTHLY_COST]
}, null, 2)}\n`)

console.log(`Built ${join(outputFolder, OUTPUT_NAME)}`)
console.log(`Highway Link: ${ORIGINAL_MONTHLY_COST} -> ${MOD_MONTHLY_COST} maximum and upkeep.`)
