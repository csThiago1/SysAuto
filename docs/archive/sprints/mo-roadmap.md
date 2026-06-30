# Motor de Orçamentos e Precificação — Roadmap de Sprints

> Planejamento de execução do motor v1, estruturado para desenvolvimento
> solo com Claude Code como par de programação.
> Cada sprint é um documento autônomo em `docs/mo-sprint-XX-*.md`,
> consumível diretamente por subagents (Plan, Explore, general-purpose).

**Produto:** Motor de Orçamentos DS Car (particular)
**Cliente piloto:** Grupo DS Car — Manaus
**Spec de referência:** v3.0 (este repositório)
**Cadência:** Sprints de 2 semanas · solo + Claude Code
**Início:** Sprint MO-1 (pós Sprint 19 do monorepo)
**Duração estimada:** 18 semanas · 9 sprints

---

## Princípio de execução com subagents

Cada `mo-sprint-XX-*.md` é escrito para ser colado no prompt de um subagent
com zero contexto adicional e ainda assim produzir código funcional.
A regra é: **se o subagent precisar perguntar "onde vai isso?" — o spec
está incompleto.**

Pipeline recomendado por sprint:

1. `Plan` agent lê `mo-sprint-XX-*.md` + `CLAUDE.md` + spec técnica v3.0
   e produz plano de implementação ordenado.
2. `Explore` agent valida que os pontos de integração (apps existentes que
   serão estendidos) têm o formato esperado.
3. Execução em passes pequenos com revisão humana entre backend / frontend.
4. `general-purpose` agent roda o checklist de verificação ao fim.

---

## Índice de sprints

| # | Código | Tema | Objetivo de entrega | Docs |
|---|--------|------|---------------------|------|
| 1 | MO-1 | Fundação veicular | FIPE + Empresa + perfil veicular (segmento, tamanho, tipo pintura, enquadramento) | `mo-sprint-01-fundacao-veicular.md` |
| 2 | MO-2 | Catálogo técnico | Canônicos de serviço, peça, material, insumo, fornecedor, categoria MO | `mo-sprint-02-catalogo-tecnico.md` |
| 3 | MO-3 | Adapters de custo | CustoHoraService, DespesaRecorrenteService, RateioService, fallbacks | `mo-sprint-03-adapters-custo.md` |
| 4 | MO-4 | Ficha técnica | FichaTecnicaServico + multiplicadores + resolução por contexto | `mo-sprint-04-ficha-tecnica.md` |
| 5 | MO-5 | Estoque + NFe entrada | UnidadeFisica, LoteInsumo, NFeEntradaService, etiquetagem ZPL | `mo-sprint-05-estoque-nfe.md` |
| 6 | MO-6 | Motor de precificação | Cálculo completo + CalculoCustoSnapshot + MarkupPeca | `mo-sprint-06-motor-precificacao.md` |
| 7 | MO-7 | Orçamento + OS + picking | Orçamento versionado + OS + reserva forçada + apontamento. Modelo de linha (Peça × Ação) + Áreas de Impacto, vocabulário Cilia. Redesenhado pelo **[ADR-001](./adr-001-modelo-linha-os-cilia.md)** (abr/2026). | `mo-sprint-07-orcamento-os.md` |
| 8 | MO-8 | Benchmark + IA | Ingestão PDF seguradora + motor de aliases + sugestão Claude | `mo-sprint-08-benchmark-ia.md` |
| 9 | MO-9 | Capacity + feedback + auditoria | Capacity/prazo + DesvioExecucao + django-auditlog + hardening | `mo-sprint-09-capacity-feedback.md` |

---

## Arquitetura de apps Django

Decisão tomada antes de MO-1: o motor **reutiliza** apps existentes sempre que
possível e cria apps novos coesos por responsabilidade.

### Apps existentes que serão estendidos

| App | Estende com | Sprint |
|-----|-------------|--------|
| `apps.vehicle_catalog` (SHARED) | Integração FIPE + lookup marca/modelo/ano/versão | MO-1 |
| `apps.accounting` (TENANT) | `DespesaRecorrente` + `ParametroRateio` | MO-3 |
| `apps.inventory` (TENANT) | `UnidadeFisica`, `LoteInsumo`, `ConsumoInsumo`, etiquetagem | MO-5 |
| `apps.fiscal` (TENANT) | `NFeEntrada`, `NFeEntradaItem`, importador XML/chave/SEFAZ | MO-5 |
| `apps.service_orders` (TENANT) | Integração com `pricing` (snapshot, reserva, apontamento) | MO-7 |
| `apps.insurers` (TENANT) | Referência a `HistoricoPrecoMercado` | MO-8 |
| `apps.persons` (SHARED) | `Fornecedor` como perfil (`OneToOne` com Pessoa) | MO-2 |
| `apps.hr` (TENANT) | Exposição de folha consolidada para `CustoHoraService` | MO-3 |

