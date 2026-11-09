# Checklist de entrada 3D — design

**Data:** 09/11/2026 · **Autor:** Thiago Campos + Claude · **Status:** rascunho para aprovação
**Projeto 1 de 2.** O projeto 2 (pátio 3D em tempo real) vem depois e reaproveita os carros 3D daqui.

---

## 1. Intenção e porquê

Quando um carro chega, o **consultor** faz o checklist de entrada. Hoje ele é feito **só com fotos**
(12 slots obrigatórios no app mobile) e uma lista textual de itens (`ChecklistItem`: ok / atenção / crítico).
Nada liga a foto à peça do carro, e não há marcação do dano.

O checklist serve para três coisas:
1. **Registrar como o carro entrou**: danos condizentes com o serviço e também danos que o carro já tinha.
2. **Registrar os itens do veículo** (estepe, macaco, triângulo, som…).
3. **Registrar os pertences esquecidos pelo cliente** (óculos, documentos, cadeirinha…).

O novo checklist põe um **carro 3D** no centro: cada dano é marcado na peça, com tipo, gravidade e foto anexada.
Ao importar o orçamento do Cilia, o sistema cruza as peças marcadas com as peças orçadas. **Um dano fora do orçamento
vira "pré-existente / fora do sinistro"**: isso protege a DS Car de cobrança indevida e gera uma
**oportunidade de orçamento particular** para o consultor oferecer.

> Não confundir: a **vistoria** é do **perito** e é feita no Cilia. O ERP só importa o orçamento de lá.
> Este projeto é o **checklist de entrada do consultor**. As rotas atuais chamadas `vistoria/entrada`
> (mobile) e `os/[numero]/vistoria` (web) são, na prática, esse checklist.

## 2. Objetivos, não-objetivos e anti-objetivos

**Objetivos**
- Marcar cada dano numa peça do carro 3D, com foto anexada (≥ 1 por dano).
- Conduzir o consultor por **7 paradas** em volta do carro, de modo que nenhum lado fique sem registro.
- Ter uma tela de **conferência** no iPad e no monitor, com **assinatura** do cliente e **PDF** anexado à OS.
- Cruzar automaticamente os danos com o orçamento do Cilia e sinalizar os danos fora do orçamento.
- Criar um **retorno (tarefa) para o consultor** oferecer orçamento particular dos danos fora do orçamento.
- Deixar os carros 3D por carroceria prontos para o pátio 3D (projeto 2) reaproveitar.

**Não-objetivos (v1)**
- Precificar danos ou gerar orçamento a partir do checklist (o orçamento vem do Cilia ou do fluxo atual).
- Fazer a vistoria do perito.
- Ter um modelo 3D fiel a cada modelo de carro: a v1 usa **um modelo por carroceria**, pintado com a cor real.
- Detectar danos por IA na foto.
- Checklist de saída 3D. O modelo de dados já aceita `checklist_type = saida`, mas a tela fica para depois.
- Pátio 3D (projeto 2).

**Anti-objetivos (fracasso, mesmo funcionando)**
- O checklist ficar **mais lento** que hoje a ponto de o consultor pular etapas.
- Visual de template genérico: o 3D precisa parecer produto, não demonstração.
- Perder valor de prova: foto apagada, foto sem vínculo ou checklist editável depois de assinado sem registro.
- Ficar **inutilizável sem internet** no pátio. O app mobile já é offline-first e este fluxo também precisa ser.

## 3. Restrições (do projeto)

- Multitenancy: toda query em `schema_context`; tasks Celery recebem `tenant_schema`.
- Fotos: `ServiceOrderPhoto` é imutável, só soft delete, o S3 key nunca é apagado e a marca d'água é aplicada no device.
- LGPD: nada de PII em log. Assinatura e pertences não guardam documento pessoal em texto claro.
- Hard delete proibido em todo model novo (`is_active`).
- TS strict, Zod nas respostas da API e os 3 estados (loading, error, empty) em toda tela web.
- Repositório real: `~/Documents/Projetos/grupo-dscar/grupo-dscar` (Next 16 em `apps/dscar-web`,
  Expo 55 em `apps/mobile`, Django em `backend/core`).

## 4. O que foi decidido com o Thiago

