# Restyle Mobile "Mistura Densa" — Design

**Data:** 2026-07-14
**Status:** Aprovado (mock validado pelo usuário: `~/Downloads/direcao-final-dscar.html`)
**Contexto:** após o mutirão de responsividade e o polish, o usuário avaliou que o app ainda
"parece desktop espremido num celular" — espaçamento excessivo, pouca densidade, cara de sistema.
Direção escolhida num comparativo A/B: **mistura** — superfícies suaves e pastilhas de ícone da
direção "Refinado" + faixa de status, mono e densidade da direção "Operacional".

## Princípios (mobile < md; desktop permanece como está*)

1. **Densidade nativa**: gutter total da página ~8-10px; gap entre cards 8px (`space-y-2`);
   padding interno de cards 9-12px. Nada de padding de desktop encolhido.
2. **Alinhamento em colunas (regra dura)**: rodapé/linha de dados de QUALQUER card de lista usa
   grid de colunas fixas (`grid-cols-[minmax(0,1fr)_96px_44px]` ou equivalente) — texto flexível
   trunca, valores alinhados à direita em coluna fixa, datas em coluna fixa. **PROIBIDO
   `justify-between`** em rodapé de card de lista (valores "flutuam" conforme o texto vizinho).
3. **Status por cor, não por pill**: faixa de 3px na borda esquerda do card (cor do status via
   `SERVICE_ORDER_STATUS_CONFIG.dot`/equivalente) + status como texto colorido pequeno. Pills
   saem dos cards de lista (economizam altura).
4. **Superfície por tom, não por borda**: cards de lista sem `border`, fundo elevado em relação
   à página (tokens existentes: página `bg-background`, card `bg-card` ou `bg-muted/40` — o que
   der contraste equivalente ao mock #15151a sobre #0e0e11; se nenhum token servir, criar
   `--surface-raised` no tema). Radius 11-12px (`rounded-[11px]` ou `rounded-xl`).
5. **Dados em mono tabular**: valores, placas, datas e ids com `font-mono tabular-nums`.
6. **Cabeçalho de página compacto**: título `text-xl` no mobile (`md:` mantém o atual),
   subtítulo colado (mt-0.5), tudo via `PageHeader`.
7. **Seções por eyebrow**: label uppercase 10.5px/600 com régua à direita (componente
   `SectionLabel`) em vez de cards-título — barato em altura.
8. **KPIs em régua contínua**: grid `grid-cols-2` com divisor de 1px (gap-px sobre fundo
   divisor), célula = pastilha de ícone 26px colorida + label 11px + valor mono 17px.
   Componente compartilhado `KpiStrip`. *Única mudança visível também no desktop
   (`md:grid-cols-4`) — aceita pelo trade de coesão.

## Componentes novos/alterados

| Componente | Mudança |
|---|---|
| `KpiStrip` (novo, `src/components/ui/kpi-strip.tsx`) | Régua de KPIs conforme princípio 8; substitui grids de StatCard/cards KPI nas telas migradas |
| `SectionLabel` (novo, `src/components/ui/section-label.tsx`) | Eyebrow com régua |
| `PageHeader` | Título/subtítulo compactos no mobile |
| Layout `(app)/layout.tsx` | Gutter mobile: `px-2` (páginas perdem padding horizontal próprio no mobile: `px-0 md:p-6`) |
| Card de OS (`ServiceOrderTable.tsx`) | Receita completa do mock (faixa, colunas fixas, mono, superfície) — vira o PILOTO |
| Cards de compras ×2, fiscal/documentos, orçamentos-particulares | Herdam a receita do piloto (faixa com cor do status próprio de cada domínio) |
| Dashboard | KpiStrip + header compacto + eyebrows |

## Fora de escopo
- Desktop (exceto KpiStrip nos dashboards migrados).
- Workspace v2 interno (seções da OS) — já denso o suficiente; só herda gutter/header.
- Telas de detalhe/formulários.
- Mudança de copy dos labels de KPI (backlog anterior — aproveitar labels curtos no KpiStrip
  onde a mudança for só de apresentação: "Faturamento (mês)" → "Faturamento" é aceitável dentro
  da régua porque o contexto "julho 2026" está no subtítulo).

## Verificação
- Playwright 390×844 por tela migrada; critérios: ~6-7 OS visíveis por tela na lista, valores e
  datas alinhados verticalmente card a card (medir via DOM: mesma coordenada X de borda direita),
  alvos de toque ≥44px preservados, desktop 1280px sem regressão (exceto KpiStrip).
- tsc, vitest, build webpack verdes.
- Regras novas documentadas no CLAUDE.md (alinhamento em colunas, densidade mobile, proibição de
  justify-between em rodapé de card).