### Apps novos

| App | Escopo | Tenancy | Criado em |
|-----|--------|---------|-----------|
| `apps.pricing_profile` | Empresa + Segmento + Tamanho + TipoPintura + EnquadramentoVeiculo | TENANT | MO-1 |
| `apps.pricing_catalog` | ServicoCanonico + PecaCanonica + MaterialCanonico + InsumoMaterial + CategoriaServico + CategoriaMaoObra + Fornecedor + aliases | TENANT | MO-2 |
| `apps.pricing_tech` | FichaTecnicaServico + FichaTecnicaMaoObra + FichaTecnicaInsumo | TENANT | MO-4 |
| `apps.pricing_engine` | Parâmetros + Markup + CustoHoraFallback + CalculoCustoSnapshot + services de cálculo | TENANT | MO-6 |
| `apps.quotes` | Orcamento + OrcamentoVersao + OrcamentoItem | TENANT | MO-7 |
| `apps.pricing_feedback` | DesvioExecucao + DesvioConsumoInsumo + DesvioProdutividade | TENANT | MO-9 |
| `apps.pricing_benchmark` | OrcamentoBrutoSeguradora + HistoricoPrecoMercado + pipeline ingestão | TENANT | MO-8 |

> **Regra de ouro:** nenhum app novo toca models de outro app via import direto.
> Tudo passa por services. Quebrar essa regra cria acoplamento que detona
> refactor no médio prazo.

---

## Grafo de dependências entre sprints

```
MO-1 ─┬─► MO-2 ─┬─► MO-4 ─┬─► MO-6 ─► MO-7 ─┬─► MO-8 ─► MO-9
      │         │         │                 │
      └─► MO-3 ─┘         └─► MO-5 ─────────┘
```

- **MO-1** desbloqueia todas as outras (perfil veicular + FIPE são fundação).
- **MO-2** desbloqueia MO-3 (adapters referenciam categorias e insumos) e MO-4.
- **MO-3 + MO-4 + MO-5** rodam paralelos após MO-2; MO-6 precisa dos três.
- **MO-7** só começa com MO-5 e MO-6 entregues.
- **MO-8** pode começar logo após MO-2 em backfill de aliases, mas o p90
  integrado ao motor depende de MO-6.
- **MO-9** é a sprint de consolidação: atravessa todos os apps.

---

## Parâmetros de qualidade que não negociam

Independente de sprint, todo PR dentro do motor precisa atender:

1. **`make lint` e `make typecheck` passam sem erro** (padrão monorepo).
2. **Snapshot imutável:** qualquer operação que congele preço (aprovação de
   orçamento, fechamento de OS) escreve `CalculoCustoSnapshot` antes de retornar
   sucesso. Sem snapshot, endpoint retorna 500.
3. **LGPD em logs:** nunca logar CPF, email, telefone em claro.
   Usar `mask_cpf()`, `mask_phone()` do `packages/utils`.
4. **`is_active=True` em toda `APIView`:** regra herdada do CLAUDE.md.
   ViewSets do motor seguem o default, mas `APIView` para relatórios
   (DRE de OS, rentabilidade por consultor) precisam incluir.
5. **RBAC:** visibilidade de custo é controlada no backend via serializer
   ou endpoint dedicado. Nunca enviar custo ao frontend quando papel é
   `CONSULTANT` ou menor.
6. **Tipos TypeScript sincronizados:** toda mudança de enum/status em Python
   reflete em `packages/types/src/pricing.types.ts`.
7. **Testes:** cada app novo precisa de `test_models.py` + `test_services.py`
   + `test_views.py` minimamente. Coverage alvo: 70%.

---

## Armadilhas herdadas do CLAUDE.md (releia antes de cada sprint)

- **DRF routers com múltiplos prefixos:** use `SimpleRouter` + `path()`
  explícito; evite dois `DefaultRouter` em `""`.
- **Editar arquivo em `.worktrees/`** não reflete no dev server.
  Para correção em sprint ativa, editar sempre a pasta principal.
- **`select_related` / `prefetch_related`** obrigatórios em queries com FK.
  Motor faz muita agregação — N+1 aqui dói.
- **Migrações 0015_merge_*:** ao mergear branches de sprints paralelas
  (MO-3/4/5 rodam em paralelo), gerar `makemigrations --merge` sempre.
- **`customer_uuid` desnormalizado:** mesmo padrão vale para `empresa_id`
  quando for útil em snapshot — UUID persiste, não FK cross-schema.
- **TypeScript strict:** nunca `as SomeType`; sempre `z.enum()` com narrowing.

