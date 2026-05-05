# Sprints Entregues — Histórico

> Registro de todas as sprints concluídas. Para referência — não carregado automaticamente.

---

## PartsTab Inteligente + Módulo de Compras — Maio 2026

Redesign da aba Peças da OS com integração ao estoque + fluxo completo de compras com aprovação financeira.

- Backend: app `apps.purchasing` + extensão `apps.service_orders`
- ServiceOrderPart expandido: origem, tipo_qualidade, status_peca, unidade_fisica FK, pedido_compra FK
- PedidoCompra + OrdemCompra + ItemOrdemCompra
- Frontend: PartsTab reescrita (3 botões origem), painel /compras, detalhe OC
- 13 testes, 17 hooks TanStack Query

---

## WMS Estoque Físico Completo — Maio 2026

Módulo completo de gestão de estoque.

- Backend: Localização (Armazem→Rua→Prateleira→Nivel), ProdutoComercialPeca/Insumo, MovimentacaoEstoque imutável, ContagemInventario
- 6 Services, ~36 endpoints REST, IsStorekeeperOrAbove permission
- Frontend: 15 páginas, 50 hooks, 8 componentes especializados
- 75 testes backend + 8 E2E Playwright

---

## Design System Fintech-Red Phase 2 — Abril 2026

Full ERP sweep: 6 foundation components + ~90 arquivos migrados para dark fintech theme.

- Foundation: table dark, DataTable, StatusPill, StatCard, form-styles.ts, SectionDivider
- Migração: Dashboard, Cadastros, Financeiro, RH, Motor, Estoque, Fiscal, OS Detail

---

## Design System Fintech-Red Phase 1 — Abril 2026

Estética fintech-liquidity aplicada ao ERP.

- tailwind.config.ts: pulse-slow animation
- globals.css: .label-mono, .section-divider
- card.tsx, page-header.tsx: fix dark theme
- StatusBadge variant="dot", SectionDivider componente
- Dashboard, OS List, Kanban, KanbanColumn, KanbanCard migrados

---

## Ciclo 07 — Cadastros Unificados — Abril 2026

Person limpo + sub-modelos por role + InsurerTenantProfile + Corretores + Especialistas.

- Person cleanup (remove 5 campos deprecated)
- ClientProfile, BrokerOffice, BrokerPerson
- InsurerTenantProfile tenant-aware (unique_together insurer+company)
- PersonFormModal com documentos, /cadastros/corretores, /cadastros/especialistas

---

## Ciclo 07 — Keycloak Ativação + Tema — Abril 2026

Keycloak 24 ativo em dev + tema customizado DS Car.

- docker-compose.dev.yml: volume tema + health checks
- realm-export.json: loginTheme "paddock", resetPasswordAllowed false
- Tema split 50/50, neon, carrossel, Montserrat

---

## Ciclo 06C — NFS-e Manaus + NF-e Recebidas — Abril 2026

Emissão NFS-e Manaus end-to-end + manifestação de destinatário.

- ManausNfseBuilder, ManualNfseBuilder, FiscalService (emit/consult/cancel)
- NfeRecebidaListView + NfeRecebidaManifestView (pass-through Focus)
- Frontend: /fiscal/documentos, /fiscal/emitir-nfse, /fiscal/nfe-recebidas

---

## MO-9 — Capacidade + Variâncias + Auditoria — Abril 2026

- CapacidadeTecnico, BloqueioCapacidade, CapacidadeService
- VarianciaFicha, VarianciaPecaCusto, VarianciaService
- AuditoriaMotor, AuditoriaService
- Frontend: /capacidade, /configuracao-motor/variancias, /auditoria/motor

---

## MO-8 — Benchmark IA + Ingestão PDF — Abril 2026

