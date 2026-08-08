# Affordable Highway Link

Rebalances the Cities XXL intercity **Highway Link** around its increased
capacity. A normal road link provides 20 freight and 20 passenger capacity for
100 per month; the highway link provides 100 of each for 1,000 per month. That
is 5× the capacity for 10× the upkeep, retaining a premium for the stronger
connection without the vanilla 500× price jump.

| Field | Vanilla | Modded |
|---|---:|---:|
| Maximum monthly cost | 50,000 | 1,000 |
| Base upkeep | 50,000 | 1,000 |

Only this class is overridden:

`data/design/buildings/construction/citylink/citylinkintercity_highway.class`

The construction cost (150,000), 5,000 planet range, capacity, model, unlock
conditions, and ordinary road links are unchanged. Keeping this separate from
Balanced Production Bonuses lets players install either balance change on its
own.

## Build

```powershell
node mods/affordable-highway-link/build.mjs "D:\SteamLibrary\steamapps\common\Cities XXL"
```

Output:

`dist/zzz_CitiesXXL_AffordableHighwayLink_1_5_0.patch`

## Install and remove

Close Cities XXL before copying the generated patch into the game's `Paks`
directory. Remove that one patch while the game is closed to restore the
vanilla 50,000 monthly cost. No save files are edited.
