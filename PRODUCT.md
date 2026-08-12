# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Cinco perfis operam o sistema dentro de uma única oficina — DS Car Centro Automotivo, Manaus/AM. Todos são **confortáveis com apps**: usam WhatsApp e apps de banco sem atrito e suportam densidade e padrões modernos sem tutorial. O gargalo do design nunca é alfabetização digital; é a condição física de uso.

- **Consultor** (3–5 ativos) — atende na recepção. Abre OS, conduz vistoria inicial, acompanha o Kanban, comunica o cliente. Trabalha majoritariamente sentado, em tela grande.
- **Chefe de oficina** (1–2) — coordena a equipe de pátio e é a persona central da operação em campo. Aponta execução (quem fez cada etapa), anexa fotos com marca d'água, conduz vistorias, coleta assinatura digital do cliente. Alterna entre tablet apoiado em área coberta e celular na mão a céu aberto.
- **Equipe de pátio** (~20–25) — mecânicos, funileiros, pintores, polidores, lavadores. **Não logam no sistema no MVP.** São apontados pelo chefe de oficina. Aparecem no produto como dado, não como usuário.
- **Administrativo / financeiro** (1–2) — emite NF-e, NFS-e e NFC-e, registra recebimentos, marca OS como faturada e quitada. Trabalho de escritório, tela grande, alta densidade tolerada.
- **Compras / estoque** (2–3) — cadastra peças (XML de NF-e ou recibo manual), reserva peças para OS, aciona compra sob demanda. Alterna entre escritório e armazém.

## Product Purpose

ERP vertical de centro automotivo que substitui integralmente o sistema legado (Box Empresa) da DS Car. Cobre o ciclo completo de uma Ordem de Serviço: entrada do veículo, vistoria, orçamento, autorização, compra e reserva de peças, execução no pátio com evidência fotográfica, vistoria final, entrega, emissão fiscal e quitação.

**Definição de sucesso, literal e única:** DS Car opera 100% no novo sistema, com todas as notas fiscais emitidas pelo ERP, e o legado é desligado.

## Positioning

O que um ERP automotivo vizinho não copiaria de verdade:

- **A OS só fecha com três condições simultâneas** — entregue, faturada e quitada. Não é um status; é um invariante que atravessa operação, fiscal e financeiro.
- **`fornecimento` é atributo do item de peça, não da OS.** O sistema decide o destinatário da NF-e peça a peça (oficina que compra e revende vs. seguradora que intermedeia). Isso permite uma única OS gerar NF-e para a seguradora, NFS-e de serviço e NFC-e de franquia para o segurado PF.
- **Evidência fotográfica é imutável por design.** Fotos de OS são prova para seguradora — marca d'água (data + número da OS) aplicada no device antes do upload, e apenas soft delete.
- **Importação automática de sinistros via Cilia**, criando OS já em `waiting_auth` e sincronizando a autorização da seguradora.
- **17 status que espelham etapas físicas reais** do pátio (funilaria, pintura, montagem, polimento, lavagem), não um pipeline genérico de 4 colunas.

## Operating Context

A operação atravessa três cenários físicos distintos, **todos confirmados como reais e simultâneos**:

- **Pátio a céu aberto, sol de Manaus.** Luz direta forte, tela lavada. Contraste precisa ser real e medido, não cinza elegante. Superfícies de baixo contraste que funcionam no monitor do escritório desaparecem no pátio.
- **Mãos ocupadas, sujas ou com luva.** Alvos de toque grandes, poucos toques por tarefa, nenhuma precisão fina. Não há hover; não há gesto delicado.
- **Sob pressa, veículo esperando.** O fluxo precisa fechar em segundos, não em navegação. Interrupção é a norma, não a exceção — estado parcial precisa sobreviver.
- **Área coberta, tablet apoiado.** Condição controlada onde vistorias longas, checklists e coleta de assinatura acontecem com estabilidade.

Escritório (consultor, administrativo, compras) é o cenário oposto: sentado, tela grande, sessão longa, densidade alta bem-vinda. **O produto legitimamente carrega duas densidades** — não porque os usuários diferem em habilidade, mas porque as condições físicas diferem.

Fluxos, documentos e rituais factuais do uso: Ordem de Serviço como unidade central; Kanban de 17 status avançado etapa a etapa pelo chefe conforme execução real; quatro momentos de registro (vistoria inicial, checklist de entrada, apontamento durante o pátio, vistoria final); assinatura do cliente em canvas no tablet ou via link remoto; entrada de peças por XML de NF-e ou manual; localização física hierárquica no armazém (Armazém → Rua → Prateleira → Nível); emissão fiscal decidida pelo administrativo em qualquer momento após a entrega.

## Capabilities and Constraints

**Plataforma confirmada: apenas web — desktop e PWA.** O app React Native em `apps/mobile/` está pausado; o caminho para campo é o próprio `apps/dscar-web` responsivo instalado como PWA. Não há linguagem de design nativa iOS/Android a honrar. Viewport de referência para campo: 390px.

Capacidades confirmadas em produto:

