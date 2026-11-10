# Modelos 3D — créditos e licenças

Regras (spec 5.5): só CC0 ou CC-BY; CC BY-NC-SA só para tenants em `CAR3D_NC_TENANTS`, sempre com
crédito. Nunca NoDerivatives nem Editorial. Emblemas e placas removidos, `.glb` ≤ 3 MB.
Cada modelo entra também em `CAR_MODELS` (`src/catalog.ts`) com título, autor, licença e link.

| Arquivo | Carroceria | Título | Autor | Licença | Origem |
|---|---|---|---|---|---|
| `placeholder-hatch.glb` | hatch | Hatch (provisório) | Paddock Solutions | própria, sem crédito | gerado por `scripts/make-placeholder.mjs` |
| `placeholder-sedan.glb` | sedan | Sedã (provisório) | Paddock Solutions | própria, sem crédito | gerado por `scripts/make-placeholder.mjs` |
| `placeholder-suv.glb` | suv | SUV (provisório) | Paddock Solutions | própria, sem crédito | gerado por `scripts/make-placeholder.mjs` |
| `placeholder-pickup.glb` | pickup | Picape (provisório) | Paddock Solutions | própria, sem crédito | gerado por `scripts/make-placeholder.mjs` |
| `placeholder-van.glb` | van | Van (provisório) | Paddock Solutions | própria, sem crédito | gerado por `scripts/make-placeholder.mjs` |

Os provisórios são caixas geradas localmente (nada baixado). Os `.glb` e os `regions/*.regions.json`
ficam em `apps/dscar-web/public/car-3d/`; regerar com `npm run make-placeholder -w @paddock/car-3d`
(sobrescreve os JSON: ajuste fino feito na tela `/dev/car-3d` precisa ir para o script).
