# Textures PBR — provenance et licence

Toutes les textures de ce dossier viennent de [Poly Haven](https://polyhaven.com) et sont publiées
sous licence **CC0** (domaine public) : réutilisation libre, y compris commerciale, sans attribution
obligatoire. Les auteurs sont cités ici par courtoisie.

| Dossier | Source | Auteur·rice | Taille réelle | Usage dans le site |
| --- | --- | --- | --- | --- |
| `sandy_gravel` | https://polyhaven.com/a/sandy_gravel | Charlotte Baglioni | 2,1 m | sable ratissé du jardin |
| `white_plaster_02` | https://polyhaven.com/a/white_plaster_02 | Rob Tuytel | 1 m | enduits (shikkui, murs intérieurs) |
| `oak_veneer_01` | https://polyhaven.com/a/oak_veneer_01 | Jenelle van Heerden | 1,83 m | fil du bois des poutres et boiseries |
| `hinoki_planks` | https://polyhaven.com/a/hinoki_planks | Charlotte Baglioni | 1,89 m | planchers, engawa |
| `tatami_mat` | https://polyhaven.com/a/tatami_mat | Charlotte Baglioni | 1,8 m | tatamis |
| `lichen_rock` | https://polyhaven.com/a/lichen_rock | Rico Cilliers | 2 m | pierres du jardin, lanternes de pierre |
| `mossy_rock` | https://polyhaven.com/a/mossy_rock | Rob Tuytel | 3 m | mousse sur les pierres |
| `trident_maple_bark` | https://polyhaven.com/a/trident_maple_bark | Charlotte Baglioni | 1,8 m | écorce des érables |
| `grey_roof_tiles` | https://polyhaven.com/a/grey_roof_tiles | Rob Tuytel | 3 m | tuiles (désaturées en kawara gris) |
| `rough_linen` | https://polyhaven.com/a/rough_linen | colormass, Rico Cilliers | 0,27 m | tissu (bandelette de Kaen) |
| `japanese_cedar_bark` | https://polyhaven.com/a/japanese_cedar_bark | Charlotte Baglioni | 1 × 2 m | écorce des cryptomères (sugi) de la forêt |
| `pine_bark` | https://polyhaven.com/a/pine_bark | Dimitrios Savva | 2 m | écorce des pins noirs taillés (désaturée vers le gris du kuromatsu) |
| `stone_carved` | dérivé de `lichen_rock` (désaturé, contraste et relief adoucis) | Rico Cilliers | 2 m | pierre taillée : lanternes, stèle, bassins, chaperons |

Préparation (script hors dépôt) : sources 2K JPG vérifiées par md5, albédos des matériaux teintables
(enduit, bois, tuiles, lin) ramenés à une luminance moyenne fixe pour que la palette du site les
colore sans perdre le grain ; réduction en 1K (Lanczos) ; carte ARM = occlusion (R), rugosité (G),
métal (B).
