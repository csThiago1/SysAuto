# Backlog — Módulos Pausados

> Módulos construídos parcialmente que estão **fora do escopo do MVP**.
> Não deletar código — manter inativo até validação do MVP em produção.
> Critério para reativar: MVP rodando + pedido explícito do cliente.

---

## Motor de Precificação (MO-1 a MO-9)

**Status:** 9 sprints implementadas, nunca testado em produção.
**Decisão:** Avaliar pós-MVP se faz sentido integrar com IA ou descartar.

**Apps Django:**
- `apps.pricing_engine` — Motor de cálculo (MargemOperacao, MarkupPeca, CalculoCustoSnapshot)
- `apps.pricing_catalog` — Catálogo canônico (ServicoCanonico, PecaCanonica, aliases, embeddings)
- `apps.pricing_profile` — Perfil veicular (Empresa, SegmentoVeicular, CategoriaTamanho, EnquadramentoVeiculo)
- `apps.pricing_tech` — Fichas técnicas versionadas (FichaTecnicaServico, mão de obra, insumos)
- `apps.pricing_benchmark` — Benchmark IA (fontes, ingestão PDF, amostras, sugestões)

**Frontend:** páginas sob `/configuracao-motor/*`, `/benchmark/*`, `/capacidade`, `/auditoria/motor`

**Documentação:** `docs/mo-sprint-01.md` ... `docs/mo-sprint-09.md`, `docs/mo-roadmap.md`

---

## Paddock Inbox (Omnichannel)

**Status:** Especificado, parcialmente implementado.
**Decisão:** Fora do MVP. WhatsApp/Instagram/Facebook não são prioridade da DS Car.

**Canais:** WhatsApp (WABA) · Instagram DM · Instagram Comentários · Facebook Messenger

**Estrutura planejada:**
- `services/inbox-api/` — Django ASGI (API + WebSocket)
- `packages/inbox-core/` — Tipos TS + useInbox() hook
- `packages/inbox-web/` — Componente React
- `packages/inbox-native/` — Componente React Native

**Infra:** Coolify + Neon DB + Cloudflare R2 + Redis

---

## Lojas (Peças, Vidros, Estética)

**Status:** Stubs — nenhuma implementação real.
**Decisão:** Feature nova, não substituição do legado. Sem demanda atual.

**Apps planejados:**
- `apps/store-web/` — PDV + E-commerce (Next.js 15)
- `apps.store` — Backend (Django)

**Domínios:**
- pecas.paddock.solutions
- vidros.paddock.solutions
- estetica.paddock.solutions

---

## Hub SSO / Portal Multi-Cliente

**Status:** Stub.
**Decisão:** Sem 2º cliente, não tem função. Reativar na fase 4.

- `apps/hub/` — Portal SSO (Next.js 15)
- Domínio: paddock.solutions

---

## RH Completo

**Status:** Implementado (sprints 5-9).
**Decisão:** Funcionalidade existe mas não é prioridade do MVP. O MVP precisa apenas do cadastro de funcionários com função + assinatura. Módulos de folha, ponto, metas e vales ficam inativos.

**Módulos que ficam inativos:**
- Folha de pagamento (PayslipService, contracheques)
- Relógio de ponto (TimeClockService, espelho)
- Metas (GoalTarget, achieve → Bonus)
- Vales (AllowanceService, fluxo requested→approved→paid)
- Integração RH↔Contabilidade (lançamentos automáticos)

**O que permanece ativo no MVP:**
- Cadastro de Employee com department/position/function
- Assinatura digital salva no cadastro
- Lista de funcionários para seleção em apontamentos

---

## Financeiro Avançado

**Status:** Implementado (sprints 11, 13-14).
**Decisão:** MVP precisa apenas de AP/AR básico. DRE, balanço e fluxo de caixa ficam inativos.

**Módulos inativos:**
- DRE por período
- Balanço Patrimonial
- Fluxo de Caixa Realizado vs. Projetado
- Banking (BankAccount, BankTransaction, OFX)
- Reconciliação bancária

**Módulos ativos no MVP:**
- Contas a Pagar (PayableDocument + PayablePayment)
- Contas a Receber (ReceivableDocument + ReceivableReceipt)
- Plano de Contas (ChartOfAccount) — base para lançamentos
- JournalEntry (lançamentos contábeis manuais)

---

## CRM + WhatsApp

**Status:** Stub.
**Decisão:** Fora do MVP. Comunicação com cliente via WhatsApp manual.

- `apps.crm` — CRM
- Evolution API (WhatsApp self-hosted)

---

## IA (Claude API + RAG)

**Status:** Stub.
**Decisão:** Fora do MVP. Avaliar integração com motor de precificação pós-MVP.

- `apps.ai` — Claude API + RAG (pgvector)
- Casos planejados: recomendações OS, cross-sell, normalização, churn prediction

---

*Última atualização: 2026-05-04*
