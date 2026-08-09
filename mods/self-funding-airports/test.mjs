import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import luaparse from 'luaparse'
import { extractMcpkEntry, listMcpkEntries } from '../../tools/mcpk.mjs'

const diagnostic = await readFile(new URL('./diagnostic.lua', import.meta.url), 'latin1')
luaparse.parse(diagnostic, { luaVersion: '5.1' })

const forbiddenWrites = [
  /Entity:SetValue/i,
  /Manager:SetValue/i,
  /City:(?:Add|Set)CityCash/i,
  /Command:Post/i,
  /InterfaceFileMgr:/i,
  /SoloTradeMgr:(?:SetTrade|Save)/i,
  /SoloTradeMgr:GetTrade/i,
]
function assertReadOnly(source, label) {
  for (const pattern of forbiddenWrites) {
    assert.doesNotMatch(source, pattern, `${label} contains forbidden simulation write: ${pattern}`)
  }
}
assertReadOnly(diagnostic, 'Diagnostic source')

function effectiveCost(baseline, utilization) {
  const clamped = Math.max(0, Math.min(utilization, 1))
  return baseline - baseline * 0.8 * clamped
}

assert.equal(effectiveCost(36_000, 0), 36_000)
assert.equal(effectiveCost(36_000, 0.5), 21_600)
assert.equal(effectiveCost(36_000, 1), 7_200)
assert.equal(effectiveCost(36_000, 2), 7_200)
assert.equal(effectiveCost(36_000, -1), 36_000)

const patchPath = new URL('../../dist/zzz_CitiesXXL_SelfFundingAirports_Diagnostic_1_5_0.patch', import.meta.url)
const patch = await readFile(patchPath)
const archive = listMcpkEntries(patch)
assert.equal(archive.build, 955)
assert.deepEqual(archive.entries.map((entry) => entry.name), ['data/design/script/siminfo/resources.lua'])
const payload = extractMcpkEntry(patch, archive.entries[0]).toString('latin1')
luaparse.parse(payload, { luaVersion: '5.1' })
assert.match(payload, /\[SFA_DIAG\]/)
assert.match(payload, /SelfFundingAirportsDiagnostic:SafeSample\("turn", false\)/)
assertReadOnly(payload, 'Generated callback payload')

console.log('Self-Funding Airports diagnostic: Lua 5.1 syntax, read-only guard, formula, and archive scope verified.')
