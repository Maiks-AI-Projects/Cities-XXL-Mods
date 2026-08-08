# Balanced Production Bonuses

Reduces the advertised monthly maximum and base upkeep of all genuine vanilla
production-specialization bonus buildings by 50%.

The selection is structural rather than name-based. A building must:

1. contain a `CityBonus/Resource/FirmProduction` multiplier; and
2. carry a vanilla specialization-tier tag from `EduSpe1` through `EduSpe4`.

On Cities XXL 1.5.0 this selects 38 buildings across agriculture, business
services, electricity, fuel, heavy industry, high tech, manufacturing, water,
and waste. It excludes ordinary production buildings, unrelated landmarks,
public services, roads, and the eco-factory.

The production percentage, jobs, construction cost, unlock requirements,
models, and layouts are unchanged.

The complete building-by-building comparison is available in
[`docs/balanced-production-bonuses-buildings.md`](../../docs/balanced-production-bonuses-buildings.md).

## Build

```powershell
npm run build:bonus-upkeep -- "D:\SteamLibrary\steamapps\common\Cities XXL"
```

The script accepts the game installation through its first argument or the
`CITIES_XXL_INSTALL` environment variable. It verifies the original `data.pak`
hash for Cities XXL 1.5.0 and refuses unknown source data.

Output:

`dist/zzz_CitiesXXL_BalancedProductionBonuses_1_5_0.patch`

## Install and remove

Close Cities XXL, copy the generated patch into the game's `Paks` directory,
then start the game. Remove that one patch while the game is closed to return
to vanilla values. No save files are edited.

This first release should be treated as a balance beta. Cities XXL separates
the advertised monthly maximum, base upkeep, and worker costs. Both editable
budget fields are halved, but the observed city-budget result must be verified
in a loaded city before the exact effective reduction is claimed.
