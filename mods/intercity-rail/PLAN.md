# Cities XXL Intercity Rail Mod Plan

> This document preserves the broader research roadmap. The current scoped
> implementation is defined by `BUILD_PLAN.md`; everything beyond its station,
> surface rail, and international-link milestone is deferred.

## Objective

Build a rail system that lets a city gain passenger and freight trading capacity through a railway station connected to a rail corridor at the map edge.

The first release should prove the economic system. Visible moving trains are a separate experimental milestone because the game contains rail tracks and train assets but does not expose a complete train-line manager comparable to its bus and metro systems.

## What prior modders achieved

### GlobexCo CXL Unlocker v3 (2010)

Source: https://community.simtropolis.com/files/file/24723-cxl-unlocker-v3/

The surviving package was downloaded and statically extracted without launching its unsigned installer. Its embedded `railway.patch` contains 14 files:

- Two railway stations.
- Ground track and bridge classes.
- Straight, bridge, crossing, and empty layouts.
- A railway mesh plus editor track and collision definitions.

This was an eye-candy road-network workaround, not functioning intercity rail. Its ground-track class:

- Declares itself as `ROADLINE`.
- Uses the road multiline placement tool.
- Sets road capacity to `0 | 0`.
- Includes the author's comment that the `RailLine`, `RailTrain`, and `Train` tags caused pedestrians to appear instead of trains.

The old files are therefore valuable as documentation of placement, crossings, collision fixes, bridges, and known failure modes. They should not be installed directly or used as the foundation of the XXL implementation. Cities XXL already contains a smaller and cleaner native `RAILTRAIN` layout.

The original installer remains isolated under `research/legacy`. Windows Defender reported no detection during a custom scan, but the installer is unsigned and will not be executed.

### Kiwispanker's Ploppable Trains (2010)

Source: https://www.mediafire.com/file/rd73g4zitay2c1i/z_ploppable_trains_kiwi.patch/file

The surviving MCPK patch contains one actor, 22 train-car classes, and 22 layouts. Each car is a stationary furniture actor placed on a precisely sized building lot. This gives us reusable:

- Wagon and locomotive footprint lengths.
- Actor prototype references.
- Left/right placement orientations.
- A missing `v_wa_gemtrain12.actor` definition.

It does not create moving trains or connect the cars to track. Each car also produces 100 freight and 100 passenger capacity as an artificial gameplay bonus. We should remove that behavior from any scenery module so a row of parked wagons cannot create unlimited transport capacity.

One legacy car references train asset 13, which is absent from the Cities XXL actor and mesh archives. That car must be omitted unless a compatible asset is found.

### NEXL Railways proposal

Sources:

- https://citiesxl.fandom.com/wiki/NEXL_-_Railways
- https://citiesxl.fandom.com/wiki/Network_Expansion_XL_%28NEXL%29

NEXL proposed essentially the same limited goal: carry freight and passengers from the map edge to a station instead of implementing a complete internal railway simulation. The feature was deferred beyond the initial NEXL release, and no released NEXL rail package or source was found.

### Prior-art conclusion

No surviving project found in this research demonstrates functional intercity passenger or freight rail. Previous work gives us scenery, track placement experiments, bridges, exact rolling-stock sizes, and a list of traps. The economic connection between track, station, border city link, and planet trading still has to be proven in Cities XXL.

## Native XXL components we can reuse

Cities XXL already ships with:

- `r_railroad_10x40.class` and its native `RAILTRAIN` layout.
- `railroad_bridge.class`.
- `b_transport_railstation_t3.class`, its large station mesh, and its track-filled layout.
- `citylinkintercity_rail.class` with `IsCityLink` set to `rail` and a planet range of 5000.
- `multilines_citylink_rail.class`, which places the rail city-link building at the map edge.
- Rail city-link masks for many maps.
- Train meshes and actor definitions.
- `RailTrain` and `RailMetro` simulation-track configuration entries, both disabled for traffic.

The station's original, unused resource production is:

- Passenger capacity (`RPAS_0`): 1,000.
- Freight capacity (`RFRE_0`): 3,000.

