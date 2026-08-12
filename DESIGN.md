---
name: DS Car ERP
description: Workspace escuro de oficina — prancheta de metal, dados carbonados, cor só onde há ação ou risco.
colors:
  primary: "#ac27ce"
  primary-light: "#7a298e"
  surface-base: "#0a0a0a"
  surface-card: "#121212"
  surface-raised: "#141414"
  surface-inset: "#242424"
  ink: "#f2f2f2"
  ink-muted: "#8c8c8c"
  rule: "#2e2e2e"
  steel: "#53626f"
  destructive: "#b81414"
  success: "#22c55e"
  warning: "#f59e0b"
  error: "#ff2424"
  info: "#3b82f6"
  approval: "#a855f7"
  paper: "#f0e9e5"
  paper-card: "#faf7f5"
  paper-ink: "#22223a"
typography:
  display:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: "2rem"
    letterSpacing: "normal"
  headline:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: "1.75rem"
  title:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: "1.75rem"
  body:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
  label:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.14em"
  plate:
    fontFamily: "Rajdhani, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: "1.75rem"
    letterSpacing: "0.08em"
  metric:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: "1.15"
    fontFeature: "tabular-nums"
rounded:
  none: "0"
  sm: "0.25rem"
  DEFAULT: "0.375rem"
  md: "0.5rem"
  lg: "0.75rem"
  xl: "1rem"
  card-mobile: "11px"
  full: "9999px"
spacing:
  card-padding: "1.25rem"
  page-padding: "1.5rem"
  card-mobile-x: "0.75rem"
  card-mobile-y: "0.625rem"
  sidebar: "240px"
  sidebar-compact: "64px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.DEFAULT}"
    padding: "8px 16px"
    height: "36px"
    typography: "{typography.body}"
  button-primary-hover:
    backgroundColor: "#9b23b9"
  button-outline:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.DEFAULT}"
    padding: "8px 16px"
    height: "36px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.DEFAULT}"
    height: "36px"
  input-default:
    backgroundColor: "{colors.surface-inset}"
    textColor: "{colors.ink}"
    rounded: "{rounded.DEFAULT}"
    padding: "4px 12px"
    height: "36px"
    typography: "{typography.body}"
  card-surface:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "{spacing.card-padding}"
  card-list-mobile:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card-mobile}"
    padding: "10px 12px"
  status-pill-tonal:
    rounded: "{rounded.full}"
    padding: "2px 8px"
    typography: "{typography.body}"
  status-chip-field:
    rounded: "{rounded.full}"
    padding: "2px 8px"
  kpi-cell:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    padding: "10px 12px"
    typography: "{typography.metric}"
---

# Design System: DS Car ERP

## Overview

**Creative North Star: "A Prancheta do Chefe de Oficina"**

O sistema não se comporta como um dashboard. Comporta-se como a prancheta de metal que o chefe de oficina carrega pelo pátio: uma superfície escura, dura e sem brilho, onde o que importa é o registro. Os dados vêm carbonados — números em mono tabular, alinhados em coluna, legíveis de relance e sem interpretação. As seções são separadas por uma etiqueta em maiúsculas monoespaçadas seguida de uma régua de 1px que atravessa a largura, exatamente como o cabeçalho impresso de um formulário de ofício. A faixa de cor de 3px na lateral do card de OS é a etiqueta de pasta: identifica a etapa antes de qualquer leitura.

A consequência é uma interface de ornamento zero. Não há gradiente decorativo, não há ilustração, não há sombra dramática, não há card dentro de card dentro de card. A profundidade vem de tom — `#0a0a0a` do fundo, `#121212` do card, `#242424` do campo de input — e não de elevação simulada. A hierarquia vem de peso tipográfico e de espaço, não de moldura. Quando uma superfície precisa se separar de outra, ela muda de tom ou ganha uma régua; quase nunca ganha uma borda em volta.

