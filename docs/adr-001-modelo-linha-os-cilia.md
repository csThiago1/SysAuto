# ADR-001: Modelo de linha de OS baseado em (Peça × Ação) e Áreas de Impacto

**Status:** Proposed
**Data:** 2026-04-17
**Deciders:** Thiago (fundador / product owner)
**Supersedes:** modelo de linha definido em `docs/mo-sprint-07-orcamento-os.md` (primeira versão)

---

## Contexto

O motor de orçamentos e a OS do ERP DS Car estão sendo construídos em 9 sprints (MO-1 a MO-9). O planejamento original (MO-Sprint 07) define a linha de orçamento/OS como um registro simples com três FKs mutuamente exclusivas:

```python
class OrcamentoLinha:
    tipo = CharField(choices=[("servico",...), ("peca",...), ("insumo",...)])
    servico_canonico  = FK nullable
    peca_canonica     = FK nullable
    material_canonico = FK nullable
    # constraint: exatamente UM dos três preenchido
```

Duas descobertas durante a fase de design revelaram que esse modelo não representa o domínio real da oficina automotiva que atende seguradoras:

**Descoberta 1 — Peças e serviços não são unidades independentes.** A unidade de negociação com seguradora é o par (Peça × Ação). Exemplo real do Cilia (Bradesco, OS 1856212.2, Fiat Palio 2011): a porta dianteira esquerda aparece em uma única linha com duas ações — `T 1,00 | P 6,00` (Trocar 1h + Pintar 6h) — e valor consolidado. O consultor não pensa em "adicionar serviço de pintura" e separadamente "adicionar peça porta"; ele pensa em "o que vai acontecer com a porta".

**Descoberta 2 — Seguradoras negociam por área de impacto, não por linha isolada.** No mesmo PDF Cilia, o regulador da Bradesco negou cobertura com a justificativa: *"da porta traseira para trás já havia avarias pré-existentes, não acatadas"*. A negação é por **região do veículo**, não por peça individual. Orçamentos complexos têm múltiplas Áreas de Impacto (ex: lateral esquerda + traseira = 2 áreas), cada uma com seu conjunto de peças e seu próprio status de aprovação.

Além disso, o vocabulário do mercado segurador brasileiro é padronizado pelo Cilia:

| Sigla | Significado |
|---|---|
| T | TROCA |
| R&I | REMOÇÃO & INSTALAÇÃO |
| R | REPARAÇÃO |
| P | PINTURA |
| PPO/PRO/PR/PREC | Qualificadores de peça (genuína/original/reposição/recondicionada) |
| IMPACTO / SEM COBERTURA / SOB ANÁLISE | Status de cobertura por item |

Adotar esse vocabulário interno reduz atrito em integrações Cilia futuras (MO-8) e elimina a necessidade de tradução conceitual consultor ↔ sistema.

### Forças em jogo

- **Negócio:** OS DS Car atende ~70% seguradora, ~30% particular. Formato Cilia é hegemônico.
- **Técnico:** MO-1 a MO-4 já entregues; `CalculoCustoSnapshot` (MO-6) ainda não implementado. Mudar o modelo agora custa 0 em migração de dados — nenhuma linha com o modelo antigo foi criada.
- **Estratégico:** MO-8 prevê ingestão automática de PDFs Cilia. Modelo de linha alinhado ao Cilia torna essa sprint trivial; modelo desalinhado exige tradução lossy em cada import.
- **Risco reverso:** adotar vocabulário segurador no core pode engessar clientes particulares (a DS Car atende os dois). Mitigação: Natureza A (serviço adicional) existe para capturar casos sem peça — cliente particular que só quer polimento cristalizado não é forçado a escolher peça.

---

## Decisão

Adotar um modelo de linha de OS/Orçamento com **duas naturezas** e uma **camada de agrupamento por Área de Impacto**, seguindo o vocabulário Cilia:

### Natureza A — Serviço Adicional (sem peça)
Linhas que atuam no veículo como um todo ou em sistemas difusos (alinhamento, balanceamento, lavagem técnica, polimento cristalizado, higienização de ar-condicionado). Usam apenas mão-de-obra + insumos.

Modelo: `OrcamentoItemAdicional` / `OSItemAdicional` com FK para `ServiceCatalog` (o catálogo simples existente da Sprint 16, agora com propósito claro).

### Natureza B — Intervenção em Peça (peça × ação)
Linhas que atuam numa peça específica. Cada linha é um par (`PecaCanonica`, `Acao`), onde `Acao` é um enum fechado: `TROCAR`, `REPARAR`, `PINTAR`, `REMOCAO_INSTALACAO`. Uma mesma peça pode ter N linhas (porta = 1 linha TROCAR + 1 linha PINTAR), cada uma com ficha técnica, horas, insumos, valor e status próprios.

Modelo: `OrcamentoIntervencao` / `OSIntervencao` com FKs para `PecaCanonica` + `ServicoCanonico` (resolvido a partir da ação) + `FichaTecnicaServico` (snapshot) + `CalculoCustoSnapshot`.

### Camada de agrupamento — Área de Impacto
Toda intervenção em peça pertence a uma `AreaImpacto` (ex: "Lateral Esquerda Dianteira"). A área tem status próprio de aprovação (`aprovada`, `negada_pre_existencia`, `parcial`), que a seguradora pode decidir em bloco. Serviços adicionais não pertencem a nenhuma área (ficam soltos na OS).

### Vocabulário oficial adotado

- **Ação** (enum): TROCAR, REPARAR, PINTAR, REMOCAO_INSTALACAO
- **Status de item** (enum): ORCADO, APROVADO, SEM_COBERTURA, SOB_ANALISE, EXECUTADO, CANCELADO
- **Qualificador de peça** (enum): PPO, PRO, PR, PREC
- **Fornecimento** (enum): OFICINA, SEGURADORA, CLIENTE
- **Qualificador de linha** (flags): abaixo_padrao, acima_padrao, inclusao_manual, codigo_diferente

O vocabulário é espelhado em TypeScript no `packages/types/src/os.types.ts`.

---

## Opções Consideradas

### Opção A — Modelo original do MO-Sprint 07 (3 tipos, 1 FK por linha)

```python
OrcamentoLinha(tipo, servico_canonico|peca_canonica|material_canonico, ...)
```

| Dimensão | Avaliação |
|---|---|
| Complexidade | Baixa |
| Custo migração | Zero (nada construído) |
| Fidelidade ao domínio | Baixa — não representa (Peça × Ação) |
| Integração Cilia | Alta fricção — tradução lossy por import |
| Suporte a negociação por área | Não suportado |
| Familiaridade da equipe | Alta (padrão CRUD simples) |

**Prós:** Simples, rápido de implementar. Constraint declarativa no banco.
**Contras:** Não representa a unidade atômica que seguradoras usam. Impressão de OS precisa reagrupar dados para ficar legível. Status de negociação fica preso no nível da linha — não permite aprovação/negação por área. Ingestão de PDFs Cilia no MO-8 fica artesanal.

### Opção B — Modelo Peça × Ação + Áreas de Impacto (Cilia-aligned) ← **Escolhida**

```python
OrcamentoIntervencao(
    area_impacto, peca_canonica, acao,
    servico_canonico, ficha_tecnica, snapshot,
    qualificador_peca, fornecimento, status,
    horas_mao_obra, valor_peca, valor_mao_obra, valor_insumos,
    ...
)
OrcamentoItemAdicional(
    service_catalog, snapshot, status,
    quantidade, valor_unitario, valor_total,
    ...
)
AreaImpacto(orcamento, titulo, status, observacao_regulador)
```