Those are original game values. We will preserve them in the first fidelity prototype so we can test the abandoned design as written. Balancing should happen only after it works.

## Implementation strategy

### Phase 0 — Safe baseline and compatibility inventory

Estimated effort: 1–2 days.

1. Keep all legacy downloads in `research/legacy`; never install the CXL 2009/2010 package.
2. Record hashes and extracted-file inventories.
3. Make a clean Cities XXL test profile and a disposable test city.
4. Record the current game build, active Community Mod version, and installed mods that alter roads, city links, transport menus, or resource production.
5. Capture baseline logs for launching, saving, loading, changing cities, and trading without the rail mod.

Exit condition: repeatable clean test environment and known-good save backup.

### Phase 1 — Buildable native rail corridor

Estimated effort: 3–7 days.

1. Clone the XXL rail prototypes into uniquely named mod paths; do not overwrite the deprecated originals.
2. Expose a ground rail tool in a dedicated menu with new localization and icons.
3. Retain the native `RAILTRAIN` track entries and rail mesh.
4. Add or adapt bridge support. Use the Unlocker layouts only as a reference for section types and collision behavior.
5. Test straight placement, curves, slopes, crossings, bridges, deletion, undo, and save/reload.
6. Confirm that pedestrians, cars, and service vehicles never choose the rail corridor.

Important constraint: the Unlocker's road-style crossing layouts contain normal road, pavement, crosswalk, bus-stop, and scenery sublayouts. They should not be copied blindly into the native rail route.

Exit condition: a stable, connectable visual railway from the station area to a map edge with no ordinary road traffic and no save corruption.

### Phase 2 — Station and original capacities

Estimated effort: 2–5 days.

1. Clone and expose the native T3 station.
2. Initially retain the original 1,000 passenger and 3,000 freight capacity values unchanged.
3. Verify jobs, upkeep, pollution, resource layers, construction cost, and UI reporting.
4. Determine whether the game can require a valid rail connection before enabling production.
5. If native dependency conditions are insufficient, split the implementation into:
   - A visible station that provides no trading capacity.
   - A rail terminal/link component whose valid map-edge placement provides the capacity.

Exit condition: capacity cannot be gained merely by placing disconnected scenery anywhere on the map.

### Phase 3 — Rail border city link

Estimated effort: 3–10 days.

1. Clone `citylinkintercity_rail.class` and its rail multiline placement prototype.
2. Preserve `IsCityLink=rail`, the 5000 planet range, and the `Sim_CityLinkInterCity_rail` map constraint.
3. Compare the rail link with working road and highway links to identify missing resource, selection, and UI components.
4. Create the smallest possible vertical slice on one map: one station, one continuous line, one rail border connector.
5. Test whether the connector registers in the resource/trading UI and whether its state survives save/reload and city switching.

Decision gates:

- **Gate A — Native rail city link works:** continue with the genuine `rail` city-link type.
- **Gate B — `rail` is recognized but never contributes capacity:** keep the railway visuals but use a cloned road/highway city-link backend for the economic transaction. Clearly describe this as simulated rail capacity.
- **Gate C — `rail` causes crashes or save damage:** remove the native rail link from the playable build and use only the compatible economic backend.

Exit condition: passenger and freight trading capacity reliably appears only when the supported terminal/link arrangement exists.

### Phase 4 — Two-city and planet trading validation

Estimated effort: 2–5 days.

1. Build the supported rail terminal in city A.
2. Switch to city B and create demand or supply for passenger/freight tokens.
3. Establish and cancel trades in both directions where the game permits them.
4. Confirm the advertised capacity limit, persistence, budget effects, and behavior when the line, station, or connector is demolished.
5. Test the original 1,000/3,000 capacities under realistic production and trading loads.

This phase validates abstract intercity movement. Cities XXL loads cities separately, so actual trains will not physically drive from one loaded map into another; the planet/trading layer transfers the capacity and tokens.

Exit condition: a repeatable two-city freight/passenger test with no phantom capacity after disconnection.

