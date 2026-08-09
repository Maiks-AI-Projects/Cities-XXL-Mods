# Intercity Commuters Fix: implementation options

Date: 2026-08-09  
Target executable: Cities XXL 1.5.0, 32-bit PE, version 2.0.1.5  
Executable SHA-256: `FE80C2974DD71C488C7DA7037466B1756E6E2E6BE5D5D6727C23AC8F1ED760F4`  
`data.pak` SHA-256: `AADAC92C0E2E8DD8649066B21A1A9AF18F4639332B54D227FAEB1991894BF8F4`

## Decision

A complete implementation cannot be delivered as a data-only `.patch`.
`SCZCOJOBPROVIDER` is a native four-class component whose workers are citizen
pointers. No supported Lua setter or fifth category exists. A full solution needs
a small, version-pinned native adapter plus a removable `.patch` for Lua routing
and any controller/terminal prototype.

Two architectures remain technically viable enough to prototype:

1. **Native virtual-occupancy sidecar — recommended.** Keep ordinary citizens and
   firms unchanged. Add an external occupied-slot count per existing worker class
   and make the few native vacancy/production queries include it.
2. **Gem-worker-backed adapter — fallback.** Reuse the game's existing serialized,
   non-citizen Gem tourism worker pool as the external workforce, then bridge its
   counts into ordinary firm vacancy/production.

Both preserve the existing `worker1..4` routes and their passenger-capacity cost.
Neither creates destination citizen homes or a fifth citizen culture.

## Required semantics

An option is acceptable only if all of these remain true:

- Ten `workerN` tokens provide at most 300 matching-class commuters.
- Only owned-city imports qualify; OmniCorp transactions never create commuters.
- Local destination residents take jobs before commuters.
- A source commuter remains a source-city resident and is employed there.
- Source salary tax remains in the source city; no destination citizen tax,
  population, housing, satisfaction, service demand, or migration is created.
- Destination firms report and use the combined local-plus-commuter staffing,
  without exceeding their original class capacity.
- The existing route remains the sole passenger-capacity charge.
- Removing/reducing a route releases the exact excess slots.
- Building closure/demolition cannot leave an allocation behind.
- City switch, save/load, crash recovery, and repeated recalculation cannot
  duplicate commuters.
- Removing the mod leaves original archives intact and does not strand custom
  citizen/save entities.

## Newly established implementation evidence

### Ordinary job-provider boundary

- All 651 original `.class` files with a `JobProvider` section use only
  `LowLife`, `AllAm`, `Suit`, and `Elite`.
- `sczPsJobProvider.cpp` strings identify `GetMaxJobByCulture`,
  `GetMaxJobByRichness`, `GetJobAttractivityByCulture`, and `SetMaxJob`.
  `SetMaxJob` belongs to the shared prototype section, not a demonstrated
  per-building Lua interface.
- `sczCoJobProvider.cpp` diagnostics show that adding/removing workers operates
  on citizen pointers and requires an open, non-full firm.
- The simulation schedule names
  `pesManagerPathfinding::UpdateBuildingJobsJobProvider`,
  `pesManagerPathfinding::ComputePathJobProcess`,
  `pesManagerCitizen::ComputeCitizenImmigration`, and
  `pesManagerBuilding::ComputeState`. These are the likely query boundaries for
  vacancy, assignment, migration, and production.
- The generic entity API contains property-set functions, but there is no proof
  that computed `JobProvider` counters are safely writable. They must not be used
  to forge `NbWorkersR1..4` because that would desynchronize citizen pointers.

`pesManagerCitizen::cCitizenCityFlow` appears only in native container type
information associated with the ordinary citizen manager. No configurable
intercity API or serialization contract was found, so it is not an implementation
option at this stage.

### Existing non-citizen worker subsystem

The Gem tourism subsystem already implements four worker types outside
`CitizenRichness`:

- `data/design/gem/gemtourismworkert1.class` lines 2–7 declare a
  `GEMTOURISMWORKER` with `TypeID` 1; parallel files define types 2–4.
- `data/design/script/interface/buildingselectionutilitiesgemspecific.lua` lines
  175–195 expose per-class `Current`, `Max`, and globally `Available` workers.
- Native strings identify `stoTouristManager::CreateNewGemTourismWorker`, global
  maximum/available/current statistics, and range checks.
- Native `stoCoGemTourismJobProvider` exposes `GetNbCurrentWorkers`,
  `GetNbMaxWorkers`, `UpdateJobsCounters`, and `Serialize`. Its serialization
  validates current and maximum counters.
- Native worker barracks expose per-class maximum/current values and worker
  hired/fired events.
- `data/design/buildings/gem/gemski/b_gemski[skijump2]_t3.class` lines 47–70 and
  242–257 prove that an ordinary `BUILDING` entity can carry both
  `SCZCOJOBPROVIDER` and `STOCOGEMTOURISMJOBPROVIDER`.

Gem companies track their own worker salaries and cash flow. Gem workers do not
appear in `Sim.CitizenRichness`, so they are a credible non-resident representation.
They are global to the tourism manager, however, which creates a compatibility
risk with real ski/beach gameplay.