---

## Armadilhas específicas do motor

Coletadas preventivamente a partir do spec v3.0:

### A1 · Mutabilidade de ficha técnica
Nunca altere `FichaTecnicaServico` existente — sempre crie nova versão.
OSs antigas referenciam versão congelada no snapshot. Mudar ficha em uso
**não recalcula** OSs fechadas (correto), mas **apaga histórico de qual
receita foi usada** se a migração for destrutiva. Migration de "corrigir
typo" deve ser nova versão, não `UPDATE`.

### A2 · `max(valor_nf)` inclui unidades reservadas
Regra do custo de peça: maior `valor_nf` entre `status IN ('estoque',
'reservado', 'separado')`. Reservar uma peça cara **não a remove** do cálculo
até virar `aplicada`. Isto é correto por design — cobre o caso de a peça
reservada voltar ao estoque.

### A3 · Multiplicador de tamanho só se `aplica_multiplicador_tamanho=True`
Serviço "Diagnóstico elétrico" não varia com porte. Elétrica, alinhamento,
diagnósticos, configuração de módulos: flag `False`. Pintura, funilaria,
polimento: flag `True`. **Default no cadastro de serviço deve ser `False`
com hint explícito** — obriga a pensar.

### A4 · Snapshot precisa cobrir multiplicadores
`CalculoCustoSnapshot` guarda `mult_insumos`, `mult_horas`, `fator_responsabilidade`
como decimais **já resolvidos no momento do cálculo**. Nunca referencie FK de
segmento/tamanho — nome pode mudar, decimal não.

### A5 · Insumo usa `valor_unitario_base`, nunca `valor_unitario_compra`
Galão de 3.6L entra por R$ 720. Ficha consome em litros.
`valor_unitario_base = 720 / 3.6 = 200/L`. O motor **só** consulta
`valor_unitario_base`. Entrada de NFe obriga preencher `fator_conversao`.

### A6 · Reserva forçada não pode travar operação legítima
Função "Trocar reserva" (chefe de oficina) libera unidade reservada e reserva
outra antes da bipagem. Sem esse escape, etiqueta descolada paralisa OS.

### A7 · Benchmark é teto, nunca alvo
`BenchmarkService.p90` entra como cap em `preco_teto = min(sugerido × teto_sobre_sugerido, p90)`.
UI mostra p50/p90 para consultor como referência, **nunca** sugere valor.

### A8 · `empresa` em tudo sensível, mesmo compartilhando hoje
2 CNPJs DS Car compartilham dados hoje. Campo `empresa_id` existe desde MO-1
em todos os models transacionais (Orcamento, OS, UnidadeFisica, LoteInsumo,
Apontamento, DespesaRecorrente, ParametroRateio, ParametroCustoHora).
Queries agregam por grupo. Quando separar, basta filtrar.

### A9 · Parâmetros são vigência-temporal
`ParametroPrecificacao`, `ParametroRateio`, `MarkupPeca` todos têm
`vigente_desde`. Cálculo **sempre** busca o parâmetro vigente na `data` do
orçamento/OS, não hoje. Snapshot carrega `parametros_snapshot` em JSON.

### A10 · Claude sugere composição, nunca preço
LLM retorna `{codigo, quantidade, justificativa}`. Validação determinística
pós-LLM descarta códigos fora do top-10 RAG (anti-alucinação).
Prompt explicita: "NÃO sugira preços." Repetir na system message.

---

## Métricas de sucesso por sprint

| Sprint | Métrica primária | Métrica secundária |
|--------|------------------|---------------------|
| MO-1 | 500 combinações marca/modelo/ano com enquadramento resolvido | FIPE respondendo < 500ms p95 |
| MO-2 | 30 `ServicoCanonico` + 20 `MaterialCanonico` + 15 `InsumoMaterial` cadastrados | Aliases resolvem ≥ 90% de um golden set de 50 textos |
| MO-3 | Custo/hora retornado para 5 categorias MO em ≤ 50ms | Rateio reproduz planilha manual com erro < 1% |
| MO-4 | 10 fichas técnicas cadastradas e versionadas | Resolução de ficha por contexto cobre 100% dos casos de teste |
| MO-5 | Import de NFe real gera `UnidadeFisica` + etiqueta impressa | Consumo FIFO de insumo reproduz planilha manual |
| MO-6 | `calcular_preco(os_item)` retorna em ≤ 100ms | Snapshot persistido para 100% das aprovações |
| MO-7 | Orçamento aprovado vira OS em 1 clique | Picking bipado 100% dos itens em teste com 10 OSs |
| MO-8 | 100 PDFs de seguradora ingestados com ≥ 95% aliases mapeados | Sugestão IA tem recall ≥ 80% no golden set |
| MO-9 | Dashboard "Saúde do Motor" exibe 6 desvios | auditlog cobre 100% dos models sensíveis |

