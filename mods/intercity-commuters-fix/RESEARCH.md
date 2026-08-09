# Intercity Commuters Fix: initial research report

Date: 2026-08-09  
Target: Cities XXL 1.5.0 data scripts (MCPK build 955)  
Status: evidence and test design only; simulation behavior has not been changed

## Executive finding

There is not yet evidence for a safe `.patch` implementation of true intercity
commuting.

The base game does post a positive city-to-city worker trade as a generic
`RESOURCE IMPORT workerN` operation. It also consumes passenger trade capacity.
However, the worker-token calculation explicitly ignores a positive trade impact,
while ordinary firms obtain their staffing from the native `JobProvider` and its
assignments to citizen entities. No exposed Lua/class hook was found that makes a
worker-resource unit satisfy that native relationship.

Making an intercity link the origin of large quantities of `worker1` through
`worker4` would therefore create worker resource/token supply, not hireable
citizens. Giving the link a citizen-home component instead would create actual
destination residents and contaminate population, housing, taxes, unemployment,
migration, satisfaction, and serialization—the exact “phantom citizen” outcome
this experiment must avoid.

One executable symbol, `pesManagerCitizen::cCitizenCityFlow`, is a useful reverse-
engineering lead. No script, class, XML declaration, command, or readable API in
the data archive refers to it, so it is not presently evidence of a configurable
commuter pool.

The safe conclusion is to retain research-only status. The next experiment
should first be a removable, read-only observer plus a controlled vanilla A/B
test, not a labor simulation change.

## Build identity and safeguards

The inspected installation was:

- `D:\SteamLibrary\steamapps\common\Cities XXL`
- `data.pak` SHA-256:
  `AADAC92C0E2E8DD8649066B21A1A9AF18F4639332B54D227FAEB1991894BF8F4`
- MCPK build: `955`
- archive entries: `7,212`
- `CitiesXXL.exe` product/file version: `2.0.1.5`

All archive and save inspection was read-only. Original archives were not
extracted over, rewritten, or repacked. No save experiment was run because the
game and Trade Panel were active and the live trade matrix was being rewritten;
backing up or altering it then would not have produced a trustworthy baseline.

Any future build must reject an unexpected `data.pak` hash, emit a standalone
removable `.patch`, and never write into `data.pak`. Any save experiment must be
performed after a clean game exit and a full backup of the affected solo-save
directory.

## Original implementation path

References below are archive entry paths and line numbers in the unmodified
`data.pak`.

### Worker resources and token scale

`data/design/script/network/citysavecalculations.lua`

- Lines 31–36 map `worker1` through `worker4` to the corresponding simulation
  resource names.
- Lines 359–376, `AddToken`, register scale and transport type.
- Lines 565–569 register all four worker tokens at scale `30` and transport type
  `2`. One worker token therefore represents 30 worker units and is charged to
  passenger capacity.
- Lines 805–824, `ConvertTokenNBToValue`, multiply a token amount by that scale.
  A route of 10 worker tokens posts 300 worker-resource units.

### Positive imports are deliberately excluded from worker-token production

`data/design/script/network/citysavecalculations.lua`

- Lines 626–647, `GetDetailedWorkerTokens`, read
  `TradingData.ImpactedTokensByCity[currentCity][workerN]`.
- Lines 636–638 replace a positive trade impact with zero.
- Line 643 returns jobless citizens and available jobs, adjusted only by the
  remaining (zero or negative) trade impact.
- Lines 848–874 calculate raw worker token surplus/deficit as
  `floor((NbJobless - NbAvailableJobs) / Scale[workerN])`.
- Lines 919–945 expose the detailed jobless and available-job values.

This is direct implementation evidence that an imported worker token does not
reduce the native job shortage used to calculate the destination's worker-token
production. A negative impact remains significant, allowing unemployed workers
to be exported.

### The trade layer still posts a generic worker resource import

`data/design/script/tradingandtokens/tradinglogic.lua`

- Lines 2883–2996, `PushTokenStatusToCurrentCity`, bridge offline trades into the
  running simulation.
- Line 2910 maps token name to resource name.
- Line 2923 obtains the offline trade balance.
- Lines 2935–2955 subtract worker tokens allocated to blueprints/projects before
  posting the remainder.
- Lines 2957–2964 convert tokens to scaled resource units and retain the impacted
  amount.