A cor é o recurso mais escasso do sistema e a regra que mais o define. O roxo Paddock aparece em uma fração pequena de qualquer tela: a ação primária, o número da OS, o item ativo do dock, o anel de foco. Todo o resto é escala de cinza. As cores semânticas — verde, âmbar, vermelho, azul — não decoram: elas reportam estado de uma OS, de um documento fiscal ou de um saldo. Uma tela onde a cor está espalhada é uma tela onde o sistema perdeu a capacidade de dizer o que é urgente.

**Key Characteristics:**
- Superfície escura por padrão (`dark` fixa no `<html>`); o tema claro existe e é secundário
- Profundidade por tom, nunca por sombra pesada
- Números sempre em mono tabular — dinheiro, quantidade, data, placa, número de OS
- Eyebrow monoespaçado + régua de 1px como único separador de seção
- Ornamento zero; densidade de formulário
- Cor de marca em ≤10% da tela; cor semântica só reporta estado
- Duas densidades legítimas: escritório denso, campo folgado

## Colors

Uma escala de cinzas quase neutros carrega tudo, e um único roxo elétrico carrega a ação. As cores semânticas são um vocabulário fechado de estado, não uma paleta decorativa.

### Primary

- **Roxo Paddock** (`#ac27ce`, `hsl(288 68% 48%)`): a única cor de marca. Aparece na ação primária (`Nova OS`), no número da OS (`#9999`), no item ativo do dock, no anel de foco e no estado ativo de filtro. É o token `--primary` e a fonte de verdade.
- **Roxo Paddock Profundo** (`#7a298e`, `hsl(288 55% 36%)`): a mesma cor no tema claro, escurecida para manter contraste sobre papel.

**Nota de proveniência:** o roxo é a marca da Paddock Solutions, não da DS Car. Ele é normativo hoje porque é o que roda em produção e o que a operação já reconhece. Se a DS Car definir cor própria, esta é a linha que muda — e ela muda em um lugar só.

### Neutral

- **Piche** (`#0a0a0a`): fundo da aplicação. O plano mais fundo; nada fica atrás dele.
- **Chapa** (`#121212`): superfície de card, célula de KPI, linha de tabela. O tom em que a informação vive.
- **Chapa Erguida** (`#141414`): popover, dropdown, dock, sidebar. Um passo acima do card, o suficiente para ler como sobreposto.
- **Rebaixo** (`#242424`): fundo de input, de superfície secundária e de estado mudo. Um passo *abaixo* do card — o campo é um sulco, não uma saliência.
- **Giz** (`#f2f2f2`): texto principal.
- **Grafite** (`#8c8c8c`): texto secundário, label de campo, unidade, período. Nunca carrega informação que o usuário precise ler sob sol.
- **Régua** (`#2e2e2e`): borda, divisor, régua de seção, vão de 1px da régua de KPI.
- **Aço Escovado** (`#53626f`, `hsl(207 14% 38%)`): o `--accent` do tema escuro. Cinza levemente azulado, de alumínio. Uso decorativo mínimo.

### Semantic

- **Verde Motor** (`#22c55e`): concluído, autorizado, quitado, saldo positivo.
- **Âmbar** (`#f59e0b`): aguardando, pendente, atenção, prazo apertado.
- **Vermelho Alerta** (`#ff2424`): erro, rejeição, atraso, inadimplência. Distinto do `--destructive` (`#b81414`), que é a cor de ação destrutiva de botão.
- **Azul Diagnóstico** (`#3b82f6`): informativo, importado, fase administrativa.
- **Roxo Aprovação** (`#a855f7`): aprovação pendente, OWNER, ordem de compra pendente, peça recondicionada. É a quinta categoria — pinada por ser temável, e **fechada**: novo estado semântico usa success/warning/error/info, nunca esta.

### Paper (tema claro)

- **Papel** (`#f0e9e5`): fundo do tema claro.
- **Papel Card** (`#faf7f5`): superfície de card no claro.
- **Tinta Ferrogálica** (`#22223a`): texto no claro. Azul-quase-preto, não preto puro.

