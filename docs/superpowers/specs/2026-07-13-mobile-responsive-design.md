# Mutirão Mobile — Padrão Responsivo + Correções em Todo o App

**Data:** 2026-07-13
**Status:** Aprovado (decisões do usuário: escopo = app inteiro com padrão compartilhado; tabelas = cards no mobile)
**Base de evidência:** auditoria em 390×844 de 22 telas — `.superpowers/sdd/mobile-audit-part1.md` e `mobile-audit-part2.md` (29 problemas: 10 quebrados, 9 ruins, 10 cosméticos)

## Contexto

O app foi construído desktop-first. A auditoria confirmou que os problemas se concentram em 5 padrões
sistêmicos repetidos, mais um punhado de bugs pontuais. O objetivo é duplo: (1) corrigir tudo que a
auditoria achou; (2) instituir um padrão responsivo documentado + componentes compartilhados para o
problema não voltar.

## Decisões

| Decisão | Valor |
|---|---|
| Tabelas no mobile | **Cards** abaixo de `md` (padrão contas-a-pagar), tabela no desktop |
| Piso de segurança | Toda tabela que ainda não virou cards ganha `overflow-x-auto` + fade indicador — NUNCA `overflow-hidden` |
| KPI cards | `grid-cols-2 lg:grid-cols-4` (ou `lg:grid-cols-3`) — nunca 3/4 fixo |
| Viewport de referência | 390px (iPhone). Toda tela nova é testada nele antes de mergear |
| Documentação do padrão | Seção "Responsividade Mobile" no CLAUDE.md + componentes em `src/components/ui/` |

## 1. O Padrão (regras compartilhadas)

Documentar no CLAUDE.md (seção nova "Responsividade Mobile — regras") e aplicar em todo o mutirão:

1. **Tabelas**: listas operacionais usam tabela `hidden md:table` + lista de cards `md:hidden`
   (referência viva: `/financeiro/contas-pagar`). Tabelas densas de detalhe que não migrarem agora:
   wrapper `overflow-x-auto` com fade de borda — proibido `overflow-hidden` em wrapper de tabela.
2. **KPI grids**: `grid grid-cols-2 gap-3 lg:grid-cols-4` (2 colunas no celular, sempre).
3. **Headers de página**: container `flex flex-wrap gap-y-2`; título com `min-w-0`; ícone ao lado de
   título+descrição usa `items-start` (não `items-center`); fileiras de botões com `flex-wrap`.
4. **Toolbars/filtros**: `flex flex-wrap gap-2`; inputs com `min-w-0 flex-1`, nunca larguras fixas
   somando mais que 390px.
5. **Scroll horizontal da página é proibido**: o `<main>` do layout ganha `overflow-x-hidden`;
   scroll lateral só dentro de containers explícitos (kanban, tabelas, tab bars).
6. **Elementos roláveis horizontais** (tab bars, steppers, kanban) ganham indicação visual de
   continuação (fade na borda).
7. **Dialogs**: `flex max-h-[90dvh] flex-col` com área de conteúdo `min-h-0 flex-1` (padrão já
   aplicado na câmera).

## 2. Componentes compartilhados novos

- **`ScrollFade`** (`src/components/ui/scroll-fade.tsx`): wrapper `overflow-x-auto` com fade de
  borda direita enquanto houver conteúdo rolável (o piso das tabelas não migradas; também usado em
  tab bars). Implementação CSS-first, sem observers pesados.
- **`MobileCards`** *(padrão, não componente)*: cada tela define seu card seguindo o esqueleto do
  contas-a-pagar (`hidden md:...` na tabela + `md:hidden space-y-2` na lista de cards). Não criar
  abstração genérica de card — os campos variam demais por tela (YAGNI).

## 3. Correções por tela (da auditoria)