- BenchmarkFonte, BenchmarkIngestao, BenchmarkAmostra, SugestaoIA
- PDFIngestionService (pdfplumber + AliasMatcher)
- IAComposicaoService (Claude Sonnet)
- Frontend: /benchmark/*

---

## MO-7 — Orçamento + OS integrada ao Motor — Abril 2026

- Orcamento versionado + AreaImpacto + OrcamentoIntervencao
- OrcamentoService (criar, aprovar→OS, nova_versao)
- OSAreaImpacto, OSIntervencao, OSItemAdicional, ApontamentoHoras
- Frontend: /orcamentos (lista, novo, detalhe)

---

## MO-6 — Motor de Precificação + Snapshots — Abril 2026

- MargemOperacao, MarkupPeca, CalculoCustoSnapshot (imutável)
- MargemResolver, BenchmarkService, MotorPrecificacaoService
- Frontend: /configuracao-motor/margens, /snapshots, /simulador
- 33 testes

---

## MO-5 — Estoque Físico + NF-e Entrada — Abril 2026

- NFeEntrada/NFeEntradaItem, UnidadeFisica (barcode P{hex}), LoteInsumo (FIFO)
- ReservaUnidadeService, BaixaInsumoService, ZPLService, NFeIngestaoService
- CustoPecaService, CustoInsumoService
- Frontend: /estoque/unidades, /lotes, /nfe-recebida

---

## MO-4 — Ficha Técnica + Multiplicadores — Abril 2026

- FichaTecnicaServico versionada, FichaTecnicaMaoObra, FichaTecnicaInsumo
- FichaTecnicaService (resolver, aplicar_multiplicadores, nova_versao)
- Frontend: /cadastros/fichas-tecnicas

---

## MO-3 — Adapters de Custo — Abril 2026

- DespesaRecorrente, ParametroRateio, ParametroCustoHora, CustoHoraFallback
- RHAdapter, RateioService, CustoHoraService
- Frontend: /configuracao-motor/custos

---

## MO-2 — Catálogo Técnico — Abril 2026

- 12 models: ServicoCanonico (VectorField), PecaCanonica, MaterialCanonico, aliases
- AliasMatcher (exato→fuzzy→embedding), embed_texts (Voyage voyage-3)
- Frontend: /cadastros/catalogo/*

---

## MO-1 — Fundação Veicular — Abril 2026

- Empresa, SegmentoVeicular, CategoriaTamanho, EnquadramentoVeiculo
- EnquadramentoService.resolver() (4 níveis fallback)
- VehicleMake/Model/YearVersion + FIPE sync
- Frontend: /cadastros/empresas, /cadastros/perfil-veicular/*

---

## Sprints 17/18/19 — UX/UI Polish dscar-web — Abril 2026

30 melhorias: design system, fluxo de OS, módulo de agenda.

- Sprint 17: primary-600 DS Car, ConfirmDialog, form-styles.ts, formatCurrency
- Sprint 18: paginação, isDirty, dropdown transição, edição inline, ConfirmDialog peças
- Sprint 19: DayView full-width, hora atual, células clicáveis, "+N mais"

---

## Sprint 16 — Catálogo de Serviços + Agenda + Dashboard — Abril 2026

- ServiceCatalog model + ServicesTab combobox
- CalendarView endpoint + /agenda (Mês/Semana/Dia, date-fns)
- DashboardStatsView role-based (Consultant vs Manager)

---

## Sprint M6 Mobile — Acompanhamento + Vistorias + Push — Abril 2026

- Fotos acompanhamento + vistoria entrada/saída
- Push notifications (Expo Push Token + Celery task)

---

## Sprint Mobile — OS Detail Dark + Foto Sync — Abril 2026

- OS detail redesign dark glass
- foto sync reescrito (fetch + FormData)
- getTenantDomain centralizado

---

## Seguradoras CRUD + Logo Upload — Abril 2026

- InsurerViewSet CRUD + upload_logo endpoint
- Frontend: /cadastros/seguradoras + InsurerDialog
- Mobile: resolveLogoUrl()

---

## Sprints M4/M5 Mobile — Abril 2026

- M4: AnnotationCanvas SVG, photo-editor, ItemChecklistGrid, ChecklistItem model
- M5: Wizard nova OS (4 steps), useVehicleByPlate, useCreateServiceOrder, sync offline

---

## Sprint 14 — AP/AR + OS Form — Abril 2026

- Backend: Supplier, PayableDocument, ReceivableDocument
- OS Form: NewOSDrawer, CustomerSection editável, customer_uuid
- Histórico agrupado por tipo de campo

---

## Sprint 13 — RH↔Contabilidade — Abril 2026

- tax_calculator.py (INSS/IRRF/FGTS progressivo)
- accounting_service.py (lançamentos automáticos)
- Frontend: /financeiro completo

---

## Sprint 12 — Auth & SSO — Abril 2026

- Keycloak end-to-end, AUTH_SECRET, RBAC backend, /me endpoint

---

## Sprint 11 — Fundação Contábil — Abril 2026

- ChartOfAccount (5 níveis SPED), JournalEntry (partidas dobradas)
- NumberingService (sequencial thread-safe), AccountBalanceService
- 93 testes, fixture 84 contas DS Car

---

## Sprint 9 — Person↔Employee Integration — Abril 2026

- EmployeeCreateSerializer aceita name+email (sem UUID)
- GlobalUser.save() computa email_hash automaticamente

---

## Sprint 8 — HR Frontend: Ponto, Metas, Vales, Folha — Abril 2026

- /rh/ponto (LiveClock), /rh/metas, /rh/vales, /rh/folha

---

## Sprint 7 — HR Frontend: Dashboard + Colaboradores — Abril 2026

- /rh dashboard, /rh/colaboradores (lista+admissão+detalhe 6 tabs)

---

## Sprints 5+6 — HR Backend Completo — Abril 2026

- 10 models, 4 services, ViewSets completos, 18 testes

---

## Sprint 4 — RBAC, UX criação, integrações — Abril 2026

- DevJWTAuthentication, KeycloakJWTAuthentication, DevTenantMiddleware
- NovoClienteModal, NovaOSModal, PermissionGate, VALID_TRANSITIONS

---

*Paddock Solutions · Última atualização: Maio 2026*