| Dimensão | Avaliação |
|---|---|
| Complexidade | Média (3 tabelas em vez de 1) |
| Custo migração | Zero (MO-6/7 ainda não implementados) |
| Fidelidade ao domínio | Alta — espelha Cilia 1:1 |
| Integração Cilia | Trivial — mesmo vocabulário |
| Suporte a negociação por área | Nativo |
| Familiaridade da equipe | Moderada (enum de ação é novidade, resto é padrão) |

**Prós:** Representa o domínio real. Impressão de OS naturalmente agrupada. Status granular por ação (seguradora aprova troca, nega pintura). MO-8 (ingestão Cilia) fica direto. Qualificadores PPO/PRO permitem validar exigências contratuais de seguradora automaticamente.
**Contras:** Duas tabelas de item (adicional vs intervenção) em vez de uma — serializers e hooks de frontend duplicam (parcialmente). Enum de ação exige documentação clara do mapeamento ação → `ServicoCanonico`.

### Opção C — Modelo híbrido: manter Opção A, adicionar AreaImpacto como metadata opcional

Linha continua simples; Áreas de Impacto são tags soltas anexadas às linhas.

| Dimensão | Avaliação |
|---|---|
| Complexidade | Média-baixa |
| Custo migração | Zero |
| Fidelidade ao domínio | Média — área existe mas ação não |
| Integração Cilia | Fricção moderada (metade do vocabulário) |

**Prós:** Menor ruptura.
**Contras:** Resolve 50% do problema. Ainda não permite "TROCAR + PINTAR" na mesma peça sem duplicar linhas idênticas em tudo exceto o serviço. Abre espaço para que desenvolvedores futuros incluam mais metadata avulsa em vez de estruturar.

---

## Análise de Trade-offs

**Fidelidade vs simplicidade.** A Opção A é ~30% mais simples de implementar. Mas toda a economia vai embora na primeira iteração real com seguradora, quando o consultor precisar negociar "aprovou troca da porta, negou pintura" e o sistema não souber representar isso sem gambiarra. A Opção B paga o custo de complexidade uma vez, no desenho, e ganha em cada fluxo de negociação dali em diante.

**Timing.** Se o MO-7 já tivesse sido implementado com o modelo antigo, o cálculo seria outro — migração envolveria `CalculoCustoSnapshot` imutável já persistido e seria custoso. Como ainda não foi, o custo da mudança é só redigir a spec nova. Essa janela é curta: **decidir agora antes de escrever código**.

**Risco de engessamento para particular.** Cliente particular também se beneficia do modelo. Uma OS de particular que "pinta o para-choque após batida" fica mais clara como `Intervenção(Para-choque, PINTAR)` do que como duas linhas soltas "serviço pintura" + "peça para-choque" (que nem faz sentido quando a peça não é trocada). A Natureza A (serviço adicional) cobre o caso genuinamente sem peça (polimento, alinhamento).

**Risco de overengineering de Área de Impacto.** Uma OS simples de particular tem 1 área ("geral"). Poderia virar metadata opcional. Mas o custo de modelar é baixo (1 tabela) e o benefício para OS de seguradora é alto. Default: toda OS começa com uma `AreaImpacto` auto-criada chamada "Geral"; em OS de sinistro o consultor renomeia e adiciona outras conforme o laudo.

---

## Consequências

### O que fica mais fácil
- Impressão de OS agrupada por área → peça → ações, sem lógica de reagrupamento complexa.
- Status de negociação por ação individual, alinhado ao fluxo Cilia real.
- Ingestão de orçamentos Cilia no MO-8: parsing direto para o mesmo modelo, sem tradução.
- Exportação de orçamento no formato Cilia (para enviar à seguradora): geração trivial.
- Qualificadores PPO/PRO habilitam validação automática: "esta seguradora exige PPO — ok?".
- Auditoria de oficina: fácil responder "quais portas trocadas no último mês levaram pintura junto?".

