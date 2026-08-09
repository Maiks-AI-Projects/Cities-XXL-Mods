# Self-Funding Airports (experimental research)

Self-Funding Airports is currently a **read-only diagnostic**, not an economic
gameplay mod. The research found enough API surface to observe airport supply,
citywide trade demand, and budget totals, but not enough to attribute a route's
capacity use to a particular airport or to apply a safe recurring rebate.

The diagnostic records:

- the three exact vanilla airport prototypes in scope;
- each matching instance's current/design capacity, displayed activity,
  subsidy, profitability, and last resource/upkeep/worker values;
- freight and passenger capacity for every intercity transport mode;
- eligible offline and online trade usage, excluding cash, electricity, and
  `worker1` through `worker4`;
- proportional and conservative-residual allocation estimates; and
- city budget totals needed for a later rebate-mechanism test.

It does not change airport classes, cash, budgets, routes, saves, or simulation
entities. It overrides one vanilla callback script only to take one protected
sample per simulation turn and after loading.

## Build and validate

Use Node.js 22 or later and a local Cities XXL installation whose `data.pak`
has SHA-256
`aadac92c0e2e8dd8649066b21a1a9af18f4639332b54d227faeb1991894bf8f4`.

```powershell
npm install
npm run build:self-funding-airports-diagnostic -- "D:\SteamLibrary\steamapps\common\Cities XXL"
npm run test:self-funding-airports
```

The output is
`dist/zzz_CitiesXXL_SelfFundingAirports_Diagnostic_1_5_0.patch`. The builder
refuses a mismatched archive or callback-script hash and verifies that the
patch contains exactly `data/design/script/siminfo/resources.lua`.

## Optional runtime measurement

Do not install this diagnostic for normal play. If runtime validation is
approved, close Cities XXL, copy the patch to the game's `Paks` directory,
run the protocol in `FEASIBILITY.md`, and inspect
`%LOCALAPPDATA%\Focus Home Interactive\Cities XXL\log\log_*.txt` for
`[SFA_DIAG]` lines.

Because it replaces `resources.lua`, do not combine it with another patch that
replaces that same path until the scripts have been merged and revalidated.

## Removal

Close Cities XXL and delete only
`zzz_CitiesXXL_SelfFundingAirports_Diagnostic_1_5_0.patch` from the game's
`Paks` directory. No save editing or cleanup is required. The build command
never installs the patch automatically.

## Folder contents and portability

- `FEASIBILITY.md` contains the source findings, utilization and rebate
  formulas, allocation-policy risks, reproduction protocol, lifecycle tests,
  implementation gates, and known limitations.
- `diagnostic.lua` is the protected read-only runtime instrumentation.
- `build.mjs` verifies the vanilla archive and builds the removable diagnostic
  patch.
- `test.mjs` checks Lua 5.1 syntax, read-only restrictions, balance examples,
  and generated archive scope.

The shared `tools/mcpk.mjs` archive library is imported by `build.mjs`.
`tools/extract-game-files.mjs` is a reusable, path-checked research utility;
it is not required to install or remove the mod. Original game files and
research extractions are intentionally absent from this folder and repository.
