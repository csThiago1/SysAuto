// Gera assets/CREDITS.md a partir de CAR_MODELS (src/catalog.ts). Rodar: npm run make-credits -w @paddock/car-3d
// (o Node lê o .ts direto: o catálogo só importa tipos.)
import { writeFileSync } from "node:fs";
import { CAR_MODELS, LICENSE_LABELS, LICENSE_URLS } from "../src/catalog.ts";

const license = (l) =>
  `[${LICENSE_LABELS[l]}](${LICENSE_URLS[l]})${l === "CC-BY-NC-SA-4.0" ? " (só tenants em `CAR3D_NC_TENANTS`)" : ""}`;

const real = CAR_MODELS.filter((m) => m.license !== "PLACEHOLDER");
const placeholders = CAR_MODELS.filter((m) => m.license === "PLACEHOLDER");
const families = (m) => m.families.map((f) => `${f.make}/${f.family}`).join(", ") || "—";

const md = `# Modelos 3D — créditos e licenças

<!-- Gerado por scripts/make-credits.mjs a partir de CAR_MODELS (src/catalog.ts). Não editar à mão. -->

Regras (spec 5.5): só CC0 ou CC-BY; CC BY-NC-SA só para tenants em \`CAR3D_NC_TENANTS\`, sempre com
crédito. Nunca NoDerivatives nem Editorial. Emblemas e placas removidos, \`.glb\` ≤ 3 MB.
O crédito também aparece na página /sobre/creditos e no rodapé do PDF do checklist.

## Modelos definitivos

Ordem de \`CAR_MODELS\`: família → padrão da carroceria (o primeiro permitido vence) → provisório.
Modificações em todos: malha simplificada e comprimida (meshopt), texturas em WebP; escala, giro e origem
normalizados; vidros escurecidos (\`npm run prepare-models -w @paddock/car-3d\`). O que saiu de cada um está
na coluna Modificações.

| Arquivo | Carroceria | Título | Autor | Licença | Origem | Famílias | Padrão da carroceria | Modificações |
|---|---|---|---|---|---|---|---|---|
${real
  .map(
    (m) =>
      `| \`${m.file}\` | ${m.bodyType} | ${m.title} | ${m.author} | ${license(m.license)} | ${m.sourceUrl} | ${families(m)} | ${m.bodyDefault ? "sim" : "não"} | ${m.changes} |`,
  )
  .join("\n")}

## Provisórios

Caixas geradas localmente por \`scripts/make-placeholder.mjs\` (nada baixado), sem crédito. Regerar com
\`npm run make-placeholder -w @paddock/car-3d\` (sobrescreve os JSON: ajuste fino feito na tela
\`/dev/car-3d\` precisa ir para o script).

| Arquivo | Carroceria | Título |
|---|---|---|
${placeholders.map((m) => `| \`${m.file}\` | ${m.bodyType} | ${m.title} |`).join("\n")}

Os \`.glb\` e os \`regions/*.regions.json\` ficam em \`apps/dscar-web/public/car-3d/\`.
`;

writeFileSync(new URL("../assets/CREDITS.md", import.meta.url), md);