| Tema | Decisão |
|---|---|
| Quem faz | Consultor, na recepção, na chegada do carro |
| Fluxo de captura | **B · Volta no carro**, no **celular** (app mobile) |
| Conferência | **A · Bancada**, no **iPad e no monitor** (web), com o carro 3D no centro e o painel lateral |
| Carros 3D | **Um modelo realista por carroceria, igual ao vídeo**: modelo gratuito, pintado com a cor real, com as peças definidas por volumes (sem modelador) |
| Assinatura | O cliente presente assina no iPad. O cliente ausente recebe link pelo WhatsApp e só confirma. **A assinatura nunca trava o processo** |
| Preço | O checklist não precifica |
| Cruzamento com o Cilia | Sim: dano fora do orçamento = pré-existente + flag de orçamento particular |
| Ordem | Checklist 3D primeiro; pátio 3D depois |

Referência visual de interação: vídeo do "Pátio 3D" (peça acesa, chips de tipo e gravidade, marcadores numerados,
PDF com o carro em vários ângulos). As telas propostas estão em `.superpowers/brainstorm/…/checklist-direcoes.html`.

## 5. Como funciona

### 5.1 Início
O consultor abre o checklist da OS no app mobile. O cabeçalho mostra a placa, o modelo, a cor e a seguradora (ou "particular").
A **carroceria** vem sugerida pela família do veículo (`FamilyBodyType`, tabela do tenant). Se não houver sugestão,
a primeira tela pede um toque: Hatch / Sedã / SUV / Picape / Van. *(minha escolha)* O valor usado fica gravado no
`EntryChecklist` e alimenta a sugestão daquela família para os próximos carros. O catálogo FIPE (`vehicle_catalog`)
fica intocado, porque está em `SHARED_APPS`, no schema public, e é compartilhado entre os tenants.

