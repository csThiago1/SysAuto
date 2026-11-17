# Modelos 3D — créditos e licenças

<!-- Gerado por scripts/make-credits.mjs a partir de CAR_MODELS (src/catalog.ts). Não editar à mão. -->

Regras (spec 5.5): só CC0 ou CC-BY; CC BY-NC-SA só para tenants em `CAR3D_NC_TENANTS`, sempre com
crédito. Nunca NoDerivatives nem Editorial. Emblemas e placas removidos, `.glb` ≤ 3 MB.
O crédito também aparece na página /sobre/creditos e no rodapé do PDF do checklist.

## Modelos definitivos

Ordem de `CAR_MODELS`: família → padrão da carroceria (o primeiro permitido vence) → provisório.
Modificações em todos: malha simplificada e comprimida (meshopt), texturas em WebP; escala, giro e origem
normalizados; vidros escurecidos (`npm run prepare-models -w @paddock/car-3d`). O que saiu de cada um está
na coluna Modificações.

| Arquivo | Carroceria | Título | Autor | Licença | Origem | Famílias | Padrão da carroceria | Modificações |
|---|---|---|---|---|---|---|---|---|
| `polo.glb` | hatch | 2024 Volkswagen Polo 170 TSI | Ddiaz Design | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) (só tenants em `CAR3D_NC_TENANTS`) | https://sketchfab.com/3d-models/2024-volkswagen-polo-170-tsi-ec0f4dfd1ca84a859725e4002e9cf120 | volkswagen/polo | sim | interior, emblemas e placas removidos |
| `virtus.glb` | sedan | 2024 Volkswagen Virtus TSI | Ddiaz Design | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) (só tenants em `CAR3D_NC_TENANTS`) | https://sketchfab.com/3d-models/2024-volkswagen-virtus-tsi-2678bb3bfbe1482cb6faa084674e100b | volkswagen/virtus | sim | interior, emblemas e placas removidos |
| `onix.glb` | sedan | chevrolet onix | uzb_rx7 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | https://sketchfab.com/3d-models/chevrolet-onix-bfd798c2695847b28ab681d42abc7056 | chevrolet/onix, chevrolet/onix_plus | sim | gravatas, letreiro ONIX e placa traseira removidos; interior mantido |
| `spark_euv.glb` | suv | 2026 Chevrolet Spark EUV | Ddiaz Design | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) (só tenants em `CAR3D_NC_TENANTS`) | https://sketchfab.com/3d-models/2026-chevrolet-spark-euv-620ce2baa45d466ca599412c3b843efc | chevrolet/spark_euv | não | interior, emblemas e placas removidos |

## Provisórios

Caixas geradas localmente por `scripts/make-placeholder.mjs` (nada baixado), sem crédito. Regerar com
`npm run make-placeholder -w @paddock/car-3d` (sobrescreve os JSON: ajuste fino feito na tela
`/dev/car-3d` precisa ir para o script).

| Arquivo | Carroceria | Título |
|---|---|---|
| `placeholder-hatch.glb` | hatch | Hatch (provisório) |
| `placeholder-sedan.glb` | sedan | Sedã (provisório) |
| `placeholder-suv.glb` | suv | SUV (provisório) |
| `placeholder-pickup.glb` | pickup | Picape (provisório) |
| `placeholder-van.glb` | van | Van (provisório) |

Os `.glb` e os `regions/*.regions.json` ficam em `apps/dscar-web/public/car-3d/`.