### O que fica mais difícil
- Duas tabelas de item (adicional + intervenção) em vez de uma: serializers, hooks de frontend e componentes de lista precisam lidar com duas fontes.
- Mapeamento ação → `ServicoCanonico` precisa ser mantido sincronizado (tabela de `MAPEAMENTO_ACAO_SERVICO` no constants — similar ao `MAPEAMENTO_CATEGORIA_POSITION` do MO-3).
- Testes de cálculo de preço crescem ~50% (cada ação em cada peça em cada contexto é uma combinação).

### O que precisaremos revisitar
- **MO-7 spec** precisa ser reescrita (objeto deste ADR + tarefa subsequente).
- **MO-8 spec** (ingestão PDF Cilia) fica mais enxuta — ajustar quando chegar a hora.
- **Frontend do MO-7** ganha complexidade na UI de seleção: escolher peça → mostrar ações aplicáveis → resolver multiplicadores. Vale um componente dedicado.
- **Impressão da OS** precisa de novo template (agrupamento por área → peça → ações + bloco separado de serviços adicionais). Template atual de orçamento vira legado.
- **RBAC de áreas:** quem pode criar/renomear área? Provavelmente CONSULTANT+. Detalhar no MO-7.

### Decisões derivadas que este ADR habilita

1. `ServiceCatalog` (Sprint 16) continua existindo com propósito claro: Natureza A (adicionais sem peça). **Não será aposentado.**
2. `ServicoCanonico` (MO-2) é o catálogo de serviços que atuam em peça. Enum `Acao` resolve para `ServicoCanonico` específico via `MAPEAMENTO_ACAO_SERVICO`.
3. Cada `OrcamentoIntervencao` / `OSIntervencao` tem **um** `CalculoCustoSnapshot` — a granularidade do snapshot é por (peça × ação), não por peça.
4. `AreaImpacto` é criada sob demanda; não é entidade global do tenant.

---

## Action Items

1. [ ] Reescrever `docs/mo-sprint-07-orcamento-os.md` com novo modelo de linha (`OrcamentoIntervencao`, `OrcamentoItemAdicional`, `AreaImpacto`) mantendo infraestrutura já desenhada (versionamento, snapshot PROTECT, reserva automática, apontamento, picking, PDF).
2. [ ] Adicionar seção "Modelo de linha de OS" em `CLAUDE.md` com referência ao ADR-001 e ao vocabulário Cilia.
3. [ ] Atualizar `docs/mo-roadmap.md` para registrar que MO-7 foi redesenhado após ADR-001.
4. [ ] Criar `constants.py` em `apps.pricing_catalog` com `MAPEAMENTO_ACAO_SERVICO` (documento vivo).
5. [ ] Adicionar ao MO-8 (quando redigido) nota de que o modelo de linha está alinhado ao Cilia — ingestão deve ser 1:1.
6. [ ] Revisar seeds de `ServicoCanonico` (MO-2) garantindo que há pelo menos um serviço canônico para cada ação (PINTAR → Pintura, TROCAR → Instalação, REPARAR → Funilaria, REMOCAO_INSTALACAO → R&I).
7. [ ] Definir com Thiago, antes do MO-7: **regra de auto-criação de área.** Proposta: toda OS nasce com `AreaImpacto(titulo="Geral")`; em tipo seguro-sinistro, consultor é forçado a renomear no Step 3 do wizard.

---

## Referências

- PDF analisado: `Cilia - Orçamento 1856212.2.pdf` (Bradesco/Fiat Palio 2011, RCF, oficina DS Car Manaus)
- Roadmap atual: `docs/mo-roadmap.md`
- Sprint impactada: `docs/mo-sprint-07-orcamento-os.md` (será reescrita)
- Vocabulário consolidado: [`docs/cilia-vocabulary.md`](./cilia-vocabulary.md) (documento vivo checkado no repo)
- CLAUDE.md: seção "Armadilhas específicas do motor" (A1, A4, A8 relevantes)