### 5.2 As 7 paradas (celular)
Cada parada tem uma barra de progresso, a câmera nativa (fluxo atual de `expo-camera` com marca d'água)
e o carro 3D pequeno, virado para o lado daquela parada.

| # | Parada | Slots de foto atuais que ela absorve | Peças tocáveis no 3D |
|---|---|---|---|
| 1 | Frente | `frente`, `diag_diant` | para-choque diant., capô, para-brisa, faróis, grade |
| 2 | Lado direito | `lateral_dir` | para-lamas, portas, retrovisor, laterais, rodas, soleira (D) |
| 3 | Lado esquerdo | `lateral_esq` | idem (E) |
| 4 | Traseira | `traseira`, `diag_tras` | para-choque tras., tampa/porta-malas, vidro tras., lanternas |
| 5 | Teto | — (novo slot `teto`, opcional) | teto |
| 6 | Interior e itens | `painel`, `chave`, `motor`, `step`, `ferramentas`, `combustivel` | — (lista de itens) |
| 7 | Pertences do cliente | — | — (lista com foto) |

**Regras**
- Os **12 slots obrigatórios de hoje continuam obrigatórios**, agora distribuídos pelas paradas.
- Em cada parada de 1 a 5, o consultor precisa marcar ≥ 1 dano ou tocar em **"Sem dano aqui"**. Não dá para pular.
- **Marcar um dano:** tocar na peça (no 3D ou escolher na lista de peças daquela parada) → tipo → gravidade →
  relação → foto(s). A foto pode ser tirada na hora ou escolhida entre as já tiradas na parada.
- A ordem das paradas é sugerida; o consultor pode voltar a uma parada já feita.
- Funciona **offline**: danos e pertences entram na mesma fila persistida (zustand + MMKV) que as fotos e os
  itens já usam hoje, e sincronizam com `client_uuid`. *(minha escolha: seguir o padrão existente, sem WatermelonDB)*

**Tipos de dano:** amassado, risco, trinca, quebra, corrosão, pintura danificada, faltando.
**Gravidade:** leve, moderada, grave.
**Relação** (declarada pelo consultor): do sinistro · pré-existente · não sei. O padrão é "não sei" quando
a OS é de seguradora e o orçamento ainda não chegou.

**Itens do veículo (parada 6):** reaproveita o `ChecklistItem` atual, com os estados presente / faltando / com avaria
(ok→presente, critical→faltando, attention→com avaria, sem migrar o enum). *(minha escolha)*
Ficam as categorias `tires` (pneus e estepe), `accessories`, `interior` e `mechanical`.
`bodywork`, `glass` e `lighting` deixam de aparecer, porque arranhão, amassado, vidros, faróis e lanternas agora
são marcados no 3D. Os registros antigos dessas categorias continuam legíveis no histórico.

**Pertences (parada 7):** descrição + foto. Na entrega, o consultor marca cada um como **devolvido**.

### 5.3 Conferência e assinatura (iPad / monitor)
Tela web em `os/[numero]/checklist` (o nome substitui a rota `vistoria` atual).
- O carro 3D grande gira com toque ou mouse. Os danos aparecem como marcadores numerados e as peças danificadas
  ficam acesas na cor da gravidade.
- Painel lateral com as abas **Danos**, **Itens do veículo** e **Pertences**. Clicar num dano abre o detalhe com as fotos.
- O consultor pode corrigir e adicionar danos aqui também. A captura completa é no celular; aqui é ajuste.
- **Finalizar:** o consultor finaliza. Isso gera o **PDF**, anexa à OS e **trava** o checklist. A finalização
  **não depende da assinatura**.
- **Assinatura do cliente** (reaproveita `apps/signatures`):
  - **Cliente presente:** assina no iPad, na tela de conferência (método atual de assinatura na tela).
  - **Cliente ausente** (guincho, por exemplo): o sistema envia pelo WhatsApp um link remoto (`REMOTE_LINK`, que já
    existe). O cliente abre o link, vê o PDF e marca **"Confirmo que o veículo entrou nestas condições"**. O sistema
    registra data, hora e IP.
  - **A assinatura nunca bloqueia o Kanban, nem a entrega.** A OS só mostra um selo: *assinatura pendente* ou
    *assinado (presencial / remoto)*.
  - O registro de assinatura guarda o **hash do PDF** confirmado, para provar que o cliente aceitou exatamente
    aquela versão. *(minha escolha)*
- Um MANAGER+ pode reabrir o checklist travado, com motivo. Isso fica registrado no `ServiceOrderActivityLog`, gera
  uma nova versão do PDF e volta a assinatura para *pendente*. As versões anteriores e suas assinaturas ficam
  guardadas. *(minha escolha)*

**PDF:** cabeçalho DS Car, dados da OS e do veículo, o carro em 4 ângulos (frente ¾, traseira ¾, lado E, lado D)
com os marcadores, a tabela de danos (nº, peça, tipo, gravidade, relação, miniatura da foto), os itens e os pertences.
A assinatura não entra no PDF; ela é um registro à parte que aponta para o hash do PDF. A tela e a OS mostram os dois juntos. Os ângulos são renderizados no navegador (canvas → PNG) e enviados junto com o pedido de
finalização. O PDF é montado no backend com `weasyprint` (`apps/documents/pdf_service.py`).

### 5.4 Cruzamento com o orçamento do Cilia
Roda **toda vez que um orçamento é importado** para a OS e **toda vez que o checklist é finalizado**.
- Cada item de peça ou serviço do orçamento (`ParsedItemDTO.description`, mais `impact_area`) é traduzido para uma
  ou mais `panel_key` por um **dicionário de palavras-chave** (ex.: "PORTA DIANT ESQ" → `porta_diant_e`;
  "PARACHOQUE DIANT" → `parachoque_diant`).
- Cada dano do checklist ganha `budget_match`: **no_orcamento** / **fora_do_orcamento** / **sem_orcamento**
  (OS particular ou orçamento ainda não importado).
- Itens do orçamento que o dicionário não reconhece aparecem na conferência como **"não mapeado"**, para o
  consultor ligar à peça manualmente. A ligação manual é salva e passa a valer como regra do dicionário
  para aquele texto. *(minha escolha)*
- **O PDF assinado nunca muda.** Ele é a prova de como o carro entrou e do que o cliente assinou, inclusive os
  danos que o consultor já marcou como pré-existentes na chegada. O cruzamento costuma rodar **depois** da
  assinatura, porque o orçamento chega na etapa `budget`. Por isso `budget_match` é um dado calculado, fora do
  conteúdo assinado, e pode mudar com o checklist travado. *(minha escolha)*
- A relação declarada pelo consultor também nunca é sobrescrita. Quando ela diverge do cruzamento
  (consultor disse "do sinistro", orçamento não tem a peça), a tela mostra os dois lado a lado e destaca a divergência.
- Dano **fora do orçamento** em OS de seguradora:
  1. aparece como **"Pré-existente · fora do sinistro"** na conferência e num **relatório de cruzamento** em PDF,
     separado do checklist assinado e gerado sob demanda (para a seguradora ou para o consultor);
  2. cria **um retorno (FollowUp, canal tarefa) para o consultor** com o título "Oferecer orçamento particular",
     listando as peças. Novo gatilho `pre_existing_damage` em `apps/followups`. É um retorno por OS, atualizado
     a cada novo cruzamento, nunca duplicado.
- Se o orçamento complementar do Cilia passar a incluir a peça, o dano vira `no_orcamento` e sai do retorno.

### 5.5 Carros 3D (igual ao vídeo de referência)
- **5 carrocerias na v1:** hatch, sedã, SUV, picape, van/utilitário. Cada uma usa **um modelo realista
  gratuito** de um carro representativo (ex.: um hatch compacto para "hatch", uma picape média para "picape"),
  como o vídeo faz ao mostrar "Modelo 3D · Hatch".
- **Origem e licença:** modelos de bibliotecas gratuitas (Sketchfab e similares) com licença **CC0 ou CC-BY**.
  São proibidos os marcados como *NoDerivatives* ou *Editorial*. Os créditos CC-BY ficam numa página "Sobre / Créditos"
  do ERP. Emblemas e logotipos de montadora são removidos ou escondidos (os modelos sem emblema têm preferência).
  A lista de modelos escolhidos, com link e licença, fica em `packages/car-3d/assets/CREDITS.md`.
- **Formato:** glTF binário (`.glb`) otimizado (Draco, texturas reduzidas), alvo de **≤ 3 MB por modelo**,
  servido como asset estático e cacheado no app.
- **Peças por volume, sem separar a malha:** cada modelo tem um arquivo `regions.json` que define a peça como um
  ou mais **volumes (caixas orientadas) no espaço do modelo**, nomeados pela `panel_key`. Exemplo:
  `porta_diant_e` = caixa entre o fim do para-lama e a coluna B, do lado esquerdo, da soleira até a linha da janela.
  - **Toque:** o raycast acha o ponto tocado na lataria, e o sistema verifica em qual volume ele caiu. Esse volume
    é a peça.
  - **Destaque:** um shader pinta os fragmentos da lataria que estão dentro do volume, na cor da gravidade. As
    bordas ficam retas, como no vídeo. Esse é um limite aceito; não precisa seguir o vinco exato da peça.
  - **Calibração:** quem constrói ajusta as caixas de cada modelo numa tela interna de calibração (modo dev), com
    as caixas visíveis em wireframe sobre o carro. Uma vez por modelo.
- **Cor:** o material da lataria (identificado pelo nome no `.glb` e registrado no `regions.json`) recebe a cor do
  veículo (`COR_HEX` em `vehicle_catalog/normalize.py`; `FANTASIA` e `NAO_INFORMADA` usam cinza neutro). Vidros,
  pneus e faróis mantêm os materiais originais.
- **Troca futura:** se um dia vierem modelos com as peças separadas de verdade, basta trocar o `.glb` e o
  `regions.json`. As `panel_key` não mudam, então dados e telas continuam iguais.
- **Taxonomia de peças (chaves fixas):**
  `parachoque_diant`, `parachoque_tras`, `capo`, `teto`, `tampa_tras` (porta-malas ou tampa traseira),
  `cacamba` (só picape), `paralama_diant_e/d`, `lateral_tras_e/d`, `porta_diant_e/d`, `porta_tras_e/d`,
  `retrovisor_e/d`, `soleira_e/d`, `coluna_a_e/d`, `parabrisa`, `vidro_tras`, `farol_e/d`, `lanterna_e/d`,
  `grade`, `roda_diant_e/d`, `roda_tras_e/d`. Picape sem porta traseira e van com porta lateral corrediça:
  a peça inexistente simplesmente não tem volume no `regions.json`, e `porta_lateral_corredica` entra como chave da van.
- **Marcador:** além da peça, o dano guarda o ponto tocado (coordenadas locais do modelo), para o marcador
  ficar exatamente onde o consultor tocou.

### 5.6 Onde o 3D roda
- Pacote novo **`packages/car-3d`** (React Three Fiber + drei) com um componente `<Car3D>`
  (carroceria, cor, peças acesas, marcadores, `onPanelTap`, câmera por parada, `snapshot()` para o PDF).
- **Web:** usa o pacote direto.
- **Mobile:** usa o mesmo componente via **Expo DOM component** (`'use dom'`), empacotado no app. Assim funciona
  offline e mantém um único código 3D. A câmera e o resto do fluxo continuam nativos.

## 6. Dados (backend, `apps/service_orders`)

**`FamilyBodyType`** (tenant): `family_id` (referência ao `VehicleFamily` do schema public) → `body_type`
(`hatch | sedan | suv | pickup | van`), atualizada pelo último checklist daquela família. A OS não tem FK para
`Vehicle`, então a carroceria efetiva de cada OS fica no `EntryChecklist`.

**`ChecklistDamage`** (`PaddockBaseModel`)
- `service_order` FK, `checklist_type` (padrão `entrada`), `number` (sequencial por OS, estável)
- `panel_key` (choices da taxonomia), `damage_type`, `severity`, `relation` (declarada pelo consultor)
- `point` JSON nullable `{x,y,z}`, `notes`
- `photos` M2M → `ServiceOrderPhoto` (≥ 1 ao finalizar)
- `budget_match` (`no_orcamento | fora_do_orcamento | sem_orcamento`), `matched_budget_items` JSON
- `client_uuid` único (idempotência offline), `is_active`

**`CustomerBelonging`** (`PaddockBaseModel`): `service_order`, `description`, `photo` FK → `ServiceOrderPhoto`,
`returned_at`, `returned_by_id`, `client_uuid`, `is_active`.

**`EntryChecklist`** (`PaddockBaseModel`, 1 por OS e tipo): `stops_done` JSON (paradas e "sem dano"), `body_type`
usado, `finalized_at`, `finalized_by_id`, `version` (sobe a cada reabertura), `pdf` FK do documento da versão atual,
`pdf_sha256`, `signature_status` (`pendente | presencial | remoto`), `signature` FK nullable.
As versões anteriores (PDF + assinatura) ficam em `EntryChecklistVersion`, sem apagar nada.

**`BudgetPanelRule`** (por tenant): `pattern` normalizado → `panel_keys[]`, `source` (`seed | manual`).
Vem com um seed inicial e cresce com as ligações manuais.

`ServiceOrderPhoto` ganha a pasta já existente `checklist_entrada` e o slot novo `teto`. Não há outra mudança.

## 7. API (sob a OS)

- `GET/POST/PATCH /service-orders/{id}/checklist/{tipo}/` → estado do checklist (paradas, finalizado)
- `GET/POST/PATCH /service-orders/{id}/checklist-damages/` (+ `POST …/{pk}/deactivate/`; sem DELETE)
- `GET/POST/PATCH /service-orders/{id}/belongings/` (+ `POST …/{pk}/return/`)
- `POST /service-orders/{id}/checklist/{tipo}/finalize/` → PNGs dos ângulos → PDF + trava
- `POST /service-orders/{id}/checklist/{tipo}/sign/` → assinatura presencial (iPad)
- `POST /service-orders/{id}/checklist/{tipo}/send-remote/` → gera o link e envia pelo WhatsApp
- `GET/POST /public/checklist-confirm/{token}/` → página pública do link remoto (PDF + "Confirmo")
- `POST /service-orders/{id}/checklist/{tipo}/reopen/` (MANAGER+, motivo obrigatório)
- `POST /service-orders/{id}/checklist/budget-match/` → recalcula o cruzamento (também chamado pelo import)
- `GET/POST /checklist/panel-rules/` → dicionário de peças (ADMIN)

## 8. Ligação com o resto do ERP

- **Kanban:** o checklist de entrada **finalizado** (assinado ou não) passa a ser requisito para sair de `reception`,
  no mesmo mecanismo de requisitos de transição que já existe (`TransitionRequirementsSheet` / soft block com
  override do MANAGER). O critério deixa de ser "existe algum `ChecklistItem`" (`_has_checklist`) e passa a ser
  `EntryChecklist.finalized_at` preenchido. *(minha escolha)*
- **Import do Cilia:** ao final do `ImportService`, dispara o cruzamento (Celery, com `tenant_schema`).
- **Entrega:** se houver pertence não devolvido, a transição `ready → delivered` mostra um aviso (soft block).
- **Histórico do veículo:** o histórico por cliente e veículo já existente mostra os checklists anteriores do
  mesmo carro. Útil para reconhecer um dano que já estava lá na visita passada.

## 9. Fica a critério de quem constrói
- Layout fino das telas (dentro do visual escuro do ERP e das telas propostas), animações e câmera do 3D.
- O seed inicial do dicionário `BudgetPanelRule`, a partir das descrições reais de orçamentos já importados no banco.
- A ordem das abas e os textos de microcopy.
- A estratégia de cache dos `.glb` no app.
- O desenho exato do PDF (seguindo `dscar-brand`).

- A escolha de qual modelo gratuito representa cada carroceria, dentro das regras de licença da seção 5.5.
- O envio pelo WhatsApp: usar o canal que o ERP já tiver; se não houver integração, abrir o `wa.me` com a
  mensagem e o link prontos no aparelho do consultor.

## 10. Em aberto
Nada que dependa do Thiago. Decisões tomadas por quem escreveu, marcadas *(minha escolha)* ao longo do texto:
carroceria em tabela do tenant; PDF assinado imutável, com relatório de cruzamento separado; relação declarada nunca
sobrescrita; parada 6 sem lataria, vidros e iluminação; fila offline em MMKV; checklist finalizado como requisito
para sair da recepção; hash do PDF na assinatura; reabertura com versões.