- Lines 2966–2985 issue `RESOURCE IMPORT` or `RESOURCE EXPORT`; lines 2976–2979
  issue the positive import, including for `workerN`.

The generic resource import and the citizen-employment model are consequently two
different layers. Seeing `RESOURCE IMPORT worker1 300` succeed would prove that
the trade bridge ran, not that 300 employees were assigned to firms.

### Token balance and passenger charging

`data/design/script/interface/mapsavemgr.lua`

- Lines 650–720, `getCurrentCityTokens`, combine token production and trade impact.
- Lines 688–711 calculate the displayed current token balance.
- Line 711 records transport usage as the absolute import plus export amount.
- Lines 859–879, `CalculateOfflineTradeImpact`, return city imports minus exports.
- Lines 924–968, `getTransportUsage`, route usage calculation to `SoloTradeMgr`.

`data/design/unprotectedscript/solotrademgr.lua`

- Lines 175–207, `SetTrade`, store the directed trade matrix.
- Lines 744–780, `GetTransportUsageForCity`, add the absolute amount of every
  transport-type-2 token to passenger usage. Owned-city and OmniCorp trades are
  counted separately, then summed.
- Lines 150–159 load/save `TradeMatrix.cxl`.

Thus a broken owned-city worker route still incurs a real passenger-capacity
cost. This must not be conflated with an OmniCorp worker sale, which can have a
different economic effect.

### Employment, unemployment, and save values remain native citizen data

`data/design/script/network/network.lua`

- Lines 888 onward, `SetCitySaveMacro`, construct the city summary.
- Line 908 reads population from `FakeSim`.
- Line 926 reads `Sim.CitizenAll.PercentJobless` directly.
- Lines 962–966 read per-class native unemployment.
- Lines 968–982 store token production.
- Line 1011 stores passenger usage.

`data/design/unprotectedscript/mapsavemgr.lua`

- Lines 1092–1105 snapshot population, direct native joblessness, and capacities.
- Lines 1107–1125 separately save current tokens and token production.

The save path does not translate an imported worker token into an employed
citizen. Token balance and native labor statistics are persisted separately.

### Ordinary firms are staffed by `JobProvider`, not their resource agent

A representative firm,
`data/design/buildings/industry_uk_cxl2012/businessservice/b_17usa19th_t3.class`:

- Lines 54–56 declare `SCZCOJOBPROVIDER`, `SCCORESOURCEAGENT`, and the layer as
  separate components.
- Lines 58–69 define job capacity by worker culture/class.
- Lines 70–88 define resource production and requirements separately.
- Line 124 sets the budget agent's `CitizenProvider` value to zero.

`data/design/script/siminfo/highlightjob.lua`

- Lines 180–206 enumerate `SCZCOJOBPROVIDER` entities and read
  `JobProvider/NbWorkersR1..R4` and `WorkerCapacityR1..R4`.
- Lines 231–247 locate joblessness on residence/citizen entities.

`data/design/script/siminfo/firms.lua`

- Lines 380–398 aggregate native `NbOccupiedJobs`, `NbTotalJobs`, and
  `NbFirmsWithWorkersProblems`.

`data/design/script/siminfo/citizens.lua`

- Lines 409–477 read `Sim.CitizenRichness` citizen, jobless, available-job, and
  unemployment values.
- The exposed mutation paths later in this file concern immigration and citizen
  taxation, not an external-workforce assignment pool.

No ordinary-firm Lua setter was found for `NbWorkersR1..R4`, nor a command that
attaches a non-resident worker to a normal `JobProvider`. The executable contains
native names such as `MaxWorkerCount`, `WorkerCountPerCulture`,
`NbWorkersR1..R4`, and `WorkerCapacityR1..R4`, plus source-path strings for
`sczCoJobProvider.cpp` and `sczPsJobProvider.cpp`. These support the entity-
assignment model but do not expose a safe script contract for bypassing it.

### Can `JobProvider` gain a commuter category?

Not through the supported data `.patch` model.

An archive-wide schema inventory found 651 `.class` files with a `JobProvider`
section. Across all of their `MaxJobPerCulture` and
`JobAttractivityPerCulture` sections, the only field names are `LowLife`,
`AllAm`, `Suit`, and `Elite`. Archive-wide source searches found:

- no `NbWorkersR5` or `WorkerCapacityR5` property;
- no `Sim.CitizenRichness[5]` access;
- no `commuter` declaration;
- no `Entity:SetValue` path for `SCZCOJOBPROVIDER`; and
- only the separate Gem ski worker commands when searching command calls for
  job-provider/worker mutation.

The executable is a 32-bit PE and contains native `sczCoJobProvider.cpp` and
`sczPsJobProvider.cpp` source-path strings. Together with the fixed property names,
this indicates that the component's categories, counters, assignment pointers,
and parser contract are native structures rather than extensible Lua tables.
Adding `<Commuter>` to a class would at best be ignored or rejected by that fixed
parser; it would not add a counter to the native component or make its algorithms
use one.

A native-code experiment should not literally add a fifth culture, because the
four-class assumption propagates through citizen richness, firm aggregates,
layers, UI, taxes, and save serialization. The less invasive theoretical design
would retain the four matching classes and maintain a sidecar
`ExternalWorkersR1..R4` count for each firm. Native occupancy/production checks
would have to consume resident assignments first and sidecar slots second, while
citizen population and destination tax paths continue to see only resident
assignments.

That is still substantially more than a `JobProvider` class mod. It would require
version-pinned native hooks for:

1. job-shortage and production/closure evaluation;
2. per-firm allocation and release of external slots;
3. source-city employment accounting without moving the source citizen;
4. route removal, building demolition, and firm closure;
5. offline-city, city-switch, and save/load reconstruction; and
6. UI aggregation that distinguishes occupied resident jobs from external jobs.

The source side is especially important: a destination-only sidecar can make a
firm operate, but it does not make a specific source resident employed. A static,
large `JobProvider` placed on a source city link is not a solution because it
would hire up to its class-file capacity regardless of the current route amount.
Dynamic route-bounded link capacity has no exposed data setter.

Before considering native hooks, the smallest safe research step is static binary
analysis: cross-reference `JobProvider/NbWorkersR1`,
`JobProvider/WorkerCount`, `sczCoJobProvider.cpp`, the job-close diagnostic, and
`pesManagerCitizen::cCitizenCityFlow` in a disassembler. The required result is a
documented object layout and call graph proving where staffing availability is
read and where worker assignment lifetime is owned. This is read-only and should
precede any observer detour, executable-memory patch, or save test. Loading a
bounded observer DLL itself is no longer an unsolved deployment problem because
the Trade Panel already proves the `package.loadlib` path described below.

## Assessment of the intercity-link-origin idea

`data/design/buildings/construction/citylink/citylinkintercity_highway.class`

- Lines 36–41 declare only a layer component and `SCCORESOURCEAGENT`.
- Lines 42–55 produce freight and passenger capacity resources (`RFRE_0` and
  `RPAS_0`), not citizens or jobs.
- Lines 83–90 identify it to the budget system as a highway city link.

The ordinary road city-link class follows the same pattern at lines 67–86 and
114–121, with smaller freight/passenger production. The rail link at lines 33–43
likewise has no citizen-home or job-provider component.

Therefore:

1. Adding huge `workerN` production to the link's resource component would
   change token/resource availability only.
2. A firm `JobProvider` would still have no citizen entity to assign.
3. Adding `SCZCOCITIZENHOME` and a large `CitizenHome/MaxCitizen` to the link
   would create actual residents attached to that entity. It would not preserve
   source-city residency and would contaminate every resident-driven subsystem.

An archive-wide search found no `commuter`, `external worker`, or configurable
`CitizenCityFlow` declaration. The executable's
`pesManagerCitizen::cCitizenCityFlow` symbol remains a reverse-engineering lead,
but using it would require understanding native lifetime, assignment, city-switch,
and save/load invariants. It is not a safe class-file hook.

## Megastructure and special-system distinction

The project allocation in `tradinglogic.lua` lines 2935–2955 shows that worker
tokens can be consumed by blueprints/projects before the generic resource import
is posted. This is evidence for a market/megastructure use of worker tokens, not
ordinary firm staffing.

Similarly, `data/interface/panels/gemskiselection/gemskiselection.lua` lines
159–172 use dedicated `BUDGET ADDGEMTOURISMWORKER` and removal commands. The
executable exposes a separate Gem tourism job-provider type. This special path
must not be generalized to the normal `SCZCOJOBPROVIDER`.