## Option 1: native virtual-occupancy sidecar

### Architecture

The native adapter keeps, for the currently loaded city:

```text
external_pool[class] = owned-city inbound worker tokens * 30
external_at_firm[firm, class] <= original capacity - local resident workers
```

Allocations are deterministic and ephemeral. They are rebuilt from the trade
matrix and current firm state whenever a city loads, a route changes, or a firm
opens/closes. No commuter save entity is required.

A dedicated **Commuter Terminal** prototype supplies the source-side accounting
anchor. It has an ordinary `SCZCOJOBPROVIDER`, but the native adapter limits its
effective capacity to the city's owned-city worker exports by class. Source
citizens assigned there remain normal residents, become employed through a real
native job pointer, and pay their normal source-city salary tax.

The destination has no commuter citizen entity. The adapter makes ordinary firm
queries see external occupied slots only where appropriate:

- vacancy and job assignment reserve commuter-filled slots;
- production/firm health uses local plus external occupancy;
- aggregate occupied jobs can include commuters, while citizen counts do not;
- local resident assignment has priority and displaces/reallocates a commuter.

The existing worker-token trade is retained for passenger usage and financial
transfer. The adapter must not create an additional passenger charge. The base
trade price should initially serve as the commuter wage/payment proxy so the
destination is not charged twice for worker salaries.

### Why this option is viable

- It does not alter any citizen object or fixed four-culture schema.
- The route matrix provides exact per-city, per-class owned import/export totals
  and can explicitly exclude `Omnicorp`.
- Destination state can be reconstructed rather than serialized.
- Source employment uses a genuine native assignment, keeping source taxes and
  unemployment internally consistent.
- It has no dependency on the Gem packs or their global worker manager.

### Principal unknown

Static strings identify the right native subsystems, but a disassembler is still
needed to prove that vacancy and workforce percentage pass through a small,
stable set of functions. If worker percentage logic is inlined broadly, this
option becomes too fragile for a public mod.

### Phased plan

1. **Static hook map.** In a portable disassembler, map
   `sczCoJobProvider` create/add/remove/close and property getters;
   `UpdateBuildingJobsJobProvider`; `ComputePathJobProcess`;
   `ComputeCitizenImmigration`; firm `JobStatePercentage`; and
   `ComputeState`. Record signatures, calling conventions, object ownership, and
   every caller that consumes worker occupancy.
2. **Read-only native observer.** Extend the proven Trade Panel loading pattern:
   Lua calls `package.loadlib` to load a separate 32-bit observer DLL inside
   `CitiesXXL.exe`. Initially it installs no detours; it only verifies the module
   hashes/signatures and exposes bounded inspection calls to Lua. Compare native
   worker counts, vacancy, production state, and migration values with the Lua/UI
   readings before permitting any hook.
3. **Destination-only synthetic slot.** In a disposable city, inject a bounded
   300-worker R1 sidecar into one selected firm. Confirm production and occupied-
   job reporting change while population, native resident assignments, citizen
   tax, and other classes do not.
4. **Assignment reservation.** Confirm pathfinding/immigration sees the remaining
   vacancy rather than the firm's original vacancy. Add a local resident and prove
   it displaces exactly one external slot.
5. **Source terminal.** Add the standalone test terminal in a removable patch.
   Set its effective capacity from owned-city exports and verify exact source
   employment/tax behavior. Do not modify the standard city-link prototypes.
6. **Route bridge.** Reuse the Trade Panel companion's proven game-thread polling
   and in-memory `SoloTradeMgr.TradeMatrix` access. Send owned-city import/export
   totals to the adapter after trade load/change and city initialization. Route
   data must be partner-specific, not the generic net trade impact, and the
   commuter feature must remain usable without the desktop Trade Panel running.
7. **Lifecycle matrix.** Test route increase/decrease/removal, terminal demolition,
   firm closure/demolition, autosave, manual save, crash/restart, city switching,
   and mod removal.
8. **Compatibility pass.** Test with the Trade Panel, Affordable Highway Link,
   Balanced Production Bonuses, Personal Intercity Rail, blueprints, Gem ski/beach,
   and OmniCorp sales. No shared file should be overridden where a new standalone
   script/prototype can be used.
9. **Package.** Ship a hash-gated `.patch` plus a separately named native adapter
   loaded with `package.loadlib`, following the existing Trade Panel bridge model.
   Never replace `CitiesXXL.exe`, `data.pak`, or a game DLL. Removal must consist
   only of deleting the mod's own files.

### Stop conditions

Reject Option 1 if any of the following is observed:

- production requires a real citizen pointer at every occupied slot;
- safe vacancy reservation requires patching many inlined call sites;
- changing the terminal's effective capacity corrupts or duplicates assignments;
- route teardown cannot be made idempotent;
- unloaded source-city state requires direct editing of `city.cxl`; or
- the loader would need to overwrite an original DLL/executable.

## Option 2: Gem-worker-backed adapter

### Architecture

This option uses `GEMTOURISMWORKER` types 1–4 as commuter objects. A dedicated
Commuter Terminal hosts worker-barrack/controller components. Owned-city imports
set the maximum usable commuter pool; the existing Gem manager owns available and
current counts and serializes them.

