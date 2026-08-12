---
target: OS 9999 — tela de detalhe da Ordem de Serviço
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
timestamp: 2026-08-10T21-52-08Z
slug: apps-dscar-web-src-app-app-os-numero-page-tsx
---
⚠️ DEGRADED: single-context (sub-agentes A e B ficaram idle sem entregar em duas rodadas; detector determinístico indisponível — scan de arquivo não parseia JSX, scan por URL exige puppeteer não instalado)

## Design Health Score

| # | Heurística | Score | Questão central |
|---|---|---|---|
| 1 | Visibilidade do status | 3 | Trilha de marcos truncada ("Fin…") sem affordance de scroll |
| 2 | Sistema ↔ mundo real | 4 | Exemplar. Vocabulário exato do ofício, zero jargão vazando |
| 3 | Controle e liberdade | 2 | Sem undo em transição de status; botão "Clássica" denuncia falta de confiança |
| 4 | Consistência e padrões | 2 | Duas implementações coexistem; 10 grids fixos violam regra do projeto |
| 5 | Prevenção de erro | 3 | "Registrar Entrega" desabilitado com motivo; transições validadas em dupla |
| 6 | Reconhecer > lembrar | 2 | Fechamento manda o usuário a outra aba para saber o que o bloqueia |
| 7 | Flexibilidade e eficiência | 2 | ⌘K existe; sem ações em lote, sem teclado nas abas |
| 8 | Estético e minimalista | 2 | Cabeçalho come 29% do viewport de campo; rótulos duplicados |
| 9 | Recuperação de erro | 2 | Banner nomeia o problema mas terceiriza a localização |
| 10 | Ajuda e documentação | 1 | Nenhuma ajuda contextual em tela com 17 estados e 3 regimes fiscais |
| **Total** | | **23/40** | **Aceitável** |

## Veredito de especificidade

Autoral, não intercambiável. Trilha de marcos com etapas físicas reais, placa em Rajdhani, fornecimento por peça, vocabulário exato. Heurística 2 = 4 é o ponto mais forte do produto.
Intercambiável: o chassi abas + cards + formulário — e é aí que quebra no pátio.

## Deterministic scan

INDISPONÍVEL. `detect.mjs --json "apps/dscar-web/src/app/(app)/os"` → `[]`, exit 0 (não parseia JSX).
`detect.mjs --json --viewport 390x844 http://localhost:3000/os/9999` → "puppeteer is required for URL scanning".
Sem overlay no browser: injeção nunca foi tentada com sucesso.

## Auditoria estática (grep contra as regras do próprio CLAUDE.md)

- grid-cols-3/4 fixo sem base responsiva — 10 hits: _v2/OverviewSection.tsx:180, sections/EntrySection.tsx:31, sections/VehicleSection.tsx:135, sections/InsurerSection.tsx:87,112,135, vistoria/page.tsx:120, _components/ImportReconcileModal.tsx:213, [numero]/loading.tsx:25, shared/VehicleHistorySheet.tsx:68
- Dialog sem max-h-[90dvh] — 5 hits: ImportReconcileModal, BillingModal, ImportBudgetModal, tabs/FilesTab, ClosingTab/DeliveryConfirmationDialog
- <table> sem contrapartida md:hidden nem ScrollFade — 1 hit: ImportReconcileModal.tsx
- onClick em div/span sem role+tabIndex — sem hits
- botão só-ícone sem aria-label/title — sem hits (Button deriva aria-label do title)
- largura fixa > 340px — 1 hit, falso positivo (w-full max-w-[420px])

## O que está funcionando

1. A trilha de marcos traduz 17 estados de banco em uma linha lida em um segundo.
2. "Registrar Entrega" desabilitado com motivo em vez de habilitado-e-depois-erro.
3. KPIs de Peças em grid-cols-2 com mono tabular seguem o design system à risca.

## Problemas prioritários

[P0] Tabela de Peças não vira cards a 390px — coluna de valor fatiada fora da tela.
Evidência: os9999-pecas-1.png. Viola o padrão-ouro do próprio projeto. Esconde o dado que decide a conversa com a seguradora.
Fix: converter para cards seguindo financeiro/contas-pagar, rodapé em grade de colunas fixas. → /impeccable adapt

[P1] Banner de fechamento vira coluna de uma palavra por linha.
Evidência: os9999-fechamento-1.png. Seis linhas para uma frase porque o botão reserva largura fixa. Tela mais consequente da OS, lida sob sol com veículo esperando.
Fix: empilhar a 390px (flex-col), texto em largura cheia, botão full-width abaixo. → /impeccable adapt

[P1] Ponte de memória do fechamento. "Resolva as pendências listadas na Visão Geral (NF, assinatura, KM)" força troca de aba + memorizar 3 itens. Chip "4 pendências" não é clicável.
Fix: listar pendências no próprio banner com link direto para cada uma. → /impeccable clarify