### Named Rules

**A Regra dos 10%.** O roxo Paddock ocupa no máximo 10% de qualquer tela. Ele marca a ação primária, o identificador da OS e o foco — nada mais. Sua raridade é o mecanismo: quando tudo é roxo, nada é a próxima ação.

**A Regra do Estado.** Cor semântica reporta estado de um objeto de negócio (OS, documento fiscal, conta, saldo). Ela nunca é escolhida por estética, por variedade ou para "dar vida" a uma seção. Um card colorido sem estado por trás é um defeito.

**A Regra do Sulco.** Superfícies interativas de entrada são mais escuras que o card que as contém (`#242424` dentro de `#121212`), nunca mais claras. Input é sulco, não saliência.

**A Regra dos Dois Territórios.** O produto tem **duas** cores de marca, separadas por território, e a separação é deliberada:

- **Workspace autenticado** (`(app)/`) — Roxo Paddock (`--primary: 288 68% 48%`). É o padrão global definido em `globals.css`.
- **Superfície de autenticação** (`(auth)/`) — Vermelho DS Car (`#c31313`, `hsl(0 82% 42%)`), aplicado por override inline de `--primary` em `login/page.tsx`. O login é a única tela que o cliente vê antes de entrar, e ela veste a marca da DS Car, não a da software house.

Consequência prática: `bg-primary` é correto nos dois territórios — ele resolve para a cor certa de cada um. Nunca chumbe o hexadecimal.

**A Regra da Escala Órfã.** A escala `primary-50…950` do `tailwind.config.ts` é vermelha e **não** acompanha `--primary` em nenhum dos dois territórios (nem o roxo do workspace, nem o `#c31313` do login). Não use `primary-500`, `primary-600` etc. esperando a cor de marca. Para vermelho semântico use `error-*`; para a cor de marca use `bg-primary` / `text-primary`.

## Typography

**Display / Body Font:** Montserrat (com `ui-sans-serif`, `system-ui`, `sans-serif`)
**Plate Font:** Rajdhani (com `ui-sans-serif`, `system-ui`, `sans-serif`) — pesos 600 e 700
**Label / Metric Font:** `ui-monospace`, `SFMono-Regular`, `Menlo`, `monospace` (mono do sistema, sem webfont)

**Character:** Montserrat é geométrica e neutra — não tem opinião, o que é exatamente o que uma tela densa de ERP precisa. Rajdhani é condensada e técnica, e existe para um trabalho só: placa de veículo e identificador. O mono do sistema carrega todo número e todo label de campo, e é o que dá ao sistema a leitura de instrumento em vez de aplicativo.

**Aviso:** `--font-inter` está declarado em `globals.css` e comentado no `tailwind.config.ts` como "sans-serif principal", mas Inter **não é carregada** em `layout.tsx`. É um token fantasma. Não escreva CSS contra ele.

### Hierarchy

- **Display** (700, 24px / 2rem): título de página. Uma única ocorrência por tela.
- **Headline** (600, 20px / 1.75rem): título de seção dentro de uma página.
- **Title** (600, 18px / 1.75rem): título de card.
- **Body** (400, 14px / 1.25rem): corpo padrão do ERP. É o `sm` da escala — 14px, não 16px. A densidade de formulário é deliberada.
- **Label** (mono, 10px, tracking `0.14em`, uppercase, cor Grafite): eyebrow de seção, label de campo, unidade. A classe `.label-mono`.
- **Métrica** (mono, 17px, 600, `tabular-nums`): valor de KPI, dinheiro, quantidade.
- **KPI grande** (30px / 1.875rem): métrica de destaque no dashboard.
- **Plate** (Rajdhani 700, 22px, tracking `0.08em`): placa de veículo, via `.text-plate` ou `[data-plate]`.
- **Número de OS** (Rajdhani 600, 14px, tracking `0.04em`, cor Roxo Paddock): via `.text-os-number`.

