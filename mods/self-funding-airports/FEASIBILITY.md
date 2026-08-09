# Self-Funding Airports: portable feasibility report

## Decision

The requested economic implementation is **not yet safe to ship**.

Cities XXL exposes per-airport capacity production and displayed firm
activity, plus citywide intercity usage, but the inspected Lua does not expose
which transport mode or capacity-provider entity carried a particular trade
route. The inspected scripts also contain no proven example of changing a
building's `BudgetAgent` cost per instance. `City:AddCityCash` exists, but a
treasury mutation is not yet proven to behave like a recurring, visible budget
rebate across save/load and city switching.

Accordingly, this repository contains only a smallest-scope, protected,
read-only diagnostic. No airport economics have been changed.

## Verified inputs

- Cities XXL archive: `Paks/data.pak`
- MCPK build: `955`
- Archive SHA-256:
  `aadac92c0e2e8dd8649066b21a1a9af18f4639332b54d227faeb1991894bf8f4`
- Vanilla callback script:
  `data/design/script/siminfo/resources.lua`
- Callback SHA-256:
  `34e40a5d3868e5bd91f480bcbe4260da1435765471f26091514f2535ff622217`

The builder rechecks both hashes. Extracted original files are not committed or
redistributed.

### Source evidence map

| Vanilla script | Relevant symbol or observation |
| --- | --- |
| `data/design/script/siminfo/resources.lua` | `Resources:OnSceneCreate`, `Resources:OnEndPostLoad`, and `Resources:OnPostNewStep` provide the observation lifecycle. |
| `data/design/script/network/citysavecalculations.lua` | `CitySaveCalculations.TransportType`, `TransportScale`, `GetCapacity`, `GetCapacityUsed`, and `City:GetAllCityLinkInterCityInfo` usage define pooled capacity and capacity-consuming resource families. |
| `data/design/unprotectedscript/solotrademgr.lua` | `SoloTradeMgr.TradeMatrix`, `GetTrade`, and `GetTransportUsageForCity` expose offline route totals; `GetTrade` also has the table-initialization side effect avoided by the diagnostic. |
| `data/design/script/tradingandtokens/tradinglogic.lua` | `TradingLogic:CalculateTradeSummaryFromContracts`, `GetTransportUse`, and `TradingData.ContractsByCity` show online active/suspended accounting. |
| `data/design/script/siminfo/highlight.lua`, `highlightjob.lua`, and `newsiminfos.lua` | Shipped callers demonstrate per-entity last resource sale/cost, upkeep, and worker-cost getters. |
| `data/design/script/interface/buildingincitymodularselectioncitylink.lua` | The city-link selection UI renders `Firm.PercentProductivity` as level of activity. |
| `data/design/script/interface/newsimpanels.lua` and `data/design/script/network/network.lua` | Shipped budget and trade-panel callers demonstrate budget categories and mode-specific `CurrentCapacity`; `network.lua` documents that legacy “sea available” and “air available” save fields actually store pooled freight/passenger used. |

Engine-bound functions such as `City:GetAllCityLinkInterCityInfo`,
`City:GetAllCityBudgetInfo`, `Entity:GetBuildingInfo`, and the four
`City:GetEntBuildingLast*` calls have shipped Lua callers, but no Lua function
body; their implementation is native.

## Target classes

| Airport | Exact class path | Construction | MaxMonthlyCost | UpkeepCost | Capacity |
| --- | --- | ---: | ---: | ---: | --- |
| International Freight Airport | `data/design/buildings/2015/airport/b_freight_airport_t4.class` | 10,000,000 | 36,000 | 29,700 | `RFRE_0` 12,000 (240 trade units) |
| Small passenger airport | `data/design/buildings/construction/airport/b_transport_smallairport_t3.class` | 900,000 | 7,200 | 5,900 | `RPAS_0` 2,000 (40 trade units) |
| Large passenger airport | `data/design/buildings/construction/airport/b_transport_airport_t3.class` | 9,000,000 | 32,400 | 26,100 | `RPAS_0` 12,000 (240 trade units) |

All use `IsCityLink` mode `air`. The freight and large passenger airports have
range 10,000; the small passenger airport has range 5,000. Exact prototype-path
matching excludes the leisure airport, heliport, deprecated project pieces,
airways, and hangars.

The extracted class SHA-256 values are, in table order:

- `fee13fd56c3a92b1df55c0f0b35c1062a304d82195cbe3746671dd6ab5da8467`;
- `e6debd8b0fd796759d09717cd7e28929c42d980b9ab731c6776ad5617ec971bf`;
- `7c2da280ae4fd6c98db008a7c4bd3f688520628968b30d83be9f25ad035eb630`.

## Available APIs and scripts

### Per-building observation

`CitizenMgr:GetEntitiesHighlightable(table)` enumerates highlightable entities.
`Entity:GetProtoPath(entity)` identifies the exact class. For each target,
`Entity:GetBuildingInfo(entity, table)` exposes:

- `ResourceSold[].ResourceName` and `ResourceQty`;
- `Firm.PercentProductivity`, used by the UI as level of activity;
- `Firm.SubventionFromCity` and `Firm.Profitability`; and
- building state fields.

The shipped UI also calls:

- `City:GetEntBuildingLastResourceSale(entity)`;
- `City:GetEntBuildingLastResourceCost(entity)`;
- `City:GetEntBuildingLastUpkeepCost(entity)`; and
- `City:GetEntBuildingLastWorkerCost(entity)`.

These values are useful measurements, but they do not prove consumed airport
capacity. `ResourceQty` is produced link capacity. `PercentProductivity` is a
firm-wide activity signal whose relationship to route utilization must be
measured. `RFRE_0` and `RPAS_0` have internal market price zero and are not
market-available, so resource-sale income may legitimately remain zero.

### Citywide intercity capacity

`City:GetAllCityLinkInterCityInfo(table)` returns `rfre_0` and `rpas_0`, split
across `road`, `highway`, `rail`, `sea`, and `air`. Each mode contains
`CurrentCapacity` and `InterCityRange`. Vanilla
`unprotectedscript/citysavecalculations.lua` pools these modes and divides raw
capacity by 50 to obtain trade-panel units.

### Trade usage

Offline routes are available through `SoloTradeMgr.TradeMatrix`. The shipped
`SoloTradeMgr:GetTrade` helper was inspected but is deliberately not called by
the diagnostic because it initializes missing route tables as a side effect.
Online contracts appear in
`TradingData.ContractsByCity`, with summary logic in `TradingLogic`.
Vanilla capacity accounting groups resources as follows:

- freight: waste, fuel, water, agriculture, heavy industry, high-tech,
  manufacturing, and retail resources;
- passenger: workers 1-4, business services, vacations, and business hotels;
- no capacity: cash and electricity.

The diagnostic applies the same resource grouping but deliberately excludes
workers 1-4 from revenue eligibility. It also excludes cash, electricity, and
unknown resource tokens. For offline play it sums each directed outgoing and
incoming route once at the current-city endpoint; for online play it sums each
current-city contract record once. Reciprocal routes remain distinct routes,
but neither route is added again for its remote endpoint.

### Budget and lifecycle observation

`City:GetAllCityBudgetInfo(table)` and `Sim.Money` expose city budget totals and
categories. The shipped callback lifecycle includes
`Resources:OnSceneCreate`, `Resources:OnEndPostLoad`, and
`Resources:OnPostNewStep`; those are the diagnostic's reset, post-load, and
once-per-turn sample points.

## What is not exposed strongly enough

The inspected route and contract records identify a resource and quantity, but
not a transport mode, a city-link entity, or an airport prototype. Therefore a
city's freight or passenger usage cannot be credited precisely to an airport
instead of a highway link, port, rail link, or other capacity provider.

No shipped Lua example safely mutates a building's per-instance `BudgetAgent`
cost. The generic `Entity:SetValue` API exists, but its only observed use is a
bus interval; applying it to budget fields would be guessing. Direct cash APIs
also exist, but no inspected implementation proves accounting visibility,
idempotency, or persistence behavior for a recurring rebate.

Base upkeep and worker wages are separate runtime values. A future mechanism
should economically rebate against the complete verified operating cost while
leaving worker demand, wages, employment, and the class's `UpkeepCost`
untouched.

## Candidate allocation policies

Precise allocation remains the goal. If runtime measurement cannot reveal it,
two estimates are instrumented for comparison:

1. **Proportional provider allocation**
   `airport share = eligible usage × target-airport capacity / all capacity`.
   This is stable and capacity-weighted, but can credit an airport even where a
   non-air connection alone carried the route.