[P1] Cabeçalho persistente consome 29% do viewport de campo (~245px de 844px) repetido em toda aba.
Fix: colapsar breadcrumb e bloco cliente/veículo no scroll. → /impeccable layout

[P2] Duas implementações da mesma tela expostas ao usuário (_v2/OSWorkspaceV2.tsx e classic/page.tsx + botão "Clássica").
Fix: decidir e deletar a perdedora. → /impeccable distill

## Carga cognitiva: 4 falhas de 8 — alta, correção crítica

FALHA foco único (cabeçalho/trilha/abas/banner competem)
OK agrupamento em blocos
OK agrupamento visual
FALHA hierarquia visual (título, chip, pendências e "Clássica" com peso quase igual a 390px)
OK uma coisa por vez
FALHA escolhas ≤4 (7 abas)
FALHA memória de trabalho (ponte Fechamento → Visão Geral)
OK divulgação progressiva

## Bandeiras vermelhas por persona

Chefe de oficina (pátio, 390px, sol, luva, veículo esperando): tabela de peças fatia o valor; banner de fechamento em coluna de uma palavra; rótulo #8c8c8c sobre #0a0a0a é o primeiro texto a sumir sob sol, e é onde vivem ENTRADA / PREVISÃO DE ENTREGA / RETIRADA. Ele vai resolver pelo WhatsApp.

Alex (power user): 7 abas sem atalho de teclado; nenhuma ação em lote em peças/serviços; 5 modais sem max-h-[90dvh].

Sam (acessibilidade): Button derivando aria-label do title é acerto real. Mas a trilha comunica etapa por cor + posição sem texto de estado para leitor de tela; 10 grids fixos quebram sob zoom 200%.

## Observações menores

- Título de card e eyebrow repetem a mesma palavra a 40px (Atendimento/ATENDIMENTO*, Cliente/DADOS DO CLIENTE)
- Trilha de marcos trunca sem fade — sem sinal de que há mais à direita
- Em Prazos, três "—" seguidos parecem erro de carregamento, não "ainda não definido"

## Perguntas

- E se o Fechamento FOSSE a lista de pendências, em vez de apontar para ela?
- As 7 abas são 7 tarefas ou 7 tabelas do banco vestidas de aba?
- Qual é a versão desta tela que o chefe resolve com o polegar, de luva, em 15 segundos?

---

## CORREÇÃO PÓS-VERIFICAÇÃO (mesma sessão)

Os screenshots usados como evidência são de **13/07/2026**; `ClosingTab.tsx` e `OSWorkspaceV2.tsx`
foram alterados em **06/08/2026**. Três achados foram derrubados ao verificar contra o código atual:

- **RETIRADO** — "banner de fechamento vira coluna de uma palavra": o código já tem
  `flex-col ... sm:flex-row` (ClosingTab.tsx:149). Consertado antes desta crítica.
- **RETIRADO** — "trilha de marcos trunca sem fade": `ScrollFade` renderiza gradiente à direita
  (`scroll-fade.tsx`, `md:hidden`). Já existia.
- **CORRIGIDO** — o chip "N pendências" **é** clicável (OSWorkspaceV2.tsx:142, navega para overview).
  O defeito real é que não parece clicável e leva à aba inteira, não ao bloqueio específico.
- **CORRIGIDO** — a nav tem **8** seções, não 7 (OSWorkspaceV2.tsx:67-76).

Dos 10 hits de `grid-cols-3/4`, **4 não são defeitos**: grids de miniatura de foto
(OverviewSection.tsx:180, vistoria/page.tsx:120) e dois skeletons de carregamento.

### Consertado nesta sessão

- PartsTab: tabela de 8 colunas agora `hidden md:block` + lista de cards `md:hidden` (P0)
- ClosingTab: banner lista os `hard_blocks` reais inline em vez de apontar para outra aba (P1)
- 6 grids de campo de formulário responsivos (InsurerSection ×3, VehicleSection, EntrySection, ImportReconcileModal)
- Dialogs: 3× `vh`→`dvh`; DeliveryConfirmationDialog e FilesTab ganharam `max-h-[90dvh]` + corpo `min-h-0 flex-1`; lightbox `75vh`→`75dvh`
- DadosWorkspace: rótulo duplicado "Atendimento *" → "Tipo de cliente *"

### Continua aberto (exige decisão, não conserto mecânico)

- Dualidade `_v2/` vs `classic/` — deletar rota que serve de rede de segurança é destrutivo
- 8 seções de nav — redesenho de arquitetura de informação
- Nenhuma das mudanças foi verificada renderizada em browser (auth bloqueou)