### Named Rules

**A Regra do Número Tabular.** Todo número que o usuário compara entre linhas — dinheiro, quantidade, data, hora, placa, número de OS — usa fonte mono com `tabular-nums`. Números que dançam de linha para linha são ilegíveis em varredura vertical, e varredura vertical é como este produto é lido.

**A Regra da Placa.** Placa de veículo é sempre Rajdhani 700 com tracking `0.08em`. É o identificador que o pátio usa para falar; ela precisa ser reconhecível de longe e nunca deve se dissolver no corpo do texto.

**A Regra do Eyebrow Nu.** Seção se organiza com um eyebrow mono maiúsculo seguido de régua de 1px (`.section-divider` / `SectionLabel`) — não com um card em volta. Um card custa 2 bordas, 1 sombra e ~40px de altura para comunicar o que uma linha de 10px comunica melhor.

## Layout

O shell é uma **dock flutuante inferior**, não um sidebar. No desktop a dock é uma barra de ícones centralizada e flutuante sobre o conteúdo; no mobile é uma tab bar rotulada de 5 itens com o quinto sendo `Mais`. O conteúdo ocupa a largura toda, com `page-padding` de `1.5rem` no desktop.

**Aviso de deriva:** os tokens `sidebar` (240px), `sidebar-compact` (64px) e os grids `app-layout` / `app-layout-compact` continuam no `tailwind.config.ts`, mas o layout renderizado não usa sidebar. São tokens órfãos de uma arquitetura anterior. Não construa contra eles.

**Densidade e ritmo.** Escritório é denso: `card-padding` de `1.25rem`, tabela de linhas curtas, KPI em régua contínua. Campo é folgado: gutter total de ~8–10px (layout `px-2`, páginas `px-0` no mobile), `space-y-2` entre cards, padding interno de card `px-3 py-2.5`.

**Comportamento responsivo — viewport de referência 390px.** As regras abaixo são invariantes do sistema, não sugestões:

- Tabela operacional vira **cards** no mobile: tabela em `hidden md:block`, cards em `md:hidden space-y-3`. Tabela que ainda não virou cards fica em wrapper `ScrollFade`.
- **`overflow-hidden` em wrapper de tabela é proibido** — corta dado sem avisar.
- KPI: `grid grid-cols-2 gap-3 lg:grid-cols-4`. Nunca `grid-cols-3` ou `grid-cols-4` fixo.
- Header de página: `flex flex-wrap gap-y-2`, título com `min-w-0`, botões com `flex-wrap`.
- Toolbar e filtros: `flex flex-wrap gap-2`, inputs `min-w-0 flex-1`. Nunca somar larguras fixas acima de 390px.
- Dialog: `flex max-h-[90dvh] flex-col` com conteúdo `min-h-0 flex-1`.
- Kanban: `repeat(auto-fill, minmax(280px, 1fr))`, com scroll lateral próprio.

### Named Rules

**A Regra do Scroll Único.** A página nunca rola horizontalmente (`main` é `overflow-x-hidden`). Scroll lateral existe apenas em containers que o declaram: Kanban, `ScrollFade`, tab bar com fade. Uma página que sangra para o lado no mobile é um bug, não uma escolha de layout.

**A Regra do Rodapé em Grade.** Linha de dados no rodapé de card de lista usa grade de colunas fixas (`grid-cols-[minmax(0,1fr)_96px_44px]`, texto trunca, valor alinhado à direita). **`justify-between` é proibido** ali: os valores flutuam conforme o comprimento do vizinho e a coluna deixa de existir na varredura vertical.

## Elevation & Depth

O sistema é **tonal, não elevado**. A profundidade vem de trocar o tom da superfície — Piche → Chapa → Chapa Erguida — e não de projetar sombra. As sombras existem, são discretas e sempre funcionais: elas marcam o que flutua de verdade (dropdown, dock, drawer, card sendo arrastado), nunca o que está apenas presente.

