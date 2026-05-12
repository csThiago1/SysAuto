# Manual de Operação — Pipeline de Serviços DS Car ERP

**Versão:** 1.1 · **Data:** Maio 2026 · **Audiência:** Consultores, Chefes de Oficina, Administrativo, Compras e Estoque

---

## Sumário

1. [Introdução ao Pipeline de Serviços](#1-introdução-ao-pipeline-de-serviços)
2. [Cadastro de Cliente](#2-cadastro-de-cliente)
3. [Criação da Ordem de Serviço](#3-criação-da-ordem-de-serviço)
4. [Preenchimento Inicial da OS](#4-preenchimento-inicial-da-os)
5. [Vistoria Inicial](#5-vistoria-inicial)
6. [Orçamento](#6-orçamento)
7. [Autorização](#7-autorização)
8. [Compras](#8-compras)
9. [Estoque](#9-estoque)
10. [Aguardando Peças e Início do Reparo](#10-aguardando-peças-e-início-do-reparo)
11. [Fases de Oficina](#11-fases-de-oficina)
12. [Vistoria Final](#12-vistoria-final)
13. [Pronto para Entrega](#13-pronto-para-entrega)
14. [Entrega e Faturamento](#14-entrega-e-faturamento)
15. [Fluxo Visual Completo](#15-fluxo-visual-completo)
16. [Atalhos e Dicas de Uso](#16-atalhos-e-dicas-de-uso)

---

## 1. Introdução ao Pipeline de Serviços

O ERP DS Car organiza cada veículo em atendimento em uma **Ordem de Serviço (OS)**. A OS acompanha o veículo desde o momento em que entra no centro automotivo até ser entregue, faturada e quitada.

Toda OS percorre um conjunto de **17 status** que refletem com precisão as etapas reais da operação da DS Car. Nenhum status pode ser pulado — o sistema valida cada transição para garantir rastreabilidade completa.

### Os 17 status da OS

| # | Status | Nome exibido |
|---|--------|--------------|
| 1 | reception | Recepção |
| 2 | initial_survey | Vistoria Inicial |
| 3 | budget | Orçamento |
| 4 | waiting_auth | Aguardando Autorização |
| 5 | authorized | Autorizada |
| 6 | waiting_parts | Aguardando Peças |
| 7 | repair | Reparo |
| 8 | mechanic | Mecânica |
| 9 | bodywork | Funilaria |
| 10 | painting | Pintura |
| 11 | assembly | Montagem |
| 12 | polishing | Polimento |
| 13 | washing | Lavagem |
| 14 | final_survey | Vistoria Final |
| 15 | ready | Pronto para Entrega |
| 16 | delivered | Entregue |
| — | cancelled | Cancelada (terminal) |

Uma OS é considerada **fechada** somente quando três condições forem atendidas ao mesmo tempo:

- O veículo foi **entregue** ao cliente.
- Todas as notas fiscais foram **emitidas**.
- Todos os pagamentos foram **recebidos** (OS quitada).

### Origens de uma OS

O sistema aceita três origens de abertura:

| Origem | Como entra | Quem autoriza |
|--------|-----------|---------------|
| Particular | Consultor abre manualmente | Cliente (verbal ou assinatura digital) |
| Sinistro de seguradora | Importação automática via Cilia ou entrada manual | Seguradora |
| Cadastro direto | Veículo + cliente sem orçamento prévio | Não exige autorização |

---

## 2. Cadastro de Cliente

Antes de criar uma OS, o cliente precisa estar cadastrado no sistema. Você pode cadastrá-lo antecipadamente ou criá-lo de forma inline durante a abertura da OS (ver seção 3).

### Cadastro antecipado

1. No menu lateral, acesse **Cadastros > Pessoas**.
2. Clique em **Nova Pessoa** (botão no canto superior direito).
3. Preencha os campos obrigatórios:
   - **Nome completo** — obrigatório.
   - **CPF** — opcional, mas recomendado para emissão de NFC-e de franquia.
   - **Celular** — obrigatório para contato.
   - **E-mail** — recomendado para envio de documentos.
4. Em **Papel / Função**, selecione **Cliente**.
5. Clique em **Salvar**.

> O CPF, e-mail e telefone são armazenados de forma criptografada em conformidade com a LGPD. O sistema nunca exibe esses dados em logs ou relatórios abertos.

---

## 3. Criação da Ordem de Serviço

### Passo a passo

1. No menu lateral, acesse **Ordens de Serviço**.
2. Clique em **Nova OS**.
3. Escolha a **origem** da OS:
   - **Particular** — cliente que veio por conta própria.
   - **Seguradora** — sinistro coberto por seguro.

#### Se a origem for Seguradora

Preencha os campos adicionais que aparecem:

| Campo | Descrição |
|-------|-----------|
| Seguradora | Selecione na lista (ex: Bradesco, Porto Seguro, Allianz) |
| Tipo de segurado | Segurado / Terceiro / RCF |
| Número do sinistro | Código fornecido pela seguradora |
| Franquia | Valor da franquia a ser cobrado do cliente |

#### Vinculação do cliente

- **Busca:** digite o nome, CPF ou celular no campo de busca e selecione o cliente existente.
- **Cadastro inline:** se o cliente ainda não estiver cadastrado, clique em **Novo Cliente** e preencha Nome, Celular e E-mail diretamente no formulário. O cadastro completo pode ser complementado depois.

#### Dados do veículo

1. Digite a **placa** no campo indicado. O sistema consultará automaticamente os dados do veículo (montadora, modelo, ano) via FIPE.
2. Confirme ou ajuste os dados retornados:
   - Montadora
   - Modelo
   - Ano de fabricação / modelo

3. Clique em **Criar OS**.

O número da OS é gerado automaticamente pelo sistema — não é necessário informá-lo.

---

## 4. Preenchimento Inicial da OS

Assim que a OS é criada, a tela de detalhe é aberta. Preencha as informações iniciais antes de avançar o status.

### Campos a preencher

| Campo | Como preencher |
|-------|---------------|
| Data/Hora de Entrada | Clique em **Agora** para registrar o momento atual, ou selecione manualmente |
| Agendamento | Data prevista de conclusão (planejamento interno) |
| KM de Entrada | Quilometragem registrada no painel do veículo na entrada |

Clique em **Salvar** após preencher.

> Esses campos podem ser editados posteriormente enquanto a OS não estiver faturada. O histórico de alterações fica registrado com data, hora e nome do usuário que fez a mudança.

---

## 5. Vistoria Inicial

A vistoria inicial documenta o estado do veículo no momento da entrada. É obrigatória antes de avançar para o orçamento.

### Pré-requisitos para avançar

Antes de clicar em **Avançar Status > Vistoria Inicial**, confirme que:

- Os dados do veículo (placa, montadora, modelo) estão preenchidos.
- O cliente está vinculado à OS.

### Executando a vistoria

A vistoria é realizada principalmente pelo **aplicativo mobile** (tablet ou celular do chefe de oficina), mas também pode ser iniciada pelo consultor na versão web.

#### Fotos de vistoria

1. Acesse a OS no aplicativo mobile.
2. Na aba **Vistoria**, toque em **Nova Foto**.
3. Fotografe o veículo em pelo menos 12 ângulos:
   - Frente, traseira, laterais (esquerda e direita), teto, interior, rodas e detalhes dos danos.
4. As fotos recebem automaticamente uma **marca d'água** com o número da OS e data/hora — isso é obrigatório para evidência junto a seguradoras.
5. As fotos são imutáveis após o upload. Em caso de erro, use o botão de exclusão (soft delete) — a foto fica marcada como removida, mas permanece no histórico.

#### Checklist de entrada

1. Na aba **Checklist**, preencha cada item com um dos três estados:
   - **OK** — sem observações.
   - **Atenção** — item com desgaste ou ressalva menor.
   - **Critico** — item com dano relevante ou que impede a execução.
2. Adicione observações em texto para itens com estado Atenção ou Critico.

#### Assinatura do cliente

1. Após fotos e checklist preenchidos, toque em **Coletar Assinatura do Cliente**.
2. O cliente assina diretamente no canvas (tela do tablet/celular) ou via **link remoto** enviado por e-mail/SMS.
3. A assinatura fica vinculada permanentemente à vistoria.

---

## 6. Orçamento

Após a vistoria inicial, a OS avança para **Orçamento**. Nesta etapa, o consultor detalha todas as peças e serviços necessários.

### Aba Peças

Clique em **Peças** e use um dos três botões para adicionar cada item:

#### Opção 1 — Do Estoque

Use quando a peça já está disponível no estoque da DS Car.

1. Clique em **Do Estoque**.
2. Busque o produto pelo nome ou código.
3. Selecione a unidade física disponível (posição no armazém).
4. A peça fica **reservada** para esta OS automaticamente.

#### Opção 2 — Comprar

Use quando a peça precisa ser adquirida de um fornecedor.

1. Clique em **Comprar**.
2. Informe a descrição da peça, quantidade, tipo de qualidade (original, reposição, recondicionada) e valor estimado.
3. Um **Pedido de Compra** é gerado automaticamente e encaminhado ao setor de compras.

#### Opção 3 — Seguradora Fornece

Use em OS de seguradora quando a própria seguradora entregará a peça.

1. Clique em **Seguradora Fornece**.
2. Informe a descrição e quantidade.
3. Essa peça não reserva estoque nem gera pedido de compra.

### Aba Servicos

1. Clique em **Servicos**.
2. Clique em **Adicionar Servico**.
3. Preencha:
   - **Descricao** — nome do serviço (ex: "Pintura completa porta dianteira").
   - **Quantidade** — número de unidades ou horas, conforme o serviço.
   - **Preco unitario** — valor por unidade.
4. Clique em **Adicionar**.
5. Repita para todos os serviços do orçamento.

O sistema calcula automaticamente os subtotais de peças, serviços e o **total geral da OS**.

> Dica: o catálogo de serviços cadastrado previamente permite buscar serviços com preço sugerido já preenchido, acelerando o orçamento.

---

## 7. Autorização

Com o orçamento completo, avance a OS para **Aguardando Autorização** e aguarde a aprovação.

### OS Particular

1. Gere o **PDF do orçamento** clicando em **Imprimir / Baixar PDF**.
2. Apresente o orçamento ao cliente pessoalmente ou envie o PDF por e-mail.
3. Com a aprovação do cliente:
   - Se verbal: avance diretamente para **Autorizada**.
   - Se digital: o cliente assina o PDF via link remoto e o sistema registra a autorização automaticamente.

### OS de Seguradora

1. Envie o orçamento em PDF para a seguradora (por e-mail ou via portal da seguradora).
2. Quando a autorização chegar:
   - Preencha a **data de autorização**.
   - Preencha o **número de autorização** fornecido pela seguradora.
   - Confirme o **valor da franquia** (se aplicável).
3. Avance para **Autorizada**.

> Em OS com importação automática via Cilia, a autorização pode ser atualizada automaticamente pela seguradora, mudando o status sem ação manual.

---

## 8. Compras

### 8.1 Pedidos de Compra

Os pedidos de compra são gerados automaticamente a partir das peças adicionadas com origem **Comprar** no orçamento da OS.

Para acompanhar:

1. Acesse **Compras > Pedidos** no menu lateral.
2. Os pedidos seguem o fluxo de status:

| Status | Significado |
|--------|-------------|
| Solicitado | Pedido gerado a partir da OS, aguardando cotação |
| Em Cotacao | Setor de compras está pesquisando fornecedores |
| OC Pendente | Ordem de Compra criada, aguardando aprovação |
| Aprovado | Compra autorizada pelo gestor |
| Recebido | Peças chegaram e foram baixadas no estoque |

### 8.2 Ordem de Compra

Para formalizar a compra junto ao fornecedor:

1. Acesse **Compras > Ordens**.
2. Clique em **Nova OC**. O dialog solicita o **Numero da OS (ex: 42)** — informe o numero da OS diretamente. O sistema localiza automaticamente a OS correspondente e vincula a OC ao pedido gerado por ela.
3. Preencha:
   - **Fornecedor** — selecione da lista de cadastros.
   - **Itens** — descricao, quantidade, preco unitario e prazo de entrega para cada peça.
4. Clique em **Salvar Rascunho**.
5. Clique em **Enviar para Aprovacao**.
6. Um gestor com perfil **Gerente ou acima** recebe a OC para revisão e aprovação.
7. Após aprovação, a OC fica com status **Aprovada** e a compra pode ser efetivada com o fornecedor.

---

## 9. Estoque

Quando as peças chegam à DS Car, registre a entrada no estoque para que fiquem disponíveis para a OS.

### Entrada com Nota Fiscal (XML)

1. Acesse **Estoque > Entradas > Importar NF-e**.
2. Faça o upload do arquivo XML da nota fiscal recebida.
3. O sistema preenche automaticamente os produtos, quantidades e valores.
4. Confirme a posição de armazenamento (Armazem > Rua > Prateleira > Nivel) para cada item.
5. Clique em **Registrar Entrada**.

### Entrada Manual (sem NF-e)

1. Acesse **Estoque > Entradas > Entrada Manual**.
2. Selecione o produto pelo nome ou codigo.
3. Informe:
   - **Quantidade** recebida.
   - **Valor unitario** (valor da NF física ou recibo do fornecedor).
   - **Posicao no armazem** (localizacao fisica da peça).
   - **Motivo** — descreva brevemente a origem (ex: "Compra avulsa fornecedor X, recibo 123").
4. Clique em **Registrar Entrada**.

> Toda movimentacao de estoque e imutavel. Entradas nao podem ser editadas apos o registro — em caso de erro, registre um ajuste com aprovacao do gestor.

### Vinculacao com OS

Quando uma peça entra no estoque e existe um Pedido de Compra pendente vinculado a uma OS, o sistema executa a vinculacao automatica:

1. A entrada cria uma **Unidade Fisica** (UnidadeFisica) no armazem — registro que identifica a posicao exata da peca no estoque.
2. O sistema identifica o item da OS que originou o Pedido de Compra correspondente.
3. A Unidade Fisica e vinculada ao item da OS, marcando a peca como **recebida** naquele pedido.
4. Na tela de detalhe da OS, a peca aparece com o indicador "Recebida", sinalizando que esta fisicamente disponivel para o reparo.

> Se a entrada for manual (sem XML), o vinculo precisa ser confirmado pelo almoxarife na tela **Estoque > Entradas > Vincular OS**. Pecas nao vinculadas bloqueiam a transicao para Vistoria Final.

---

## 10. Aguardando Pecas e Inicio do Reparo

### Aguardando Pecas

Quando o orçamento está autorizado mas as peças ainda não chegaram, avance a OS para **Aguardando Pecas**. O veículo aguarda no pátio sem iniciar execução.

Acompanhe o status das peças em **Compras > Pedidos**. Quando todas as peças estiverem disponíveis no estoque e reservadas para a OS, avance para a próxima etapa.

> Se todas as peças já estiverem em estoque no momento da autorização, é possível pular Aguardando Pecas e avançar diretamente para Reparo.

### Inicio do Reparo

1. Confirme que todas as peças necessárias estão reservadas para a OS.
2. Avance o status para **Reparo**.
3. O chefe de oficina assume o controle das próximas etapas via aplicativo mobile.

---

## 11. Fases de Oficina

As etapas de oficina são gerenciadas principalmente pelo **chefe de oficina no aplicativo mobile**. Cada etapa deve ser registrada com apontamento de execução e ao menos uma foto de progresso.

### Etapas e suas descrições

| Etapa | Status | Descricao |
|-------|--------|-----------|
| Reparo | repair | Inicio da execucao. Desmontagem e avaliacao de danos |
| Mecanica | mechanic | Servicos mecanicos (motor, suspensão, freios, elétrica) |
| Funilaria | bodywork | Trabalho de chaparia e estrutura da carroceria |
| Pintura | painting | Preparacao de superficie e pintura |
| Montagem | assembly | Remontagem de pecas e componentes |
| Polimento | polishing | Acabamento e polimento da pintura |
| Lavagem | washing | Lavagem final antes da vistoria de entrega |

> Nem toda OS passa por todas as etapas. Uma OS de polimento, por exemplo, pode ir direto para Polimento sem passar por Funilaria. O chefe de oficina avanca somente as etapas executadas.

### Como registrar um apontamento (mobile)

1. Abra a OS no aplicativo mobile.
2. Toque em **Apontamento** na etapa atual.
3. Preencha:
   - **Executor** — selecione o funcionário que realizou o serviço (mecanico, funileiro, pintor, etc.).
   - **Descricao** — descreva o trabalho realizado.
   - **Foto** — tire ao menos uma foto mostrando o progresso da etapa.
4. Toque em **Salvar Apontamento**.
5. Para avançar para a próxima etapa, toque em **Avançar Status**.

> As fotos de apontamento tambem recebem marca d'agua automatica. Sao evidencias de execucao para o arquivo da OS.

---

## 12. Vistoria Final

Antes de marcar o veículo como pronto, é necessário realizar a vistoria final. Ela segue o mesmo processo da vistoria inicial.

### Pre-requisitos

- Todos os apontamentos da ultima etapa de oficina estao fechados.
- Todas as pecas vinculadas a OS foram recebidas e utilizadas.

### Executando a vistoria final

1. Avance o status para **Vistoria Final**.
2. No aplicativo mobile, acesse a OS e abra a aba **Vistoria Final**.
3. Fotografe o veículo concluído em pelo menos 12 ângulos (frente, traseira, laterais, detalhes dos reparos).
4. Preencha o **checklist de saida** com o estado de cada item do veículo.
5. Colete a **assinatura do cliente** no canvas ou via link remoto, confirmando que o reparo foi executado.

---

## 13. Pronto para Entrega

Com a vistoria final concluída e a assinatura do cliente coletada, avance para **Pronto para Entrega**.

Neste status:

- O consultor é notificado para entrar em contato com o cliente e agendar a retirada.
- O veículo aguarda no pátio, sem mais operações de oficina.
- A OS fica visível no Kanban na coluna "Pronto para Entrega" para controle da equipe.

---

## 14. Entrega e Faturamento

A entrega é a etapa final da operação. Requer atenção especial à documentação fiscal.

### Passo a passo

1. Na tela de detalhe da OS, clique em **Avançar Status > Entrega**.
2. Preencha os campos de entrega:

| Campo | Descricao |
|-------|-----------|
| KM de Saida | Quilometragem registrada no painel no momento da saida |
| Data de Retirada pelo Cliente | Data e hora em que o cliente retirou o veículo |

3. Colete a **assinatura do cliente** no recibo de entrega (canvas ou link remoto).

### Emissao Fiscal

Acesse a aba **Fiscal** da OS para emitir as notas fiscais correspondentes.

#### OS Particular

| Documento | Quando emitir | Destinatario |
|-----------|--------------|--------------|
| NFS-e (Servicos) | Sempre que houver servicos na OS | Cliente (pessoa fisica ou juridica) |
| NF-e (Pecas) | Quando a oficina forneceu pecas | Cliente |

#### OS de Seguradora

| Documento | Quando emitir | Destinatario |
|-----------|--------------|--------------|
| NFS-e (Servicos) | Sempre | Seguradora |
| NF-e (Pecas da oficina) | Pecas com fornecimento "Oficina" | Seguradora |
| NFC-e (Franquia) | Quando o segurado paga franquia | Cliente (segurado, pessoa fisica) |

Para emitir cada nota:

1. Na aba **Fiscal**, clique no botao correspondente ao tipo de nota.
2. Revise os dados pre-preenchidos (destinatario, itens, valores).
3. Clique em **Emitir**.
4. O sistema envia para a SEFAZ via Focus NF-e e retorna o numero e XML autorizado.
5. O XML e salvo automaticamente — voce pode baixar o DANFE em PDF pelo botao **Baixar DANFE**.

> Aguarde a autorizacao da SEFAZ antes de entregar o veiculo. Em caso de rejeicao, o sistema mostra o codigo de erro e a descricao para correcao.

### Faturamento e Contas a Receber

Ao concluir a emissao fiscal, o sistema executa o **faturamento da OS** automaticamente. Esse processo:

1. Consolida os valores de servicos e pecas da OS.
2. Cria um **Documento de Recebivel (ReceivableDocument)** no modulo financeiro com o valor total da OS, o cliente ou a seguradora como devedor e as condicoes de pagamento definidas.
3. O documento fica disponivel em **Financeiro > Contas a Receber** para a equipe administrativa acompanhar, registrar parcelas e baixar os recebimentos.

> Cada parcela (boleto, Pix, cartao, cheque) e registrada individualmente em Contas a Receber. A OS e considerada **quitada** somente quando todas as parcelas forem baixadas com comprovante.

### Avancando para Entregue

1. Com todas as notas emitidas, clique em **Avançar Status > Entregue**.
2. O campo `delivered_at` e preenchido automaticamente com a data e hora atuais.
3. A OS passa para status terminal **Entregue** e nao pode mais ser editada.
4. O setor financeiro registra o recebimento em **Contas a Receber** para quitar a OS.

---

## 15. Fluxo Visual Completo

O diagrama abaixo mostra todos os 17 status e o caminho percorrido por uma OS desde a entrada do veículo até a entrega.

```
ABERTURA
   |
   v
[Recepção]
   |
   v
[Vistoria Inicial] <-- Fotos + Checklist de Entrada + Assinatura do Cliente
   |
   v
[Orçamento] <---------- Adicionar Peças (Estoque / Comprar / Seguradora)
   |                    Adicionar Serviços
   v
[Aguardando Autorização] <-- Envio do orçamento ao cliente ou seguradora
   |
   v
[Autorizada] <------------- Registro da aprovação + data + número
   |
   v
[Aguardando Peças] <------- Pedidos de compra e entrada no estoque
   |
   v
[Reparo] <----------------- Inicio da execução na oficina (mobile)
   |
   v
[Mecânica]
   |
   v
[Funilaria]
   |
   v
[Pintura]
   |
   v
[Montagem]
   |
   v
[Polimento]
   |
   v
[Lavagem]
   |
   v
[Vistoria Final] <--------- Fotos + Checklist de Saída + Assinatura do Cliente
   |
   v
[Pronto para Entrega] <---- Cliente notificado para retirada
   |
   v
[Entregue] <--------------- KM Saída + Assinatura Recibo + NFs emitidas
   |
   v
  FIM (OS Fechada = Entregue + Faturada + Quitada)


Em qualquer etapa ativa:
   |
   v
[Cancelada] <-------------- Status terminal. Exige justificativa.
```

> As etapas de pátio (Reparo até Lavagem) permitem retorno ao Orçamento quando identificada a necessidade de ajuste. O histórico de todas as transições fica registrado.

---

## 16. Atalhos e Dicas de Uso

### Busca rápida

Pressione **Ctrl + K** (Windows/Linux) ou **Cmd + K** (Mac) em qualquer tela para abrir a busca global. Digite o número da OS, placa do veículo, nome do cliente ou qualquer outro dado para localizar rapidamente o que precisa.

### Visao Kanban

Acesse **Ordens de Serviço > Kanban** para visualizar todas as OS em andamento organizadas por status em colunas. Arrastar um card entre colunas avança o status da OS (desde que a transição seja válida).

Use o Kanban para ter uma visão rápida do pátio: quantos veículos estão em cada etapa e identificar gargalos.

### Agenda

Acesse **Agenda** no menu lateral para ver todas as OS com data de entrega prevista organizadas em calendário. Útil para planejar a capacidade da oficina e evitar acúmulo de entregas no mesmo dia.

### Dashboard por Perfil

O **Dashboard** exibe indicadores diferentes conforme o perfil do usuário logado:

| Perfil | O que ve no Dashboard |
|--------|-----------------------|
| Consultor | OS abertas hoje, OS aguardando resposta, previsoes de entrega |
| Chefe de Oficina | OS em execucao, apontamentos do dia, veiculos prontos |
| Administrativo | Notas fiscais pendentes, contas a receber, OS quitadas |
| Gerente / Admin | Visao geral: todos os indicadores + KPIs de producao |

### Boas práticas operacionais

- Sempre preencha o **KM de entrada** logo que o veículo chegar. Isso evita disputas com o cliente na saída.
- Tire as fotos de vistoria **antes** de qualquer movimentacao do veículo no pátio.
- Em OS de seguradora, confirme o **numero do sinistro** com a seguradora antes de iniciar o orçamento — retrabalho de orçamento atrasa a autorização.
- Mantenha os **apontamentos de execucao** atualizados em tempo real. Apontamentos feitos "de memoria" no final do dia tendem a ter menos detalhes e enfraquecem a evidência junto a seguradoras.
- Para OS paradas por falta de peças, utilize o status **Aguardando Pecas** — isso mantém o Kanban fiel à situação real do pátio e facilita a cobrança do setor de compras.

---

*DS Car Centro Automotivo · ERP Paddock Solutions · Manaus, AM*
*Dúvidas sobre o sistema: contate o suporte Paddock Solutions.*