### Quebrados (prioridade máxima)
| Tela | Problema | Correção |
|---|---|---|
| `/os` lista | Tabela `overflow-hidden` corta SEGURADORA (`ServiceOrderTable.tsx:60`) | Migrar pra cards (tela nº 1 de uso no pátio) |
| `/os/kanban` | Página inteira com scroll-x; header `shrink-0` sem wrap; `layout.tsx` main `overflow-auto` | `overflow-x-hidden` no main (global), `flex-wrap` no header, coluna com fade |
| `/agenda` | "Agendar" e Mês/Semana/Dia fora da viewport (`CalendarHeader.tsx:50`) | Header em 2 linhas com `flex-wrap`; remover `min-w-[200px]` |
| `/compras` | KPI `grid-cols-4` fixo + tabela `overflow-hidden` (Status/Ação inacessíveis) | KPI 2 col + cards |
| `/compras/ordens` | Tabela `overflow-hidden` (coluna Itens + empty state cortados) | Cards |
| `/fiscal/documentos` | KPI `grid-cols-3` fixo + tabela `overflow-hidden` (Status cortado) | KPI 2-3 col responsivo + cards |

### Ruins
| Tela | Problema | Correção |
|---|---|---|
| `PageHeader` (compartilhado) | Título quebra feio ao lado das ações (afeta `/os` e outras) | `flex-wrap` + `min-w-0` no componente |
| `/orcamentos-particulares` | KPI `grid-cols-4` fixo; busca+select estouram; tabela sem affordance | KPI 2 col; filtros `flex-wrap`; cards |
| OS v2 — Fechamento | Alerta espremido contra botão (`ClosingTab.tsx:147`); input KM ilegível (`:283`) | `flex-col sm:flex-row`; grid 1 col mobile + `min-w-0 flex-1` no input |
| OS v2 — Peças | Tabela rolável sem indicação | Envolver com `ScrollFade` |
| OS v2 — header sticky | ~230px fixos (30% da tela) | Sticky só em `md:+`; no mobile o header rola com a página |
| Kanban | Coluna cortada sem affordance | Fade de borda no container das colunas |

### Cosméticos
| Tela | Problema | Correção |
|---|---|---|
| `/cadastros` | Fileira de tabs corta "Funcionários" | `overflow-x-auto` na fileira (ScrollFade) |
| `/estoque`, `/fiscal/resumo`, `/fiscal/documentos` | Ícone do header desalinhado | `items-start` (regra 3 do padrão) |
| OS v2 — Estoque | Placeholder do scanner cortado (`BarcodeScanInput.tsx:78`) | `truncate` no input / placeholder curto |
| `/orcamentos` | Botão espremido no header | Cobrido pelo fix do `PageHeader` |
| `/financeiro/contas-pagar` | Placeholder cortado + linha de datas apertada | Placeholder curto; datas com `flex-wrap` |

### Fora de escopo desta sprint
- Telas de detalhe/formulário não auditadas (compartilham componentes das listas — reavaliar depois).
- Gráfico vazio do dashboard (dados zerados, não é bug de layout — confirmar com dado real).
- Erro do DRE (configuração de plano de contas do ambiente, não é UI).
- Telas do motor de precificação (módulo fora do MVP).

## 4. Testes e verificação

- **Playwright**: re-auditoria guiada por subagente nas mesmas 22 telas em 390×844 ao final —
  critério: zero "quebrado", zero "ruim" novos.
- **Vitest**: suíte existente verde (132); componente `ScrollFade` com teste mínimo se ganhar lógica.
- **tsc + build webpack** verdes.
- Verificação real no celular do usuário após deploy.

## 5. Riscos

- Conversão pra cards muda a hierarquia visual de telas de trabalho — validar a lista de OS em cards
  com o usuário cedo (primeira task de tela, screenshot antes de replicar o padrão nas demais).
- `overflow-x-hidden` no main global pode esconder overflow legítimo de alguma tela não auditada —
  a re-auditoria final varre as 22 telas pra pegar regressão.