2. **Conservative residual allocation**
   `airport usage = max(eligible usage − non-target capacity, 0)`, capped by
   target-airport capacity. This credits airports only when aggregate demand
   exceeds every other provider's aggregate capacity. It is a defensible lower
   bound, but undercredits genuine airport traffic when unused alternative
   capacity exists or range restrictions force air transport.

For multiple target airports, the diagnostic divides either estimate by each
airport's share of target capacity. That is an allocation estimate, not route
attribution. Neither policy should be used for a release without runtime data
and an explicit documented design decision.

## Intended balance formula

For a verified per-airport utilization `u`, clamped to 0..1:

`rebate = baseline monthly operating cost × 0.80 × u`

`effective cost = baseline monthly operating cost − rebate`

This preserves at least 20% of operating cost and can never make the airport
directly profitable. For the 36,000/month freight airport the effective costs
are 36,000 idle, 21,600 at 50%, and 7,200 at full utilization.

The floor limits route-farming gains, but a cost reduction can still be gamed
if circular or useless routes count as real consumption. A release therefore
must prove that only capacity-consuming routes count, that bilateral records
are not duplicated, and that creating a route cannot yield more rebate than
its real economic cost.

## Reproduction and measurement protocol

Use a disposable test city and retain both the save and complete logs for each
case. Change one variable at a time and allow at least five stable simulation
turns after each change.

1. **Idle baseline:** build one target airport with no eligible routes. Record
   target count, design/current capacity, `PercentProductivity`, all last-cost
   fields, total budget, airport budget category, and both allocation estimates.
2. **Correct resource ramp:** add freight routes for the freight airport or
   vacations/business-services/business-hotel routes for passenger airports at
   approximately 25%, 50%, and 100% capacity. Verify route quantities, pooled
   capacity, activity, and last-sale values independently.
3. **Exclusion controls:** repeat with the wrong capacity family, cash,
   electricity, unknown tokens, and worker1-4. Eligible diagnostic usage must
   stay unchanged for all excluded resources.
4. **Provider competition:** repeat with no other provider, then add enough
   highway/sea/rail capacity to cover demand. Compare proportional and residual
   estimates. This is the decisive attribution test.
5. **Route accounting:** create one import, one export, reciprocal routes, a
   suspended route, and a circular/useless route if the UI permits it. Confirm
   exactly which records consume capacity and ensure one local route amount is
   not counted twice.
6. **Multiple airports:** test two different-sized passenger airports and two
   identical airports. Check whether activity or resource-sale values differ
   by instance and whether provider-share estimates sum to the city total.
7. **Lifecycle:** add, change, suspend, and remove routes; construct and destroy
   airports; switch cities; manually save/load; and let an autosave complete.
   The next sample must reflect current state with no accumulated stale credit.
8. **Budget decomposition:** compare class `MaxMonthlyCost` and `UpkeepCost`
   with per-instance last upkeep and worker cost. Establish whether the
   displayed total can be reconstructed without modifying employment costs.
9. **Future credit prototype only after approval:** if a visible budget-credit
   API is found, apply zero, half, and capped-full test credits; verify one
   credit per accounting period, UI category visibility, save/load behavior,
   city switching, insufficient cash, demolition, and removal of the test
   patch. Never test by editing a save.

Diagnostic lines are prefixed `[SFA_DIAG]` and normally appear under
`%LOCALAPPDATA%\Focus Home Interactive\Cities XXL\log\log_*.txt`. A
`sample-error` line means that snapshot was discarded and must not be treated
as evidence.

## Implementation gate

Economic implementation may begin only after both are demonstrated:

- a utilization signal or explicitly accepted allocation policy that does not
  miscredit other transport providers and passes the exclusion/double-counting
  tests; and
- a recurring, idempotent budget rebate mechanism that is visible, bounded,
  safe across lifecycle events, and does not alter wages or save files.

Until then, airport construction cost, capacity, range, jobs, pollution,
models, unlocks, trade prices, and monthly costs remain entirely vanilla.

## Install and uninstall

The diagnostic is not installed automatically. If approved for runtime
measurement, close Cities XXL before copying the built patch to `Paks`.
To uninstall, close the game and remove only
`zzz_CitiesXXL_SelfFundingAirports_Diagnostic_1_5_0.patch`. It has no save-file
component and requires no migration.
