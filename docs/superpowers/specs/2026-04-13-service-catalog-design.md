# Catálogo de Serviços (Cadastros > Serviços + ServicesTab OS) — Design

**Data:** 2026-04-13
**Sprint:** 16
**Status:** Aprovado para implementação

---

## Goal

Criar um catálogo de serviços reutilizáveis que alimenta a aba "Serviços" de uma OS, substituindo a entrada manual de texto por seleção do catálogo (com preço editável), e disponibilizando CRUD completo em `/cadastros/servicos`.

---

## Contexto

`ServiceOrderLabor` já existe no backend com os campos `description`, `quantity`, `unit_price`, `discount`. Os endpoints `GET/POST /service-orders/{id}/labor/` e `PATCH/DELETE /service-orders/{id}/labor/{pk}/` já existem no `ServiceOrderViewSet`. O que falta é:

1. O **catálogo** como fonte de sugestão de preço e padronização de descrição.
2. A **aba "Serviços"** no detalhe da OS (frontend).
3. A **página CRUD** em `/cadastros/servicos`.

---

## Modelo de Dados

### ServiceCatalog (novo)

```
ServiceCatalog
  id            UUID PK
  name          CharField(200)        — ex: "Pintura Completa"
  description   TextField(blank=True) — detalhe para orçamento
  category      CharField(30) choices — FUNILARIA | PINTURA | MECANICA | ELETRICA | ESTETICA | ALINHAMENTO | REVISAO | LAVAGEM | OUTROS
  suggested_price DecimalField(12,2)  — sugestão editável na OS
  is_active     BooleanField(True)
  created_at / updated_at / created_by
```

### ServiceOrderLabor (modificação)

Adicionar FK opcional:
```
service_catalog   ForeignKey(ServiceCatalog, null=True, blank=True, on_delete=SET_NULL)
```

Preço pré-preenchido do catálogo, mas o consultor pode sobrescrever livremente na OS.

---

## API

```
GET    /api/service-catalog/          → lista (filtros: category, search, is_active)
POST   /api/service-catalog/          → cria
PATCH  /api/service-catalog/{id}/     → atualiza
DELETE /api/service-catalog/{id}/     → soft delete (is_active=False)
```

`ServiceOrderLabor` recebe campo `service_catalog` (UUID opcional) no POST.

---

## Frontend — Cadastros > Serviços

- Rota: `/cadastros/servicos`
- Tabela paginada com colunas: Nome, Categoria, Preço Sugerido, Status, Ações
- Botão "Novo Serviço" abre `ServiceDialog` (Sheet lateral)
- Edição inline via mesmo dialog
- Soft delete com confirmação

---

## Frontend — ServicesTab na OS

- Nova aba "Serviços" no detalhe da OS (ao lado de "Peças")
- Formulário de adição: Combobox de busca no catálogo + campo preço (pré-preenchido, editável) + quantidade + desconto
- Tabela de serviços adicionados com inline edit e delete
- Total de serviços no rodapé
- Bloqueia edição para OS com status `ready`, `delivered` ou `cancelled`

---

## Fluxo do Consultor

1. Digita ou seleciona serviço no combobox (busca por nome/categoria)
2. Preço sugerido preenche automaticamente o campo `unit_price`
3. Consultor ajusta preço se necessário
4. Adiciona à OS → `services_total` recalculado automaticamente pelo backend

---

## Decisões

- Catálogo fica no app `service_orders` (evita novo app para MVP)
- `service_catalog` FK é opcional — entrada manual ainda é permitida
- Soft delete (is_active=False) no catálogo — não afeta itens já lançados em OS
- Categoria como choices fixas no MVP — não administrável pelo usuário
