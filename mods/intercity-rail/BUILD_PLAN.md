# Personal Intercity Rail — Active Build Plan

## Active milestone

Build one ready-to-test Cities XXL patch that exposes and connects the dormant native components needed for:

- A placeable passenger/freight railway station.
- A buildable surface railway.
- A railway border connector/international city link.
- The station's original passenger capacity of 1,000.
- The station's original freight capacity of 3,000.
- Multiple instances of the same station, if the game permits them.

This is a personal experimental build developed in public. It is not being prepared as a polished public release.

## Explicitly outside this milestone

- Moving trains or other moving railway vehicles.
- True station-to-station passenger routing inside the city.
- A metro conversion or new transport-line manager.
- New meshes, textures, sounds, or animations.
- Balance changes to the original capacities.
- An installer, Steam Workshop packaging, or release marketing.
- Exhaustive mod compatibility or support for every map.
- Runtime testing before the user returns home and creates a dedicated test world.

The station may be placed more than once, but in this milestone each station remains an intercity capacity producer. Multiple stations do not imply that citizens are individually transported between them.

## Technical approach

The build will derive four uniquely named prototypes from the user's local Cities XXL 1.5.0 archives:

1. `r_railroad_10x40.class` — buildable rail corridor.
2. `b_transport_railstation_t3.class` — passenger/freight terminal.
3. `citylinkintercity_rail.class` — international rail connector.
4. `multilines_citylink_rail.class` — map-edge connector placement.

The generated prototypes will continue to reference the original installed layouts, meshes, thumbnails, and map masks. The repository will contain the transformation/build logic rather than copied binary game assets.

### Required transformations

- Give every generated prototype a unique path so vanilla definitions are not overwritten.
- Remove the `Deprecated` tag from the generated rail and station prototypes.
- Add a unique project tag for static inspection and later compatibility work.
- Point the generated rail class to the generated multiline placement tool.
- Point the generated multiline tool to the generated rail city-link prototype.
- Preserve `IsCityLink=rail` and `CityLinkPlanetRange=5000`.
- Preserve the `Sim_CityLinkInterCity_rail` placement constraint.
- Preserve station production at `RPAS_0=1000` and `RFRE_0=3000`.
- Preserve the native `RAILTRAIN` layout and keep normal traffic disabled.
- Reuse the game's existing display-name and description keys for the first build.

## Build stages

### Stage 1 — Source inventory

- Verify the local `data.pak` and `data2.pak` identities.
- Locate the four source prototypes.
- Verify that every referenced model, layout, thumbnail, and placement mask exists in the installed archives.
- Record source hashes and the archive build number in the generated report.

Completion: all required sources and direct dependencies are accounted for without using the legacy Unlocker at runtime.

### Stage 2 — Prototype generator

- Add `mods/intercity-rail/build.mjs`.
- Read the vanilla source definitions directly from the local installation.
- Apply narrow, asserted XML transformations.
- Refuse to build if a required source field is missing, duplicated, or has an unexpected value.
- Never write into the game installation.

Completion: the generator produces four transformed files entirely in memory.

### Stage 3 — Static correctness checks

Before packaging, the builder must assert:

- Exactly four intended prototypes are generated.
- No generated class contains the `Deprecated` tag.
- No generated file overwrites its vanilla source path.
- The station still produces exactly 1,000 `RPAS_0` and 3,000 `RFRE_0`.
- The city link still uses `IsCityLink=rail` and range 5000.
- The rail-to-multiline-to-city-link reference chain resolves to the generated paths.
- All untouched mesh/layout/UI references resolve in the installed archives.
- No legacy CXL 2009 files are included.
- No moving-train or traffic configuration is enabled.

Completion: all assertions pass against Cities XXL 1.5.0.

### Stage 4 — Reproducible package

- Package the four prototypes into an MCPK v3 `.patch` in `dist/`.
- Reopen the generated archive with the local MCPK parser.
- Verify every packaged path, byte count, checksum, and transformed value.
- Write a JSON build report beside the ignored `.patch` output.
- Add an npm build command and concise developer README.

Completion: repeated builds from the same game archive produce the same verified patch contents.

### Stage 5 — Ready-to-test handoff

- Do not launch Cities XXL.
- Do not copy the patch into the game's `Paks` directory yet.
- Provide the exact output path and checksum.
- Prepare a short manual checklist for the dedicated test world.
- Mark all runtime-dependent claims as unverified until the user is home.

Completion: the build is technically complete and waiting only for the agreed in-game test session.

## Deferred runtime test session

When the user is home, the first dedicated world should test in this order:

1. Confirm the railway and station appear in the construction menus.
2. Place a short isolated railway and confirm no pedestrians or road vehicles use it.
3. Place the station and record the resource-panel change.
4. Extend the railway to a valid map edge and confirm the rail city-link connector is created.
5. Save, exit, reload, and verify that every component persists.
6. Create or open a second city and attempt passenger/freight trading.
7. Demolish the border connection, track, and station separately and record how capacity changes.
8. Place a second station and record whether capacity stacks and whether any connection dependency exists.

The result of this session determines whether `IsCityLink=rail` is fully active, only partially implemented, or inert.

## Functional acceptance criteria

The milestone becomes runtime-verified only when:

- The station and railway can be selected and placed without crashing.
- The rail corridor reaches a valid map-edge rail connector.
- The station supplies the original passenger and freight capacities.
- The resulting capacity can support city-to-city/planet trading.
- Save and reload preserve the infrastructure and trading state.
- Normal pedestrians and road vehicles do not use the rail corridor.

If the native `rail` link does not participate in trading, the next build will retain the same visuals and use a private cloned road/highway city-link backend. That fallback will not be implemented before the native path has been tested.

## Future phases

### Future A — Local passenger stations

Add smaller stations and investigate a simulated local passenger network. First attempt coverage/layer-based benefits; only investigate true routing if native systems expose a workable connection model.

### Future B — Economic controls

Add optional limits, costs, upkeep, station tiers, or balanced capacities while keeping the original 1,000/3,000 profile available.

### Future C — Network construction

Add purpose-built bridges, tunnels, crossings, junction behavior, more terrain support, and additional map-mask compatibility.

### Future D — Rolling stock

Add optional stationary trains using compatible actor placements from the preserved Kiwispanker work, without artificial capacity per wagon.

### Future E — Motion experiment

Investigate moving trains only after the economic system is stable. This remains optional and may require engine-level work.

### Future F — Public collaboration polish

Improve contributor documentation, issue templates, compatibility notes, automated reports, and public build instructions. This is repository maintenance, not a requirement for the user's personal playable build.

