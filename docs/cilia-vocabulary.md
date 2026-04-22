# Vocabulário Cilia — padrão do mercado segurador brasileiro

**Propósito:** referência canônica de vocabulário, status e estrutura de dados
do padrão Cilia, adotado pelas principais seguradoras brasileiras (Bradesco,
Porto Seguro, Allianz, HDI, Mapfre, Tokio Marine).

**Fonte:** análise do orçamento real Cilia 1856212.2 (Bradesco / Fiat Palio
2011, RCF, oficina DS Car Manaus) em 2026-04-17.

**Quando usar:** toda vez que for modelar linhas de OS, status, impressão de
orçamento ou integrações com Cilia/seguradoras. Adotar esse vocabulário reduz
atrito com seguradoras e elimina tradução lossy em integrações (MO-8).

**Decisões que dependem deste doc:**
- [ADR-001](./adr-001-modelo-linha-os-cilia.md) — Modelo de linha de OS (Peça × Ação) e Áreas de Impacto.
- [MO-Sprint 07](./mo-sprint-07-orcamento-os.md) — Orçamento + OS com vocabulário Cilia.
- MO-Sprint 08 (futuro) — Ingestão de PDFs Cilia.

---

## 1. Vocabulário de ações

Ações possíveis sobre uma peça. Cada linha Cilia pode combinar múltiplas ações
sobre a mesma peça (ex: `T 1,00 | P 6,00` = Trocar 1h + Pintar 6h).

| Sigla Cilia | Significado                 | Enum interno (Python)    |
|-------------|-----------------------------|--------------------------|
| T           | TROCA                       | `Acao.TROCAR`            |
| R           | REPARAÇÃO                   | `Acao.REPARAR`           |
| P           | PINTURA                     | `Acao.PINTAR`            |
| R&I         | REMOÇÃO & INSTALAÇÃO        | `Acao.REMOCAO_INSTALACAO`|

Regra: no nosso modelo, cada par (Peça × Ação) é uma `OrcamentoIntervencao`
separada. Porta com T+P = 2 intervenções, mesma área, mesma peça.

---

## 2. Qualificadores de peça

Atributo obrigatório quando a ação é `TROCAR` (peça nova entra). Opcional nas
demais ações. Seguradoras frequentemente **exigem** PPO em veículos novos
(≤ 3 anos) e permitem PR/PREC em veículos mais velhos.

| Sigla | Significado                        | Enum interno              |
|-------|------------------------------------|---------------------------|
| PPO   | Peça original de produção (genuína) | `QualificadorPeca.PPO`    |
| PRO   | Peça reposição original             | `QualificadorPeca.PRO`    |
| PR    | Peça de reposição (não-original)    | `QualificadorPeca.PR`     |
| PREC  | Peça recondicionada                 | `QualificadorPeca.PREC`   |

---

## 3. Status de cobertura por item

Status Cilia do item no orçamento (independente do status de execução na OS).

| Label Cilia     | Significado                                      | Enum interno                 |
|-----------------|--------------------------------------------------|------------------------------|
| IMPACTO         | Item coberto pelo sinistro (default ao incluir)  | (nosso: `StatusItem.APROVADO` pós-aprovação; `ORCADO` pré) |
| SEM COBERTURA   | Regulador negou cobertura (pré-existência, etc.) | `StatusItem.SEM_COBERTURA`   |
| SOB ANÁLISE     | Regulador pediu mais informação antes de decidir | `StatusItem.SOB_ANALISE`     |

**Decisão de mapeamento:** nosso `StatusItem` adiciona `ORCADO` (ainda não
enviado), `EXECUTADO` (OS concluída) e `CANCELADO` (linha removida após
aprovação) além dos 3 do Cilia. "IMPACTO" do Cilia = `APROVADO` no nosso enum.

---

## 4. Qualificadores extras (flags boolean)

Flags Cilia que adornam itens. No nosso modelo, são campos `BooleanField`
em `OrcamentoIntervencao` e `OrcamentoItemAdicional`.

| Flag Cilia              | Significado                                              | Campo interno           |
|-------------------------|----------------------------------------------------------|-------------------------|
| Abaixo do padrão        | Valor unitário abaixo da média de mercado                | `abaixo_padrao`         |
| Acima do padrão         | Valor unitário acima da média de mercado                 | `acima_padrao`          |
| Inclusão manual         | Linha adicionada fora do import/sistema (escrita à mão)  | `inclusao_manual`       |
| Serviço manual          | Mão de obra sem ficha técnica padrão                     | (fundido em `inclusao_manual`) |
| Código diferente        | Código de peça diverge da referência da seguradora       | `codigo_diferente`      |

Regra de UI: qualquer flag ativa renderiza ícone `⚠` no card + tooltip. No
PDF, flags aparecem em coluna dedicada.

---

## 5. Estrutura macro: Áreas de Impacto

Cilia agrupa intervenções por **Área de Impacto** (região do veículo).
Seguradoras aprovam ou negam **a área inteira** — não item por item.

Exemplo real do Cilia 1856212.2:
- Área "Lateral Esquerda" → aprovada (7 itens).
- Área "Traseira" → negada: *"da porta traseira para trás já havia avarias pré-existentes, não acatadas"*.

Modelo interno: `AreaImpacto` com `status` próprio (`aberta`, `aprovada`,
`negada_pre_exist`, `parcial`, `cancelada`) e campo `observacao_regulador`
para a justificativa da seguradora.