---

## Decisões arquiteturais registradas (ADRs)

Decisões com impacto transversal em múltiplas sprints do motor são documentadas
em `docs/adr-XXX-*.md`. Toda ADR é referenciada na sprint que ela afeta.

| # | Título | Status | Sprints afetadas |
|---|--------|--------|------------------|
| [ADR-001](./adr-001-modelo-linha-os-cilia.md) | Modelo de linha de OS baseado em (Peça × Ação) e Áreas de Impacto | Proposed · abr/2026 | **MO-7** (redesenhada), MO-8 (ingestão Cilia), MO-9 (análise de variância) |

Ao fim de uma sprint que consuma ADR, mover status para `Accepted` no documento
da ADR. Se retrabalho futuro contrariar a decisão, criar nova ADR com status
`Supersedes ADR-NNN`.

---

## Decisões em aberto no início de MO-1

Lista viva — atualizar conforme definidas:

| # | Decisão | Quem decide | Prazo |
|---|---------|-------------|-------|
| 1 | Limite % desconto por papel (STOREKEEPER/CONSULTANT/MANAGER) | Thiago | Antes de MO-7 |
| 2 | `horas_produtivas_mes` inicial por categoria MO | Gestor oficina | Antes de MO-3 |
| 3 | Valores iniciais de `multiplicador_insumos` / `_horas` por tamanho | Pintor sênior + Thiago | Antes de MO-4 |
| 4 | Fator de responsabilidade por segmento (1.00 / 1.25 / 1.55 / 1.90 / 2.50) | Thiago | Antes de MO-6 |
| 5 | Modelo da impressora ZPL (Zebra GK420, Argox, Elgin) | Thiago | Antes de MO-5 |
| 6 | Scanner USB HID vs PWA câmera | Thiago | Antes de MO-5 |
| 7 | Paddock Inbox como canal de envio de link de aprovação | Thiago | Antes de MO-7 |

---

## Variáveis de ambiente novas (checklist)

Acumuladas ao longo das sprints — atualizar CLAUDE.md ao final de cada:

```bash
# MO-1
FIPE_API_URL=https://fipe.parallelum.com.br/api/v2
FIPE_CACHE_TTL_DAYS=7

# MO-5
ZPL_PRINTER_HOST=
ZPL_PRINTER_PORT=9100
SEFAZ_MANIFESTO_ENABLED=false   # flip para true após homologação

# MO-6
PRICING_MARGEM_MIN_DEFAULT=0.15
PRICING_MARGEM_ALVO_DEFAULT=0.35
PRICING_TETO_SOBRE_SUGERIDO=1.3

# MO-8
VOYAGE_API_KEY=
ANTHROPIC_MODEL_SUGESTAO=claude-sonnet-4-6
ANTHROPIC_MODEL_VISION=claude-opus-4-6
BENCHMARK_MINIMO_N=5

# MO-9
AUDITLOG_ENABLED=true
```

---

## Rituais por sprint

- **Dia 1 (segunda):** leitura do `mo-sprint-XX-*.md` + Plan agent
  produz cronograma de 10 dias úteis.
- **Dia 2–4:** backend — models + migrations + services + testes unitários.
- **Dia 5–7:** endpoints + serializers + testes de API.
- **Dia 8–9:** frontend — types + hooks + páginas.
- **Dia 10 (sexta):** `make sprint-close SPRINT=MO-X` + atualiza CLAUDE.md
  + fecha com Review agent auditando checklist.

Ao fim de cada sprint, atualizar a seção "Sprints Entregues" do CLAUDE.md
com o mesmo padrão dos Sprints 10–19.

---

## Glossário operacional

| Termo | Significado no projeto |
|-------|------------------------|
| **Canônico** | Registro-pai de catálogo: serviço, peça, material, insumo. |
| **Alias** | Variação textual que resolve para canônico via fuzzy ou embedding. |
| **Ficha** | Receita de consumo de um serviço (horas + insumos). |
| **Snapshot** | Congelamento imutável de cálculo no momento da aprovação. |
| **Perfil veicular** | Tupla (segmento, tamanho, tipo pintura) aplicada ao cálculo. |
| **Enquadramento** | Mapeia marca/modelo/ano para perfil veicular. |
| **Rateio** | Despesa fixa dividida por hora produtiva. |
| **Picking forçado** | Operador só bipa unidade previamente reservada pelo sistema. |
| **Apontamento** | Registro de horas reais trabalhadas por item de OS. |

---

*Paddock Solutions · where performance meets strategy*
*Motor de Orçamentos v1 · Roadmap · Abril 2026*
