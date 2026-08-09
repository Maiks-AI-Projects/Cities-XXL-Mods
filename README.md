# Cities XXL Mods

Open-source build tools and gameplay fixes for Cities XXL 1.5.0.

This repository does not redistribute original Cities XXL archives, extracted
game files, saves, or DLLs. Build scripts read files from a locally installed
copy of the game and create removable `.patch` archives in `dist/`.

## Planned mods

- **Balanced Production Bonuses** — reduces the monthly upkeep of genuine
  citywide production-bonus buildings by 50% while preserving their original
  construction cost, unlock conditions, and production multiplier.
- **Personal Intercity Rail** — active experimental build exposing the dormant
  station, surface railway, and international rail-link chain. Its generated
  patch is statically verified and intentionally awaits a new in-game test
  world before runtime functionality is claimed.

## Safety

Each gameplay change is packaged separately. Installing or removing one mod
must not require editing a save file. Always close Cities XXL before adding or
removing a patch.
