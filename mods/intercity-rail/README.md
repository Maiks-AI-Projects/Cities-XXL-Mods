# Personal Intercity Rail

This experimental Cities XXL 1.5.0 build exposes the game's dormant passenger/freight station, surface railway, and native rail city-link placement chain.

The current build preserves the abandoned station's original values:

- Passenger capacity: 1,000.
- Freight capacity: 3,000.
- City-link type: `rail`.
- Planet range: 5,000.

There are no moving trains and no claim of station-to-station passenger routing. The first package is intentionally waiting for a dedicated in-game test world before the native rail link is described as functional.

## Build

```powershell
npm run build:intercity-rail -- "D:\SteamLibrary\steamapps\common\Cities XXL"
```

The builder reads required definitions from the local game, verifies the Cities XXL 1.5.0 `data.pak`, checks direct dependencies in the installed archives, and writes an ignored MCPK patch to `dist/`. It never writes to the game installation.

Outputs:

- `dist/zzz_PersonalIntercityRail_0_1_0.patch`
- `dist/personal-intercity-rail-report.json`

## Current status

The package is statically verified but must not be treated as runtime-tested. Do not install it into a valued city. The first run should use a new dedicated test world and follow `TEST_CHECKLIST.md`.

## Design notes

The patch contains uniquely named clones rather than overriding vanilla definitions. It references the layouts, models, UI textures, and map masks already present in the user's installation. The legacy CXL 2009 Unlocker and ploppable-train files are research references only and are not packaged.