## Prior-art review

Surviving Cities XL/XXL catalogues and original release discussions were searched
for commuter, worker-import, employment, trade, resource-cheat, city-link, and
`JobProvider` work. This is useful negative and architectural evidence, but old
descriptions are not a substitute for source: several original XLNation downloads
are now unavailable, account-gated, or linked through dead hosts.

### Ultimate OmniCorp Mod

RenneCR's [original release post](https://community.simtropolis.com/forums/topic/46129-mod-ultimate-omnicorp-mod-fair-trade-more/)
describes equalized OmniCorp prices, more token/transport capacity, and selling
unemployed workers to OmniCorp for revenue. It does not claim that owned-city
worker imports staff normal businesses. That direction matches the original
negative-trade-impact branch and is not an intercity commuter implementation.

The linked XLNation binary is currently unavailable through its public hostname,
so its exact changed entries have not been source-inspected. It should be acquired
from a trustworthy archive before borrowing any code. Even if recovered, its
OmniCorp pricing/capacity changes must remain out of this mod.

### Resource cheats and resource-center mods

The [Cities XXL Community Patch description](https://cities-mods.com/xlex/cities-xxl-community-patch.161/)
includes “Full Resource Cheat.” The older
[Resource Mod discussion](https://community.simtropolis.com/forums/topic/33690-resource-mod/)
likewise describes a building that supplies utilities. Neither description claims
to create external employees or assign citizens to `JobProvider` entities.

These are relevant guides for packaging and resource production only. They also
reinforce the important boundary: a building can produce arbitrary resource units
without satisfying a firm's citizen-employment component. Copying their resource-
cheat technique onto a city link would reproduce the rejected token-supply idea.

### Giant-employer and population-capacity mods

An [OfficeME discussion](https://community.simtropolis.com/forums/topic/37781-is-it-possible-fro-someone-to-make-a-building-that-hires-alot-of-workers/)
describes an office that “hires pretty much everything” in the current city. The
old modding index also lists a “Double number of unskilled workers per building”
mod. These alter ordinary job capacity or resident capacity; they do not establish
a non-resident workforce pool. OfficeME is the reverse of the desired solution:
it creates more native jobs that still need local citizen assignments.

The original OfficeME download host is dead, so the binary was not treated as
implementation proof.

### Road-link mods

The surviving [city-road-link discussion summary](https://community.simtropolis.com/profile/52653-unholycowgod/)
describes changes to the unusable border area and highway-link cost. It does not
describe a citizen origin or worker source. This agrees with the inspected base
classes, where road/highway links are transport resource agents.

### Catalogue result

The current Cities XXL Steam Workshop catalogue (177 public entries at the time
of review) was queried for `commuter`, `employment`, `worker`, `trade`, `jobs`,
`OmniCorp`, `resource`, and `city link`. `commuter`, `employment`, `trade`, and
`OmniCorp` returned no candidates. `worker` returned residential assets; `jobs`
returned buildings; and the remaining terms returned dependency, resource, road,
or ordinary building mods. The surviving CountriesXL categories likewise expose
resource cheats and building content, but no external-workforce simulation mod.

This does not prove that no private or lost experiment ever existed. It does mean
there is currently no located, inspectable precedent that establishes a safe
commuter hook. The most useful lessons from prior art are:

1. Keep OmniCorp worker sales separate from owned-city imports.
2. Do not mistake arbitrary resource production for citizen employment.
3. Ordinary high-capacity employers and residences remain native citizen entities.
4. Require the original patch/source before reusing a historical mod's technique.

If any archived `UltimateOmnicorp*.patch`, `OfficeME.patch`, citizen/resource
cheat, or unpublished commuter experiment is located, inspect its MCPK entry list
and diff every overridden file against the matching game build before loading it.
Do not install an old patch into 1.5.0 merely to discover what it does.

## Current-save observation (not a controlled reproduction)

The live save's static `city.cxl` snapshots and `TradeMatrix.cxl` were parsed
read-only. The game was active, so these values are observational and are not a
causal A/B test.

| City | Population | Jobless % | Worker class | Production | Trade impact | Current | Passenger usage |
| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: |
| Maiks Production | 1,571,156 | 0 | worker1 | -32 | +32 | 0 | 32 |
| Maiks Production | 1,571,156 | 0 | worker2 | -34 | +34 | 0 | 34 |
| Maiks Production | 1,571,156 | 0 | worker4 | -16 | +16 | 0 | 16 |
| Maiks HighTech | 2,574,757 | 0 | worker2 | -2 | +2 | 0 | 2 |
| Maiks HighTech | 2,574,757 | 0 | worker3 | -6 | +6 | 0 | 6 |
| Maiks HighTech | 2,574,757 | 0 | worker4 | -11 | +11 | 0 | 11 |
| Maiks Farms | 78,690 | 4 | worker1 | -6 | +6 | 0 | 6 |
| Maiks oil | 27,017 | 4 | worker2 | -2 | +2 | 0 | 2 |

These destinations retain negative worker production exactly canceled by the
import for a displayed current balance of zero. That is consistent with positive
imports being token bookkeeping rather than native job filling. It does not, by
itself, prove that an individual firm's staffing was unchanged; the controlled
protocol below is still required.

The matrix contained the supplied 109 owned-city worker-token transfers, all from
MaiksCity, plus 672 worker tokens involving OmniCorp. The categories were kept
separate. MaiksCity's saved worker production is also affected by all of its
exports, which follows the negative-trade-impact branch described above.

The installed Trade Panel patch replaces only panel/bridge Lua entries, not
`citysavecalculations.lua` or `tradinglogic.lua`. It can expose the base behavior,
but the inspected core behavior is not introduced by that panel.

### What the Trade Panel DLL contributes

The Trade Panel transfer source contains `native-bridge/cxxlbridge.c`. Its DLL is
compiled as 32-bit native code and loaded inside `CitiesXXL.exe` by the companion
Lua patch with:

```lua
package.loadlib("cxxlbridge.dll", "luaopen_cxxlbridge")
```

The DLL resolves the exported Lua C API from `LuaPlus_1100.dll`, registers a
small Lua module, and is called from the game's existing `INGAME:OnUpdate()` on
the game thread. The current implementation only provides a nonblocking loopback
socket and Lua message functions; it does not inspect JobProvider, hold entity
pointers, detour native code, or alter executable memory.

This materially reduces implementation risk for an observer or adapter: the
existing project already proves removable DLL loading, the 32-bit MinGW build,
Lua registration, game-thread polling, a smoke-test host, and route access through
`SoloTradeMgr.TradeMatrix`. A commuter prototype can use a separately named DLL
with the same loading pattern, so no external injector, launcher, or original-DLL
proxy is needed. Exact executable/data hashes and native byte signatures must
still be verified before any JobProvider observation or hook is enabled.

## Controlled reproduction protocol

Use a disposable copy of the affected save. Do not test while the game, Trade
Panel, or another process can rewrite it.

1. Exit Cities XXL and the Trade Panel cleanly. Confirm neither process remains.
2. Copy the entire
   `%LOCALAPPDATA%\Focus Home Interactive\Cities XXL\live\offline\solo`
   directory to a timestamped backup. Record hashes for `TradeMatrix.cxl` and all
   selected cities' `city.cxl` files.
3. Record the exact enabled `.patch` set. For the first causal test, use an
   otherwise stock 1.5.0 data-script baseline or a dedicated observer-only patch;
   do not change simulation scripts.
4. Select one destination with a stable shortage in exactly one class. The saved
   `worker1 = -32` state in Maiks Production is a candidate, but use a disposable
   save and remove or isolate its existing route before taking the baseline.
5. At five or more settled simulation snapshots, record:
   destination population; `CitizenAll` and per-class citizen/jobless/available-
   job values; aggregate firm occupied and total jobs; firms-with-worker-problems;
   the same selected firms' `NbWorkersR1..R4`, capacity, production, and sales;
   worker-token production/trade/current values; passenger capacity/usage; and
   cashflow. Record source-city resident and jobless values for the same class.
6. Establish one owned-city import of 10 tokens of only that class. Because the
   worker scale is 30, expect the trade layer to post 300 resource units. Do not
   alter other routes or city infrastructure.
7. Let multiple full recalculations complete, including an autosave. Reopen the
   relevant panels and firms. Verify independently that the directed route exists,
   passenger usage rises by 10, and the 300-unit resource import is posted.
8. Compare staffing and unemployment against the settled baseline. A true
   commuter result would fill no more than 300 matching jobs, reduce the source
   residents' joblessness consistently, keep destination population/housing/tax
   bases unchanged, and remain bounded by the route.
9. Remove the route and repeat the snapshots. All commuting effects must reverse
   without deleting or migrating citizens.
10. Repeat the on/off cycle after save/reload and after switching between source
    and destination. Reject any result that duplicates assignments, accumulates
    across loads, or survives route removal.
11. Restore the disposable backup after the test. Never use a partially written
    live matrix as the restoration source.

Predeclare the base-game null hypothesis: route and passenger/resource accounting
change, while destination `JobProvider` occupancy and citizen employment do not.

## Feasibility assessment

| Approach | Feasibility | Assessment |
| --- | --- | --- |
| Make a city link produce `worker1..4` | Easy to patch, ineffective | Supplies resources/tokens; does not create native employee assignments. |
| Count positive import inside `GetDetailedWorkerTokens` | Easy, unsafe/incorrect | Changes recursive token bookkeeping, not staffing; risks self-sustaining or inflated trade supply. |
| Add a citizen-home component to the link | Technically plausible, rejected | Creates destination residents and contaminates population, tax, migration, housing, satisfaction, and saves. |
| Write `NbWorkersR1..4` on firms from Lua | No supported hook found | Would bypass citizen pointers and native invariants even if a setter were discovered. High crash/save-corruption risk. |
| Reuse megastructure/Gem worker allocation | Not applicable | Dedicated subsystem and commands; no evidence it can staff ordinary firms. |
| Native DLL sidecar around JobProvider queries | Prototype-feasible, still high risk | Trade Panel proves safe in-process DLL loading; exact query hooks, object layouts, version pinning, and lifecycle guarantees remain unproven. |
| Read-only diagnostic/compatibility patch | Feasible | Can prove behavior, warn about owned-city worker routes, and distinguish them from OmniCorp without altering simulation. |

A true commuter implementation would need a separate external-worker availability
pool consumed by normal firms before resident unemployment is evaluated, with a
matching source-city employment relationship and robust teardown on route removal,
city switch, and load. No such exposed pool or lifecycle hook has been found.

## Risks that block a behavior patch

- Resource units can be duplicated without a corresponding citizen assignment.
- Fake citizen homes can change population, taxes, services, housing, migration,
  satisfaction, and unemployment in both cities.
- Directly forcing worker counters can desynchronize native citizen-to-job
  pointers, production, closures, and save serialization.
- Offline cities and city switching can double-apply or fail to remove commuters.
- Worker imports already interact with blueprint allocation and OmniCorp trading;
  changing the generic calculation can create feedback loops or alter those valid
  uses.
- Patching shared core Lua files would conflict with other mods and make failures
  harder to isolate.

## Smallest safe next experiment

First run the controlled A/B protocol with a standalone observer that only logs
existing values. The observer should:

- be packaged as a separate, hash-gated `.patch` under this mod;
- add no resources, citizens, jobs, trade commands, or save entities;
- sample the existing `CitizenRichness`, `CitizenAll`, `FIRMS.State`, selected
  `JobProvider` values, token balance, and passenger usage at a settled cadence;
- tag each sample with city ID, simulation time, and route state;
- be removable by deleting its single patch file; and
- avoid overriding the same panel files as the Trade Panel.

Before writing that patch, confirm a conflict-free auto-loaded script entry on a
clean 1.5.0 baseline. If no such load point exists, use an external read-only
observer against already exposed panel values rather than patching a shared core
file.

Only if the A/B result shows a real, repeatable native staffing response should
behavioral implementation resume. If it confirms the null hypothesis, the next
safe deliverable is a compatibility/diagnostic mod that labels owned-city worker
imports as non-employment trades (and optionally warns before creating them),
while leaving OmniCorp sales and project allocation untouched.

## Reproducible archive inspection

The repository's `tools/inspect-game-entry.mjs` reads a named MCPK entry and prints
line-numbered source, optionally filtered by a regular expression and context.
It does not extract or modify the archive. For example:

```powershell
npm run inspect-entry -- `
  "D:\SteamLibrary\steamapps\common\Cities XXL\Paks\data.pak" `
  "data/design/script/network/citysavecalculations.lua" `
  "GetDetailedWorkerTokens" 20
```

Removing that tool and this research directory completely removes everything
added by this investigation; no installed game or save file was changed.
