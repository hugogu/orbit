# Comet nucleus model credits

These normalized meshes are loaded on demand by the explorer and retained in a
small in-memory cache after they have been fetched. They describe the solid
nucleus only; the coma and the two tails are still rendered as educational
approximations.

## Halley

`halley.bin` was converted from the Halley mesh distributed with Celestia,
which is derived from Phil Stooke's _Cartography of Non-Spherical Worlds_ and
the Stooke Small Body Shape Models dataset:

- NASA Planetary Data System Small Body Shape Models V2.0:
  https://sbn.psi.edu/pds/resource/stkshape.html
- Celestia data source and model attribution:
  https://github.com/CelestiaProject/CelestiaContent/blob/master/README

## 67P/Churyumov–Gerasimenko

`67p.bin` was converted from the low-resolution Cartesian triplate model in
the ESA/RMOC SPC-ESA MTP009 shape-model product, distributed through the ESA
Planetary Science Archive and mirrored in the NASA Planetary Data System:

- Dataset archive:
  https://archives.esac.esa.int/psa/ftp/INTERNATIONAL-ROSETTA-MISSION/SHAPE/RO-C-MULTI-5-67P-SHAPE-V1.0/
- Product label:
  https://archives.esac.esa.int/psa/ftp/INTERNATIONAL-ROSETTA-MISSION/SHAPE/RO-C-MULTI-5-67P-SHAPE-V1.0/DATA/TRIPLATE/SPC_ESA/MTP009/CSHP_DV_047_01_LORES_OBJ.LBL

## Encke and Hale–Bopp

No complete public global nucleus mesh was found for these two comets. Their
bundled meshes are deterministic, low-poly shape approximations constrained
by the catalogued observed size information. They are intentionally not
labelled as measured terrain. The source measurements are linked from their
profile records in `lib/comets.ts`.

The generated meshes and this conversion code are part of ORBIT and may be
used under the repository's license.