No tema escuro a sombra é quase invisível por natureza; é o tom que faz o trabalho. As sombras do `tailwind.config.ts` foram desenhadas para o tema claro e continuam corretas lá.

### Shadow Vocabulary

- **card** (`0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px -1px rgba(0,0,0,0.05)`): repouso de card. Praticamente imperceptível no escuro — é o piso, não um efeito.
- **card-hover** (`0 4px 12px 0 rgba(0,0,0,0.12), 0 2px 4px -2px rgba(0,0,0,0.08)`): resposta a hover em card clicável.
- **dropdown** (`0 8px 24px -4px rgba(0,0,0,0.14), 0 4px 8px -4px rgba(0,0,0,0.10)`): menu e popover — coisas que realmente sobrepõem.
- **sidebar** (`4px 0 16px 0 rgba(0,0,0,0.18)`): overlay de navegação no mobile.
- **kanban** (`0 2px 8px 0 rgba(0,0,0,0.10)`) e **kanban-drag** (`0 8px 24px 0 rgba(0,0,0,0.20)`): card do board em repouso e sendo arrastado. O salto entre os dois é a única sombra dramática do sistema, e ela comunica "isto está na sua mão".

### Named Rules

**A Regra do Tom Antes da Sombra.** Para separar duas superfícies, mude o tom primeiro. Só recorra à sombra quando o elemento genuinamente flutua sobre o conteúdo e pode ser fechado. Sombra em elemento que não fecha é decoração.

## Shapes

Cantos moderados e consistentes, sem nenhuma curva expressiva. O raio comunica função, não personalidade:

- **0.25rem (4px)** — input interno, elementos aninhados
- **0.375rem (6px)** — botão. O `DEFAULT`.
- **0.5rem (8px)** — card, superfície de conteúdo
- **0.75rem (12px)** — modal, drawer, sheet
- **1rem (16px)** — badge grande, régua de KPI
- **11px** — card de lista no mobile (valor específico, deliberadamente entre 8 e 12)
- **9999px** — pill de status e chip. **Apenas** pill de status e chip.

Bordas são de 1px na cor Régua (`#2e2e2e`) e existem para delimitar, não para enfeitar. A exceção é o botão `outline`, que usa 2px em `foreground/20` para ganhar presença como ação secundária real.

**A faixa de status** é a forma-assinatura do sistema: uma barra vertical de 3px (mobile) ou `border-l-4` (desktop) na aresta esquerda do card, colorida pelo estado da OS. Ela identifica a etapa antes de qualquer texto ser lido.

### Named Rules

**A Regra do Pill Reservado.** `rounded-full` é exclusivo de pill de status e chip. Botão, card e input nunca são totalmente arredondados. O formato de cápsula é o sinal de "isto é um estado, não um controle".

**A Regra do Card sem Moldura no Mobile.** Card de lista no mobile não tem borda — separa-se do fundo por tom, raio de 11px e a faixa de status de 3px. Borda em card de lista mobile rouba largura que é escassa a 390px.

## Components

### Buttons

- **Shape:** cantos suaves (`0.375rem`), altura padrão 36px (`h-9`), `px-4`. Compacto `h-8 px-3 text-xs`; grande `h-10 px-6`; ícone `h-9 w-9`.
- **Primary:** fundo Roxo Paddock com borda da mesma cor e texto branco. Hover `bg-primary/90`, active `bg-primary/80`.
- **Destructive:** `bg-error-600` com borda `error-700` — o vermelho de alerta, não o `--destructive` do tema.
- **Outline:** borda de 2px em `foreground/20` sobre fundo de card. É a ação secundária de verdade; ganha peso pela borda, não por cor.
- **Ghost:** sem fundo, texto em `foreground/70`. Ação terciária, para barra de ferramentas densa.
- **Estados:** todo botão faz `active:scale-[0.98]` — a única resposta tátil do sistema. Foco é `ring-2 ring-ring ring-offset-2` em Roxo Paddock. `disabled` é `opacity-50` com ponteiro desligado.
- **Acessibilidade embutida:** botão de ícone deriva `aria-label` do `title` automaticamente.