**Itens sem área:** serviços adicionais (alinhamento, polimento, lavagem
técnica) **não pertencem a nenhuma área** — ficam em lista plana. Ver
`OrcamentoItemAdicional`.

---

## 6. Cabeçalho do orçamento Cilia

Campos críticos presentes no cabeçalho de qualquer orçamento Cilia:

| Campo Cilia                  | Significado                                                  | Campo interno                            |
|------------------------------|--------------------------------------------------------------|------------------------------------------|
| Número da OS                 | Identificador único por oficina (ex: 1856212)                | `Orcamento.numero`                       |
| Versão                       | Revisão após negociação (ex: `.2` = 2ª versão)               | `Orcamento.versao`                       |
| Tipo de responsabilidade     | Segurado, RCF, particular                                    | `Orcamento.tipo_responsabilidade`        |
| Número do sinistro           | ID da seguradora (ex: `23456/2025`)                          | `Orcamento.sinistro_numero`              |
| Oficina executora            | Quem executa o serviço                                       | (empresa ativa do tenant)                |
| Oficina faturadora           | Quem emite a NF — pode ter **CNPJ diferente** da executora   | (a decidir: `empresa_faturadora_id`)    |
| Dados do veículo             | Terceiro em RCF ≠ segurado                                   | campos `veiculo_*` + `insured_type`     |
| Taxa de mão de obra          | Distinta por categoria                                       | `pricing_engine.ParametroCustoHora`      |
| Fluxos (1, 2, 3…)            | Rodadas de pareceres oficina ↔ regulador                      | `OrcamentoTransicaoLog` (MO-9)           |

**RCF (Responsabilidade Civil Facultativa):** modalidade de seguro onde o
veículo do orçamento é do **terceiro** (vítima), pago pelo seguro do causador.
Implicação no modelo: `ServiceOrder.vehicle_*` e `ServiceOrder.customer` podem
ser de pessoas distintas — o customer é o terceiro atendido; o segurado é
referenciado via `insurer` + `sinistro_numero`.

---

## 7. Taxas de mão de obra por categoria

Exemplo Cilia 1856212.2:

| Categoria          | Taxa horária | `CategoriaMaoObra.codigo` (MO-2) |
|--------------------|--------------|----------------------------------|
| Funilaria          | R$ 54,00/h   | `FUNILARIA`                      |
| Vidraçaria         | R$ 54,00/h   | `VIDRACARIA`                     |
| Tapeçaria          | R$ 54,00/h   | `TAPECARIA`                      |
| Elétrica / Mecânica| R$ 54,00/h   | `MECANICA`                       |
| Pintura            | R$ 72,00/h   | `PINTURA`                        |

Valores acima são exemplos de 2026 — cada tenant/empresa tem seus próprios
parâmetros via `ParametroCustoHora` (MO-3) com vigência temporal.

---

## 8. Totalizadores da impressão (rodapé do PDF)

Cilia apresenta totais agregados em 3 eixos simultâneos:

1. **Por categoria de mão de obra** — soma horas + valor por categoria.
2. **Por origem da peça** — Peças (Oficina) · Peças (Seguradora) · Peças (Cliente).
3. **Por status de cobertura** — IMPACTO · SEM COBERTURA · SOB ANÁLISE.

Nosso template de PDF (MO-7 §6) replica essa estrutura. Subtotais **por área**
também aparecem ao fim de cada bloco de área.

---

## 9. Fluxos de negociação

Após emitir o orçamento, seguradora e oficina podem trocar pareceres:
- **Fluxo 1** — orçamento inicial da oficina.
- **Fluxo 2** — contraproposta da seguradora (ex: `.2` no número = 2ª versão).
- **Fluxo 3+** — rodadas adicionais até convergência.

Cada fluxo gera nova versão do orçamento (nosso `Orcamento.versao += 1`). O
registro de quem propôs o quê entra em `OrcamentoTransicaoLog` (MO-9).

---

## 10. Peças da oficina vs peças da seguradora vs peças do cliente

Origem do fornecimento da peça — importante para reserva automática de estoque:

| Origem Cilia       | Quem fornece                       | Enum `Fornecimento`          | Reserva estoque? |
|--------------------|------------------------------------|------------------------------|------------------|
| Oficina            | Estoque da oficina (DS Car)        | `Fornecimento.OFICINA`       | Sim (se `acao=TROCAR`) |
| Seguradora         | Seguradora entrega a peça          | `Fornecimento.SEGURADORA`    | Não              |
| Cliente            | Cliente traz a peça                | `Fornecimento.CLIENTE`       | Não              |

Apenas intervenções com `acao=TROCAR` + `fornecimento=OFICINA` geram
`ReservaUnidadeService.reservar()` automaticamente na aprovação (MO-7 §P6).

---

## Evolução deste doc

Este é um documento vivo. Atualizar sempre que:
- Encontrar campo ou flag Cilia não documentado aqui.
- Uma nova seguradora usar extensão proprietária do Cilia com campo relevante.
- O enum interno divergir do vocabulário Cilia após feedback de consultor.

Não remover entradas — Cilia é conservador e versões antigas do padrão
ainda circulam entre oficinas menores.

---

*Paddock Solutions · documento de referência · abril 2026*