- OS criada por três caminhos: sinistro de seguradora (Cilia), orçamento particular, cadastro direto.
- 17 status com transições validadas em dupla — client-side (`VALID_TRANSITIONS` em `packages/types/`) e backend.
- Histórico imutável de mudanças de status e de alterações em campos.
- WMS completo: reserva de peça por OS com `select_for_update`, saldo nunca negativo (CHECK constraint), movimentação imutável e auditável, contagem cíclica e total.
- Pedido de Compra → Ordem de Compra com aprovação MANAGER+.
- Emissão de NF-e (modelo 55), NFS-e Manaus (LC116, IBGE 1302603) e NFC-e (modelo 65) via Focus NF-e.
- Operação offline com sync nas vistorias.
- RBAC de 5 níveis: OWNER > ADMIN > MANAGER > CONSULTANT > STOREKEEPER.

Restrições duráveis:

- **LGPD:** CPF, e-mail e telefone em `EncryptedField`; lookup por `email_hash` (SHA-256); hard delete proibido — anonimização; nunca PII em log ou no body logado pelo proxy Next.js.
- **Escala real:** ~30 usuários simultâneos, ~10.000 OS e ~7.000 clientes migrados do legado. Paginação de 20 itens. Busca por placa ou número de OS abaixo de 1s.
- **Fiscal é inegociável:** razão social exata `D S CAR CENTRO AUTOMOTIVO LTDA`, regime normal (3), timezone `America/Manaus` em toda emissão.
- Scroll horizontal de página é proibido; scroll lateral só em containers explícitos (Kanban, ScrollFade, tab bars com fade).
- Módulos construídos mas **fora do MVP**, mantidos inativos e não deletáveis: motor de precificação, inbox omnichannel, lojas, hub SSO, RH completo, financeiro avançado (DRE, balanço, fluxo de caixa), benchmark IA. Critério de reativação: MVP validado em produção + pedido explícito do cliente.

Vocabulário do domínio que a interface deve preservar literalmente: **OS**, **OS fechada** (entregue + faturada + quitada), **fornecimento** (oficina ou seguradora), **vistoria**, **checklist**, **apontamento**, **franquia**, **Cilia**, **WMS**.

## Brand Commitments

- **Cliente:** DS Car Centro Automotivo, Manaus/AM. **Fornecedor:** Paddock Solutions (software house, fundador solo).
- Nome do produto na interface: DS Car ERP.
- Idioma da interface: português do Brasil. Termos do domínio em português, nunca traduzidos para o inglês da modelagem (`service_orders` é o model; **OS** é a palavra na tela).
- Existe um artefato de sistema visual em `design_system/design-system.html` e um conjunto extenso de screenshots da interface atual na raiz do repositório. **Ainda não confirmado como autoridade vinculante** — a decisão de preservar, expandir ou substituir esse mundo visual não foi tomada e não pertence a este documento.

## Evidence on Hand

- `docs/PRD.md` — PRD v2.0, 2026-05-04: personas, fluxos, requisitos funcionais e não-funcionais, critérios de aceitação, roadmap, glossário.
- `CLAUDE.md` — padrões canônicos de código, armadilhas conhecidas, regras de responsividade a 390px já codificadas.
- `docs/architecture.md`, `docs/backlog.md`, `docs/sprints-delivered.md`, ADR-001, specs de módulo financeiro e mobile fase 1.
- `design_system/design-system.html` + `design_system/refs/`.
- ~40 screenshots da interface real na raiz: dashboard, OS 9999 (dados, peças, serviços, estoque, atividade, fechamento), Kanban, orçamentos, agenda, estoque mobile, fiscal (desktop e mobile), RH.
- Dados reais para migração: ~10k OS e ~7k clientes do legado Box Empresa.

**Não existe e não deve ser fabricado:** depoimento de cliente, benchmark de mercado, número de adoção, caso de sucesso publicado, tabela de preços do produto ou qualquer prova social. A DS Car é o único cliente; não há segundo cliente e a multitenancy completa é Fase 4.

## Product Principles

1. **A OS é a unidade de tudo.** Toda tela existe para mover uma OS adiante ou para explicar por que ela parou. Se uma superfície não faz nenhum dos dois, ela está no lugar errado.
2. **Duas densidades, uma verdade.** Escritório aceita tabela densa; pátio exige alvo grande e contraste alto. A mesma informação muda de forma conforme a condição física, nunca conforme a suposta habilidade do usuário.
3. **Legível sob sol de Manaus.** Contraste é requisito operacional, não preferência estética. Cinza sobre cinza é um defeito funcional neste produto.
4. **Interrupção é o estado normal.** Qualquer fluxo de campo deve sobreviver a ser abandonado no meio e retomado — o veículo não espera o formulário.
5. **Evidência é sagrada.** Foto, assinatura, movimentação de estoque e histórico de status são registros imutáveis. A interface nunca deve sugerir que podem ser apagados.
6. **Substituir o legado é a régua.** Uma funcionalidade que obrigue o usuário a voltar ao Box Empresa é uma falha de produto, por mais bem desenhada que esteja.

## Accessibility & Inclusion

Nenhum requisito formal de conformidade (WCAG, laudo) foi estabelecido pelo cliente — **decisão em aberto, não presumir**.

O que **é** requisito confirmado, derivado da operação e não de norma: contraste que sobrevive a luz solar direta e alvos de toque dimensionados para mão com luva. Ambos vêm da cena de uso real, não de checklist, e valem para toda superfície de campo.