A smaller native adapter then makes ordinary firms treat assigned Gem workers as
external occupied slots. It still must reserve ordinary vacancy and adjust
production/aggregate reporting, but it can reuse native worker creation,
allocation counters, hired/fired events, and serialization rather than inventing
those mechanisms.

The source half remains an ordinary dynamic-capacity terminal, as in Option 1, so
real source residents are employed and taxed in their home city.

### Why this option is viable

- Non-citizen, four-class workers and serialized current/max counts already exist.
- Native add/remove commands exist for selected Gem job providers.
- An original ordinary `BUILDING` successfully combines normal and Gem provider
  components, proving the entity composition is supported.
- The adapter can potentially hook one combined workforce-percentage boundary
  instead of implementing worker object lifetime and persistence itself.

### Compatibility limitation

Gem worker statistics are global to `stoTouristManager`. Without proven domain or
owner isolation, commuter workers could be consumed by ski/beach activities or
Gem workers could leak into ordinary firms. This option is acceptable only if the
native object graph allows workers belonging to the Commuter Terminal to be
reserved independently. Disabling Gem gameplay is not an acceptable public-mod
solution.

### Phased plan

1. **Data-only component probe.** Add one new test building copied from the proven
   dual-provider ski-jump pattern. Give it tiny ordinary and Gem job capacities.
   Confirm the entity loads, Gem workers can be added/removed, and counts survive
   save/reload without affecting population or citizen taxes.
2. **Ownership probe.** Trace worker-to-barrack/job-provider ownership and global
   statistics. Prove that a commuter worker can be reserved from normal Gem
   activities, including after load.
3. **Production bridge probe.** On a disposable ordinary resource-producing test
   firm, make the workforce-percentage query include Gem `CurrentJobs`. Confirm
   that one external worker has the same production effect as one local worker,
   without forging `NbWorkersR1..4`.
4. **Vacancy/priority bridge.** Reserve the externally filled ordinary slot from
   pathfinding and immigration. Verify that a newly available local resident
   replaces the Gem worker and returns it to the commuter pool.
5. **Route and source integration.** Synchronize the pool with partner-specific
   owned-city trades and add the same source terminal mechanism as Option 1.
6. **Gem compatibility matrix.** Run active ski and beach domains concurrently.
   Exercise manual `ADD/REMOVEGEMTOURISMWORKER` commands and confirm no cross-pool
   movement.
7. **Lifecycle and packaging.** Apply the same teardown, city-switch, crash,
   compatibility, hash, and non-overwrite requirements as Option 1.

### Stop conditions

Reject Option 2 if:

- Gem worker ownership cannot be isolated from ski/beach gameplay;
- a Gem provider requires converting ordinary firms into Gem companies;
- normal firm production cannot consume the external count through one bounded
  adapter point;
- Gem serialization introduces entities that prevent clean mod removal; or
- salaries/cash flow are charged by both the worker trade and Gem company system.

## Loader and packaging boundary

The Trade Panel provides a proven, materially safer DLL loading path. Its
`cxxlbridge.dll` is a 32-bit native DLL loaded normally inside the game by:

```lua
local Loader = package.loadlib("cxxlbridge.dll", "luaopen_cxxlbridge")
local Native = Loader()
```

It resolves the exported Lua C API from `LuaPlus_1100.dll`, registers bounded Lua
functions, and is polled by the patched `INGAME:OnUpdate()` on the game thread.
It does not inject, proxy an original dependency, or patch executable memory.
The existing source and build setup therefore solve DLL deployment, 32-bit
compilation, Lua registration, game-thread scheduling, removable packaging, and
optional loopback diagnostics.

This does **not** by itself solve JobProvider integration: the current bridge is a
socket/Lua bridge and contains no entity pointers, executable signatures,
disassembler-derived layouts, or hooks. The commuter adapter must add those only
after the observer proves them. Prefer a separately named `cxxlcommuters.dll` so
the Trade Panel remains independently installable; shared loading/polling code can
be factored later if both projects remain compatible.

The adapter entry point must verify the exact executable and `data.pak` hashes,
then verify byte signatures plus surrounding invariants before exposing observer
features or installing any detour. Unknown builds fail closed. No executable or
original DLL is patched on disk.

The public package would therefore contain:

- one removable `.patch` for Lua/prototype/controller data and `package.loadlib`;
- one version-pinned 32-bit adapter DLL;
- no injector, launcher, or proxy DLL; and
- an observer/test build separate from the release build.

If the project must remain **strictly `.patch`-only**, neither option can satisfy
the complete goals. In that case the correct deliverable remains a diagnostic/
compatibility mod that prevents or warns about ineffective owned-city worker
imports.

## Recommendation

Proceed with Option 1 first. It has the cleanest simulation model, no Gem coupling,
and no custom commuter save entities. Use Option 2 only if static analysis shows
that the Gem job-provider occupancy can be bridged at substantially fewer and
safer native call sites, and only after worker-pool isolation is proven.

Do not begin behavioral coding until the static hook map identifies the exact
function boundaries and the read-only observer confirms their runtime values.