### Inputs / Fields

- **Style:** altura 36px, fundo Rebaixo (`bg-muted/50`), borda Régua, raio `0.375rem`, texto 14px. Placeholder em `muted-foreground/50`.
- **Focus:** `ring-2` em Roxo Paddock, sem deslocamento de borda.
- **Error:** `aria-[invalid=true]` pinta a borda de `error-500` e adiciona halo `ring-error-500/20`. O estado de erro é dirigido por atributo ARIA, não por classe — a semântica e o visual não podem divergir.

### Cards / Containers

- **Desktop:** raio `0.5rem`, borda Régua de 1px, fundo Chapa, sombra `card`. Padding interno de `1.5rem` no header/content (`p-6`).
- **Mobile (lista):** sem borda, raio 11px, faixa de status de 3px à esquerda, padding `px-3 py-2.5`, status como **texto colorido** e não como pill.

### Status — dois dialetos, por contexto

O sistema mantém **duas** expressões de status. Elas não são um acidente a corrigir; são a resposta às duas condições físicas de uso. A regra de escolha é obrigatória:

- **Tonal alpha** (`bg-<sem>-500/10` + `text-<sem>-400` + `border-<sem>-500/20`) — o padrão para **superfície de escritório**: tela densa, sessão longa, luz controlada. Integra-se ao workspace escuro e lê como estado. É o `StatusPill` e o dialeto de contagens, unidades e `KpiStrip`.
- **Chip opaco** (`bg-<sem>-100` + `text-<sem>-800` + `border-<sem>-200`) — o padrão para **superfície de campo**: consultado sob luz direta, de relance, possivelmente com o veículo esperando. Chapado e brilhante porque contraste sob sol é requisito operacional. É o dialeto do `SERVICE_ORDER_STATUS_CONFIG` e dos status fiscais.

**Nunca misture os dois na mesma superfície.** Uma tela escolhe seu dialeto pela condição de uso e o mantém do topo ao rodapé.

### StatusBadge (componente-assinatura)

O único componente que consome `SERVICE_ORDER_STATUS_CONFIG` — a fonte de verdade única das cores dos 17 status. Duas variantes:

- **`default`** — pill com o `badge` do config, opcional com ponto colorido.
- **`dot`** — ponto de 6px pulsando (`animate-pulse-slow`, 4s) + label em `.label-mono`, sem fundo. É a forma mais discreta e a preferida em tabela densa.

Os 17 status são agrupados por família de matiz, e o agrupamento é semântico: **azul/sky** para fases administrativas (recepção, vistoria inicial, orçamento), **âmbar** para espera (autorização, peças), **esmeralda** para autorizada, **vermelho/laranja** para trabalho ativo (reparo, mecânica), **roxo/violeta/índigo** para especializado (funilaria, pintura, montagem), **amarelo/ciano** para acabamento (polimento, lavagem), **teal/verde** para saída (vistoria final, pronto, entregue) e **neutro** para cancelada. Um status novo entra na família da sua fase; nunca escolhe cor livre.

### KpiStrip (componente-assinatura)

Régua contínua de KPIs: grade com `gap-px` sobre fundo Régua, o que produz divisores de exatamente 1px sem desenhar borda nenhuma. Cada célula tem pastilha de ícone de 26px com raio `0.5rem`, label de 11px em Grafite (com período opcional após um `·`) e valor em mono 17px `tabular-nums`. `grid-cols-2` no mobile, `md:grid-cols-4`.

### Navigation

Dock flutuante. No desktop, barra de ícones centralizada na base, item ativo em Roxo Paddock com pastilha. No mobile, tab bar de 5 itens com ícone e rótulo — **rótulo sempre visível**, nunca só ícone. Sub-rotas dentro de Stacks escondem a barra.