### Phase 5 — Capacity and economy options

Estimated effort: 1–3 days after the system works.

Provide capacities as separate build variants or build-time profiles rather than silently changing the abandoned values:

- **Original/fidelity:** 1,000 passenger and 3,000 freight.
- **Balanced:** values determined from playtests against road and highway city links.
- **Infrastructure:** original capacity, but with substantially higher construction and upkeep costs or a hard one-per-city condition.

The first prototype uses Original/fidelity. The mod should make the chosen profile obvious in its name and description.

### Phase 6 — Rolling-stock scenery module

Estimated effort: 2–4 days.

1. Port compatible actors and exact footprints from the Kiwispanker patch under new prototype names.
2. Remove the fake per-car freight/passenger production.
3. Omit the missing train 13 asset.
4. Improve LOD behavior if existing actor definitions permit it.
5. Package static trains separately so the economic rail mod does not require them.

Exit condition: optional stationary trains can decorate tracks and yards without affecting the economy.

### Phase 7 — Moving trains experiment

Estimated effort: 2–8 weeks, with a real possibility that normal data-only modding cannot complete it.

1. In an isolated test build, enable `RailTrain` traffic and observe whether any native generator creates vehicles.
2. Search runtime logs and executable behavior for a rail traffic manager, vehicle family, station stop logic, and spawn rules.
3. If no native train manager exists, test whether the metro vehicle/line machinery can be adapted to surface rail without breaking metro.
4. Keep moving trains optional and experimental. Do not block the economic release on this phase.

Exit condition: trains move reproducibly along rail without pedestrians/cars, crashes, route leaks, or broken saves. If this cannot be achieved data-only, document the engine boundary instead of shipping an unstable hack.

### Phase 8 — Release hardening

Estimated effort: 1–2 weeks.

1. Test clean XXL and the user's normal mod set.
2. Test several maps with different rail mask shapes, plus a map with no usable rail mask.
3. Verify placement, bridges, terrain deformation, demolition, save/load, city switching, trade cancellation, and mod removal.
4. Add icons, localization, exact dependency requirements, known limitations, and uninstall instructions.
5. Package economic rail, static rolling stock, and experimental motion as separate patches where possible.

## Test matrix

At minimum, every prototype build must cover:

- Clean game and normal mod collection.
- Straight, curved, sloped, bridge, crossing, and disconnected rail.
- Station before connector, connector before station, and multiple stations/connectors.
- Save/reload with construction active and complete.
- Bulldozing the station, middle track, and border connector independently.
- Resource UI before and after each topology change.
- City switch and planet trade creation/cancellation.
- A map with a valid rail city-link mask and a map where the mask is absent or unusable.

## Success criteria for the first playable release

1. The player can build an unmistakable railway from a station to a valid map edge.
2. No pedestrians or road vehicles use the railway.
3. Freight and passenger trading capacity is granted through a valid terminal/link arrangement, not by scenery.
4. Original 1,000/3,000 capacity values are available as an explicitly labeled option.
5. Capacity and trades persist correctly across save/load and city switching.
6. Breaking or demolishing the required infrastructure removes or disables the corresponding capacity without corrupting the save.
7. Moving trains are not claimed unless they actually follow the network reliably.

## Expected schedule and risk

- Buildable static railway: several days to roughly one week.
- Economic intercity proof of concept: roughly 1–3 weeks.
- Stable, documented economic release: roughly 4–8 weeks including compatibility testing.
- Reliable moving trains: additional weeks or months, and potentially impossible without executable-level work.

The project is therefore not a simple activation flag, but it also does not need months before we know whether the core idea works. The decisive experiment is Phase 3: proving whether XXL's dormant `rail` city-link type participates in the trading simulation.

## Immediate next action

Build a minimal diagnostic patch containing only uniquely named clones of:

1. The native rail line.
2. The native station with its original resource production.
3. The native rail city-link and border placement tool.
4. Minimal menu and localization entries.

Test that vertical slice on one known rail-enabled map before porting crossings, decorative trains, or alternative capacity profiles.
