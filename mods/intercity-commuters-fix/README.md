# Intercity Commuters Fix (observer prototype)

Status: **observer test 0.1.0; no simulation behavior is modified**.

Cities XXL advertises city-to-city trades of `worker1` through `worker4`, but the
original 1.5.0 scripts treat those trades as token/resource accounting rather
than as workers assigned to destination firms. The initial investigation found
no safe data-script hook that turns an imported worker resource into an ordinary
firm employee without also creating a resident citizen or bypassing native
`JobProvider` invariants.

See [RESEARCH.md](./RESEARCH.md) for source references, current-save evidence,
the controlled reproduction protocol, feasibility assessment, and the smallest
safe follow-up experiment.

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for the two viable native
architectures, phased proof gates, acceptance criteria, and stop conditions.

The first build is a version-gated native observer, not the commuter mechanic.
It proves that a separately named DLL can load through Lua, remain on the game
thread, and verify the exact executable and `data.pak` incrementally without
installing any JobProvider hook. The patch adds only the stock game's unused
`MapSaveMgr.master` extension file; it does not override `ingame.lua` and can run
beside the Trade Panel.

## Observer test

Build the additive patch from a verified local installation:

```text
npm run build:commuter-observer -- "D:\SteamLibrary\steamapps\common\Cities XXL"
```

Build the native DLL with a 32-bit MinGW compiler using
`scripts/build-native.sh`, then run `npm run package:commuter-observer`.
The packaged test contains exactly two installable files:

- `cxxlcommuters.dll`, copied to the Cities XXL installation root;
- `zzz_CitiesXXL_IntercityCommutersObserver_1_5_0.patch`, copied to `Paks`.

Close the game before installing or removing either file. Load a disposable city,
let it run for at least one minute, exit normally, and inspect the newest
`%LOCALAPPDATA%\focus home interactive\Cities XXL\log\*_GameClient.log` for
`Intercity Commuters observer`. The successful terminal message is:

```text
Intercity Commuters observer verified Cities XXL 1.5.0; no simulation hooks installed
```

To remove the observer, close the game and delete only those two files. It creates
no citizen entities, routes, save records, or simulation allocations.