### Section Divider

`.section-divider` e `SectionLabel`: eyebrow mono maiúsculo com tracking `0.14em` seguido de uma régua de 1px que ocupa o resto da largura via `::after { flex: 1 }`. É o separador estrutural padrão do sistema e substitui o card em quase todos os casos.

### Motion

Vocabulário deliberadamente pequeno e rápido:

- `card-in` (250ms `ease-out`, translateY 8px) com stagger de 40ms nos 5 primeiros cards da lista mobile, saturando em 200ms a partir do 6º.
- `section-in` (150ms, translateY 4px) na troca de seção do workspace.
- `slide-in-left` (200ms) para drawer, `fade-in` (150ms) genérico.
- `pulse-slow` (4s) no ponto de status; `pulse-red` (1.5s) para alerta ativo.
- Durações nomeadas: `fast` 100ms, `normal` 200ms, `slow` 300ms.

**`prefers-reduced-motion: reduce` está implementado** e degrada `card-in` e `section-in` para fade puro de 150ms. Toda animação nova deve ter esse caminho.

## Do's and Don'ts

### Do:

- **Do** usar `--primary` / `bg-primary` para a cor de marca. É a única fonte de verdade do roxo (`#ac27ce`).
- **Do** separar seções com `SectionLabel` ou `.section-divider` antes de considerar um card.
- **Do** aplicar `font-mono tabular-nums` em todo valor comparável entre linhas: dinheiro, quantidade, data, hora, placa, número de OS.
- **Do** criar superfície por tom (`#0a0a0a` → `#121212` → `#141414`) e deixar input mais escuro que o card que o contém.
- **Do** escolher o dialeto de status pela condição de uso da tela — tonal alpha no escritório, chip opaco no campo — e mantê-lo consistente na tela inteira.
- **Do** consumir `SERVICE_ORDER_STATUS_CONFIG` via `StatusBadge` para qualquer status de OS. É a fonte única.
- **Do** testar toda tela nova a 390px antes de mergear, com a tabela já convertida em cards.
- **Do** usar `aria-[invalid=true]` para estado de erro em input, para que semântica e visual não possam divergir.
- **Do** dar caminho de `prefers-reduced-motion` para qualquer animação nova.

### Don't:

- **Don't** usar `primary-500`, `primary-600` ou qualquer degrau da escala `primary-*` esperando a cor de marca. Eles são **vermelhos**, legado de uma direção abandonada, e não têm relação com `--primary`.
- **Don't** escrever CSS contra `--font-inter`. Inter não é carregada; só existem Montserrat e Rajdhani.
- **Don't** construir contra os tokens `sidebar`, `sidebar-compact`, `app-layout` ou `app-layout-compact`. O shell é uma dock flutuante; esses tokens são órfãos.
- **Don't** usar `bg-blue-*`, `bg-amber-*`, `bg-green-*` diretamente quando existe token semântico (`info`, `warning`, `success`). A exceção viva é `SERVICE_ORDER_STATUS_CONFIG`, que usa a paleta Tailwind por precisar de 17 matizes distinguíveis.
- **Don't** aplicar `rounded-full` em botão, card ou input. Cápsula é exclusiva de pill de status e chip.
- **Don't** usar `justify-between` em linha de dados de card de lista. Use grade de colunas fixas.
- **Don't** colocar `overflow-hidden` em wrapper de tabela. Use `ScrollFade`.
- **Don't** aninhar card dentro de card dentro de card. Se a hierarquia precisa de três níveis de moldura, a hierarquia está errada.
- **Don't** adicionar sombra a elemento que não flutua e não pode ser fechado.
- **Don't** usar cor semântica por variedade visual. Se não há estado de negócio por trás, é cinza.
- **Don't** introduzir novo estado semântico em `purple`. Essa categoria está fechada; use success/warning/error/info.
