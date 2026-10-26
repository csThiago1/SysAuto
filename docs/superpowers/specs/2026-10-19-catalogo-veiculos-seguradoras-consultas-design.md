# Catálogo de Veículos, Seguradoras e Consultas Automáticas — Design

**Data:** 2026-10-19 · **Status:** aprovado em brainstorming
**Pedido do dono:** "Hoje o usuário tem que cadastrar manualmente a montadora, seus veículos,
modelos e etc. Além das seguradoras, logos e etc. Devem ser apenas campos de select ou
pesquisa, sem input livre." E: "encontrar uma API gratuita para fazer busca por CPF, CEP,
CNPJ, chassi e tudo mais, mesmo que isso leve mais tempo para configurar." E: "Outro detalhe
é a normalização de dados que vem dessas APIs e da importação dos sistemas de orçamentação,
cada um traz de um jeito diferente."
**Objetivo:** veículo, cor, seguradora e endereço passam a ser escolhidos em listas
completas e prontas. As consultas externas e os importadores (Cilia, XML IFX, HDI) passam
por uma única camada de normalização, que converte o que chega em itens dessas listas.
Nenhum desses campos aceita texto livre.

## Por que agora

O Box Empresa (Databox) mostra o que acontece com texto livre em quatro anos de uso,
observado em 19/10/2026 no próprio sistema:

- **Marcas:** 120 cadastradas, quase todas com `ID FIPE = 0`. Usuários criaram "KWID" e
  "HILUX" como marca.
- **Modelos:** 1.209 cadastrados. VW e VOLKSWAGEN aparecem como marcas separadas,
  versões viraram modelo ("GTI", "SPORT", "CAYENNE 3.0 V6 E-HYBRID"), há erro de
  digitação ("VIsturs") e marca errada ("GEELY" dentro da RENAULT, "RANGE" dentro da FORD).
- **Cores:** 70 cadastradas. Só para preto há PRETA, PRETO, PRTA, PRETRA e Preto. Há
  também "XX" e "G7 1.0 FLEX 4P 1.0 12V FLEX" cadastrado como cor.
- **Orçamentos:** placa "PHO-0000", versão "xx", chassi "9", ano "2".

Nada disso permite relatório por marca, modelo ou cor, nem casar a OS com a tabela FIPE.
O ERP novo ainda não foi para produção, então dá para fechar a porta antes de entrar o
primeiro dado real.

## Situação atual no ERP (branch `feat/dscar-historico-sugestao-retornos`)

- `apps/vehicle_catalog` (SHARED_APP) já tem `VehicleMake`, `VehicleModel`,
  `VehicleYearVersion`, `VehicleColor` e `PlateCache`. As tasks de sincronização FIPE
  (`vehicle_catalog/tasks.py`) só buscam `/cars`, de modelo em modelo, e **não estão no
  `CELERY_BEAT_SCHEDULE`** (`config/settings/base.py:235`) nem são chamadas por ninguém. Por
  isso o catálogo está vazio (`makes` → 0 no banco local).
- **Granularidade da FIPE:** `VehicleModel.nome` já é o nome FIPE completo, com versão
  ("ONIX HATCH LT 1.0 12V Flex 5p Mec."), e `VehicleYearVersion` é só ano + combustível
  ("2022 Gasolina"). A FIPE não tem um nível de "família" (Onix, Montana).
- **Cores:** `VehicleColor` é uma tabela editável pela tela `/cadastros/cores`
  (`ColorDialog.tsx`). Já tem "Branca" e "Branco" duplicadas.
- **Veículo na OS:** `ServiceOrder` (`service_orders/models/service_order.py:242-280`)
  guarda `make`, `model`, `vehicle_version`, `year`, `color`, `fuel_type` e `chassis` em
  texto, mais as referências soltas `vehicle_make_id`, `vehicle_model_id` e
  `vehicle_year_version_id`, que são strings com o `fipe_id`, sem FK.
- **Veículo no orçamento:** `Budget` (`budgets/models.py:25-33`) é todo texto. A tela
  `/orcamentos-particulares/novo` pede montadora, modelo, versão, motor, combustível e cor
  digitados.
- `vehicles.Vehicle` (tenant) já tem FK `version → VehicleYearVersion`, com fallback em
  texto `description`.
- **Telas de captura de veículo:**
  - `VehicleFipeFields.tsx` é usado em `NewOSDrawer`, `recepcao/StepPlaca` e
    `os/[numero]/sections/VehicleSection`. Ele tem o botão "Preencher manualmente" e entra
    sozinho em modo de texto livre quando o catálogo está vazio ou a marca não casa
    (`VehicleFipeFields.tsx:61-77`).
  - `FipeSelectGroup.tsx` não é usado por nenhuma tela.
  - `VehiclePlateSearch.tsx` só aparece em `orcamentos/novo` (motor pausado).
  - Cada uma das quatro telas do escopo tem o próprio campo de placa e o próprio
    auto-preenchimento:
    - `NewOSDrawer.tsx:108-131`;
    - `StepPlaca.tsx:36-66`;
    - `VehicleSection.tsx:51-87`;
    - `orcamentos-particulares/novo/page.tsx:63-121`, que sobrescreve o que já está
      preenchido.

    A consulta dispara sozinha no 7º caractere.
  - Outras portas de texto livre:
    - `ColorSelect.tsx:19-30` vira campo livre quando a lista de cores está vazia, e
      `:49-51` mostra valor desconhecido como opção;
    - `VehicleSection.tsx` tem combustível em texto (`:172-173`), ano livre (`:176-184`) e
      valor FIPE digitado (`:193-203`).
- **Consulta de placa:** está implementada duas vezes, em `vehicle_catalog/views.py:307`
  (`plate_lookup`) e em `vehicles/services.py:90` (`lookup_plate`), ambas na wdapi2/API
  Placas. Há ainda uma terceira, a rota Next `app/api/plate/[plate]/route.ts`, que é a
  que as telas chamam. Ela grava a placa em texto claro no log (`route.ts:57`) e usa timeout
  de 12 s. `PlateCache` fica no schema public com `chassis` e `renavam` em texto claro.
- **Alerta de restrição:** `orcamentos-particulares/novo/page.tsx:116-118, 253-261` mostra
  `situation` (roubo/furto) vindo da API de placa.
- **CEP:** `persons/views.py:108` (`cep_lookup`) usa o ViaCEP e **descarta o código
  IBGE**, que a NFS-e exige. `PersonAddress.municipio_ibge` existe, mas fica vazio.
- **CNPJ:** não existe consulta.
- **Importadores de orçamento** (`apps/cilia/sources/`: `cilia_parser.py`,
  `xml_ifx_parser.py` e `hdi_html_parser.py`) preenchem o DTO `ParsedBudget`
  (`cilia/dtos.py:93-104`) com `vehicle_brand`, `vehicle_model`, `vehicle_description`,
  `vehicle_color` e `vehicle_year` em texto.
  - A "normalização" atual só muda a caixa: `-PRETA` vira `Preta` e `CHEVROLET` vira
    `Chevrolet`. Remove também o intervalo de anos do modelo do Cilia.
  - Nada é casado com o catálogo.
  - **Na tela**, toda importação (Cilia, XML, HDI) entra numa OS que já existe
    (`ImportBudgetModal.tsx:83-110` → `service-orders/{id}/import-budget/`, em
    `service_orders/views/orders.py:1495-1700`). `apply_parsed_budget_to_order`
    (`cilia/services.py:139-231`) só preenche campo vazio.
  - **Criam OS a partir do texto:**
    - `ImportService` (`cilia/dtos.py:322-351`), que nasce em `waiting_auth`, pelos
      endpoints `imports/attempts/*` e pelo polling do Cilia;
    - `versioning_service.py:404-428`, quando o orçamento vira OS, separando as duas
      primeiras palavras da descrição em marca e modelo;
    - `quotes/services.py:434`.
  - **Seguradora do Cilia:** `_resolve_insurer_code` (`cilia_parser.py:483-498`) procura
    primeiro em `Insurer.trade_names` (ArrayField, migrations 0008/0009) e depois cai no
    dicionário fixo `INSURER_TRADE_TO_CODE` (`cilia_parser.py:30`). Quando não acha, o
    Cilia só registra no log e segue (`cilia/services.py:201-212`).
  - **XML:** o modal de importação tem uma lista fixa de quatro seguradoras, incluindo
    "Soma (genérico)", que também define qual parser usar (`ImportBudgetModal.tsx:33-38`).
  - **Cilia:** `vehicle.fuel` é um código inteiro sem uso (vale 0 para Sprinter diesel e
    para Kicks flex), e o chassi vem em `vehicle.body`.
  - **CNPJ das seguradoras:** só 1 de 3 fixtures bate com o seed (`Insurer.cnpj` é único e
    formatado):

    | Seguradora | CNPJ no Cilia | CNPJ no seed |
    |---|---|---|
    | Bradesco | 33.055.146/0001-93 | 92.682.038/0001-00 |
    | Yelum | 61.550.141/0091-29 (filial) | 61.589.370/0001-86 |
- **Seguradoras:**
  - `apps.insurers.Insurer` (public) é a fonte, com 11 registros, `logo_url`,
    `brand_color` e `abbreviation`.
  - O papel `INSURER` em `Person` ainda é oferecido em `/cadastros` (aba Seguradoras
    vazia) e no `PersonFormModal`.
  - O filtro de seguradora da lista de OS (`os/page.tsx:148`) usa `persons?role=INSURER`
    e por isso fica vazio.
  - `InsurerViewSet` deixa qualquer usuário autenticado ler e o padrão do mixin para
    escrever.

## Decisões do dono

| Decisão | Escolha |
|---|---|
| Fonte do veículo | Catálogo FIPE completo: carros, motos e caminhões/ônibus |
| Veículo fora da FIPE | Não acontece. Se a placa não retornar, o usuário escolhe nas listas |
| Texto livre | Proibido em montadora, modelo, versão, cor, combustível e seguradora |
| Placa | Só sugere. Nunca bloqueia nem grava sozinha |
| Seguradoras | Lista fixa com logo, só seleção |
| Custo | APIs gratuitas. Aceita configuração mais trabalhosa (bases locais, carga mensal) |
| Normalização | Uma camada só para tudo que chega das APIs e dos importadores de orçamento, que trazem os dados cada um de um jeito |
| Migração das OS do Box | Projeto separado, fora deste spec |
| Nível de modelo | Com família: montadora → modelo (família, ex.: Onix) → versão FIPE → ano. A família é derivada do nome FIPE, com uma tabela de exceções |
| Versão desconhecida | A OS pode ser salva só com montadora e família, com selo "versão a confirmar". Não entra em produção até confirmar |
| Seguradora × CNPJ | Uma seguradora (marca, com logo) aceita vários CNPJs e casa pela raiz. A nota sai no CNPJ que veio no orçamento da seguradora |

## Objetivos, não objetivos e antiobjetivos

**Objetivos**
1. Toda tela que captura veículo usa um único seletor em cascata, com busca:
   tipo → montadora → modelo (família) → versão FIPE → ano/combustível, mais cor.
2. Catálogo FIPE completo carregado no banco e atualizado sozinho todo mês.
3. Seguradora escolhida só numa lista com logo, mantida pelo administrador.
4. CEP, CNPJ e placa pré-preenchem os campos e convertem a resposta em opções das listas.
5. O código IBGE do município fica sempre preenchido no endereço (NFS-e).
6. Cilia, XML IFX, HDI, API de placa, API de CNPJ e, mais tarde, a migração do Box usam a
   mesma normalização. O que não casar com segurança fica marcado para o usuário confirmar
   no seletor, e a escolha dele vira regra para a próxima vez.
7. Custo recorrente de R$ 0, exceto a consulta de placa (~R$ 9/mês no volume atual).

**Não objetivos**
- Migrar OS, veículos ou pessoas do Box (projeto próprio; ele vai usar este catálogo).
- Consultar CPF para obter nome (não existe de graça). Fica só a validação do dígito.
- Consultar inscrição estadual na SEFAZ com certificado A1 (fica para a fase fiscal).
- Padrões de cobrança por seguradora (prazo, conta, regra de NFS-e, valor-hora de pintura),
  que o Box guarda na ficha da seguradora. Fica para o financeiro.
- Tabelas de NCM, CNAE como FK, feriados e bancos (já existe `apps/banks`).
- Normalização das **peças** importadas (código e descrição de peça contra o catálogo de
  peças). É o mesmo problema em outro catálogo e merece spec própria.
- Código de tinta e tipo de pintura (sólida, metálica, perolizada), que o Cilia manda em
  `paint_type`. Fica para quando a pintura for orçada pelo sistema.
- O app Expo (`apps/mobile`), que está pausado. Ele cria OS com veículo digitado e chama
  `/vehicle-catalog/plate/`. Quando voltar, usa o mesmo seletor e a mesma API. Até lá,
  não é mantido.

**Antiobjetivos** (é falha mesmo que funcione)
- Uma opção "Outro" ou "Não está na lista" que reabra texto livre por outra porta.
- Tela travada porque uma API externa caiu: os selects sempre funcionam sem rede externa.
- Consulta que sobrescreve o que o usuário já escolheu.
- CPF, CNPJ, placa, chassi ou RENAVAM em log, em chave de cache ou em tabela pública em
  texto claro.
- Um framework de "providers" com classe base e registro de plugins para meia dúzia de
  funções.

## 1. Catálogo FIPE

### Modelo de dados (`apps/vehicle_catalog`, schema public)

- `VehicleMake`:
  - Ganha `tipo` (`TextChoices`: `carro`, `moto`, `caminhao`), porque o mesmo nome existe
    em mais de um tipo (Honda carro e Honda moto).
  - A unicidade passa a ser `(tipo, nome_normalizado)`. `nome` deixa de ser único sozinho.
  - Ganha `is_active`.
- **`VehicleFamily` (nova):** `make`, `nome` (ex.: "Onix", "Montana"), `nome_normalizado` e
  `is_active`, única por `(make, nome_normalizado)`. É o "Modelo" que o usuário vê, e é por
  ela que os relatórios agrupam.
  - **Derivação automática na carga:** limpa o nome FIPE e pega o primeiro termo.
    - Remove prefixos como NOVO/NOVA e o nome da própria marca, quando vem repetido.
    - Na carga, mapeia nomes compostos conhecidos pela tabela de exceções.
  - **`VehicleFamilyRule`:** tabela de exceções (`make`, `padrao` → família) para os casos
    que o primeiro termo erra. Exemplos: "GRAND SIENA" → Grand Siena, "SPRINTER VANS" →
    Sprinter, e quando "ONIX PLUS" deve ou não ficar junto de "ONIX". É mantida pelo
    administrador e reaplicada a cada carga.
  - Um relatório da carga lista famílias com uma versão só e versões sem família, para
    revisão.
- `VehicleModel` (a versão FIPE, ex.: "ONIX HATCH LT 1.0 12V Flex 5p Mec.") e
  `VehicleYearVersion`:
  - Ganham `is_active`.
  - `VehicleModel` ganha FK `familia → VehicleFamily`.
  - `VehicleModel` passa a ser único por `(tipo, codigo_fipe)` e ganha `codigo_fipe`.
  - `VehicleYearVersion` passa a ser único por `(modelo, ano, combustivel)` e ganha
    `zero_km`.
  - `combustivel` passa a usar o enum da seção 2.
- O que sai da fonte vira `is_active=False`, nunca é apagado, porque OS antigas apontam
  para essas linhas.
- **Zero km:** vem da coluna `zero_km` do fipeX (na API da FIPE é o ano `32000`). O
  seletor mostra "Zero km". Ao gravar na OS, `year` recebe o ano corrente e `zero_km=True`
  *(decisão minha)*.

### Carga e atualização

- **Fonte principal:** dump mensal aberto do fipeX (CC0), no Hugging Face,
  `alanwgt/fipex-veiculos-brasil`, arquivo `YYYY/MM/fipex-prices.parquet` (~1 MB). Em
  out/2026 tinha 51.247 ano-versões e 108 marcas de carro, 103 de moto e 29 de caminhão,
  iguais ao site oficial.
  - **Colunas:**
    - identificação: `tipo_veiculo`, `codigo_fipe`, `nome_marca`, `nome_modelo`;
    - combustível: `nome_combustivel` e `sigla_combustivel` (g, e, d, l, f, h, n);
    - ano: `ano_modelo` e `zero_km` (booleano);
    - preço: `valor_centavos`, `mes_referencia`, `ano_referencia`.
  - Não traz os `fipe_id` de marca, modelo nem ano-combustível. Os arquivos mensais usam os
    nomes originais da FIPE.
  - **Chaves naturais da carga:**
    - marca = `(tipo, nome_normalizado)`;
    - modelo = `(tipo, codigo_fipe)`;
    - ano-versão = `(modelo, ano_modelo, sigla_combustivel)`.

    Os `fipe_id` passam a ser opcionais e só são preenchidos quando a Parallelum for usada.
    O código FIPE também é o que a API de placa devolve, então o casamento por placa fica
    direto.
- **Fallback:** API Parallelum v2 com token gratuito (1.000 req/dia). Serve para
  reconstruir incrementalmente se o fipeX parar, e para preço pontual.
- **Execução:** management command idempotente `sync_fipe_catalog`, com upsert por chave
  natural (`bulk_create(update_conflicts=True)`). Roda no Celery beat todo dia 5, com
  `tenant_schema='public'`, e registra contagens (novos, atualizados, desativados).
- A task atual `/cars` modelo a modelo é removida.
- **Logos de montadora:**
  - Script único que busca no Wikidata (P154) e Wikimedia Commons e grava em S3/static,
    com um `manifest.json` de origem e licença por arquivo.
  - Revisão humana antes do commit.
  - O que faltar usa o monograma gerado no front.
  - O administrador pode trocar o logo (`PATCH /makes/{id}/logo/` já existe).
  - Não usar `car-logos-dataset`, cujas imagens vêm do carlogos.org, que proíbe uso
    comercial.

### Seletor único no front

- Um componente `VehicleCatalogPicker` substitui `VehicleFipeFields` e `FipeSelectGroup`:
  - tipo (padrão carro) → montadora (com logo) → modelo (família) → versão FIPE →
    ano/combustível, mais cor;
  - na tela, os rótulos são Montadora, Modelo, Versão e Ano *(decisão minha: "Modelo" é a
    palavra que o consultor usa para "Onix")*;
  - cada nível é um combobox com busca no servidor (marcas, famílias, versões e anos
    paginados; nunca cortar em 25);
  - a busca de versão aceita palavras soltas ("lt 1.0 turbo");
  - o usuário pode parar na família: a versão fica "a confirmar" (ver "Como o veículo é
    gravado");
  - o combustível não é escolhido: vem da versão;
  - não existe botão de preencher manualmente.
- Um hook único de placa substitui os quatro auto-preenchimentos locais.
  - A consulta roda ao sair do campo ou no botão, não no 7º caractere.
  - Nunca sobrescreve campo já preenchido.
  - Quando acerta, pré-seleciona o que conseguir casar e deixa tudo editável.
  - Quando não acerta, abre o seletor vazio.
- As portas de texto livre listadas em "Situação atual" fecham todas:
  - `ColorSelect` sem modo livre;
  - combustível derivado da versão;
  - ano vindo da versão;
  - valor FIPE vindo do catálogo, só leitura.
- Telas que passam a usar o seletor: `NewOSDrawer`, `recepcao/StepPlaca`,
  `os/[numero]/sections/VehicleSection` e `orcamentos-particulares/novo`, que hoje é todo
  texto livre. `orcamentos/novo` pertence ao motor de precificação pausado e fica de fora.

### Como o veículo é gravado

- `ServiceOrder` e `Budget` ganham duas FKs `PROTECT`, ambas nullable:
  - `catalog_family → VehicleFamily`;
  - `catalog_version → VehicleYearVersion`.
- A API de criação e edição aceita apenas `catalog_family` e `catalog_version` (ids),
  `color` (código do enum), `year_manufacture` e `chassis`. Quando vem `catalog_version`,
  o servidor deriva a família dela.
- Os campos de texto atuais (`make`, `model`, `vehicle_version`, `year`, `fuel_type`,
  `make_logo`, `fipe_value`) passam a ser **snapshot preenchido pelo servidor** a partir da
  FK. Continuam servindo para leitura, PDF e histórico, mas o cliente não envia mais.
- As strings soltas `vehicle_make_id`, `vehicle_model_id` e `vehicle_year_version_id`
  deixam de ser gravadas e são removidas quando não houver mais leitor.
- **Validação (vale só quando a requisição cria o registro ou mexe em campos de veículo;
  editar KM, datas e outros campos não passa por ela):**
  - Pela tela, sem `catalog_family` → 400.
  - Com família e sem versão → salva com `vehicle_needs_review=True` ("versão a
    confirmar").
  - Importador ou migração (seção 5) pode criar sem família, com `vehicle_needs_review=True`.
  - O selo sai quando `catalog_version` é preenchido.
  - Nesses casos, o texto original da fonte fica em `vehicle_source_text`, só leitura.
    Ele aparece como "como veio do Cilia" e nunca vira opção das listas.
- `vehicles.Vehicle` (tenant):
  - ganha `family`;
  - `family` é obrigatório para veículo novo e `version` continua opcional;
  - `description` passa a ser só legado. `chassis` e `renavam` passam a `EncryptedField` (LGPD).
- `year_manufacture` é numérico e validado em ano-modelo ou ano-modelo − 1.

## 2. Cores e combustíveis

- **Cor:**
  - `TextChoices` fechado com as 16 cores do Renavam/CRLV (rótulos da Senatran: AMARELA,
    AZUL, BEGE, BRANCA, CINZA, DOURADA, GRENA, LARANJA, MARROM, PRATA, PRETA, ROSA, ROXA,
    VERDE, VERMELHA e FANTASIA), mais `NAO_INFORMADA`.
  - Fonte normativa: tabela `cCorDENATRAN` do MOC NF-e 7.0, Anexo I.
  - O hex de preview fica numa constante do front e é aproximado, porque não existe RGB
    oficial.
- A tabela `VehicleColor` e a tela `/cadastros/cores` saem. O endpoint de cores devolve a
  lista fixa.
- **Combustível:** `TextChoices` com os combustíveis que a FIPE usa (gasolina, etanol,
  flex, diesel, elétrico, híbrido, GNV), mapeados das siglas do fipeX.
- Data migration que normaliza o texto existente nos ambientes de dev/homologação (PRETO,
  PRETA, PRTA → PRETA e assim por diante). O que não casar vira `NAO_INFORMADA`.

## 3. Seguradoras

- `apps.insurers.Insurer` é a única fonte. Sai o papel `INSURER` da criação de `Person`
  (`PersonFormModal`, `Cadastros/index.tsx`). A aba "Seguradoras" de `/cadastros` vira um
  link para `/cadastros/seguradoras`.
- **Escrita** (criar, editar, logo, ativar/desativar) só para `IsAdminOrAbove`. Leitura
  para todos os autenticados. Desativar em vez de apagar (`PROTECT` já existe).
- Campo opcional `susep_code` (código FIP da SUSEP, da lista pública de empresas) como
  chave natural para o seed e para futuras integrações.
- **Logos:**
  - Pedir o kit oficial a cada seguradora com quem a DS Car trabalha, pelo gestor de rede
    de oficinas.
  - Enquanto não chega, usar o Wikimedia Commons (cobre ~8 de 16: Allianz, Bradesco, HDI,
    Mapfre, Zurich, Porto, Azul e Tokio Marine).
  - Por último, o monograma com `abbreviation` e `brand_color`.
  - Uso interno de identificação. Uso no site público exige autorização por escrito.
- Todo seletor de seguradora usa `/insurers/`. Isso inclui o filtro da lista de OS, que
  hoje lê `persons?role=INSURER`.

## 4. Consultas automáticas — app `apps/lookups`

App novo em SHARED_APPS. É o único ponto que chama fonte externa. São dois arquivos de
lógica, `providers.py` (uma função por fonte) e `service.py` (`lookup(kind, key)`), mais
`validators.py`. Não há classe base nem registro de plugins.

### Cadeias de fallback

```python
CHAINS = {
    "cep":   [viacep, opencep, awesomeapi],
    "cnpj":  [cnpja_open, minhareceita, cnpjws],
    "placa": [apiplacas],
}
```

- Cada provider devolve um dict normalizado ou `None`. A cadeia para no primeiro acerto.
- Exceção capturada por provider e logada sem PII. A cadeia nunca propaga erro para a tela.
- Erro de negócio que vem com HTTP 200 conta como miss (ViaCEP `erro: "true"`). Na API
  Placas, 402 e 403 contam como token inválido.
- Timeout por provider de `httpx.Timeout(3.0, connect=1.5)`, com orçamento de ~6 s por
  consulta. Sem retry em requisição de usuário. Retry com backoff só em task Celery, para
  429 e 5xx.

### Fontes por tipo (pesquisadas e testadas em 19/10/2026)

| Dado | Principal | Fallback | Modo | Custo |
|---|---|---|---|---|
| CEP → endereço + IBGE | ViaCEP | OpenCEP, AwesomeAPI (chave grátis, 100 mil/mês) | tempo real | R$ 0 |
| Município (IBGE) | API Localidades IBGE | código IBGE vindo do CEP/CNPJ | tabela local, recarga anual | R$ 0 |
| CNPJ | CNPJá aberto (`open.cnpja.com`, 5 req/min medido, aceita alfanumérico) | Minha Receita/BrasilAPI, CNPJ.ws (3/min) | tempo real | R$ 0 |
| Inscrição estadual | `inscricoes_estaduais` da CNPJ.ws, quando vier | digitada com máscara e DV do AM; "ISENTO" válido | tempo real + validação local | R$ 0 |
| CPF | validação local do DV | botão "Conferir na Receita" (abre o site oficial) | local | R$ 0 |
| Placa → veículo + código FIPE | API Placas (wdapi2), `fipe.dados[]` de maior score | seletor manual | tempo real, banco antes | R$ 0,03/consulta |
| Chassi (VIN) | decode local do WMI (montadora) e do 10º caractere (ano-modelo) | — | local | R$ 0 |
| RENAVAM | validação local do DV | — | local | R$ 0 |

**Ainda a confirmar antes de ligar:** os termos de uso comercial do CNPJá. O site
respondeu 429 na pesquisa. Se não permitirem uso comercial, a Minha Receita/BrasilAPI vira
a principal.

### Normalização para as listas

A resposta de todo endpoint segue o formato
`{found, source, fields: {campo: {id, label} | valor}, unmatched: [...]}`:

- **CEP:** `municipio` vira FK `Municipio(codigo_ibge)` e a UF sai dele. Logradouro e
  bairro são texto, porque não existe base aberta de logradouros. Número e complemento
  são sempre digitados.
- **CNPJ:** razão social, fantasia, situação, endereço (com município FK), CNAE principal
  (código e descrição como texto), Simples/MEI e e-mail/telefone quando vierem. Não
  guardar o quadro de sócios (QSA).
- **Placa:**
  - Passa por `match_vehicle` (seção 5) com o `codigo_fipe` + ano-modelo, que acha a
    `VehicleYearVersion` direto.
  - Se casar uma versão, devolve o caminho completo: tipo, montadora, família, versão e
    ano.
  - Se casar só até a montadora ou a família, devolve até onde casou.
  - A cor vem convertida no enum.
  - O chassi vem mascarado pela API e não é gravado.
- Texto da API que não casa com a lista vai para `unmatched` e deixa o campo vazio para o
  usuário escolher. Nunca vira opção nova.
- Toda consulta é disparada por ação do usuário (blur do campo ou botão), com debounce de
  400 ms no front.
- O valor pré-preenchido continua editável. A consulta nunca sobrescreve campo que o
  usuário já preencheu. Não há registro de origem campo a campo.
- **Restrição (roubo/furto):** o alerta que existe hoje continua *(decisão minha)*.
  - O resultado de placa ganha `restricao {situacao, consultado_em}`, mostrado na recepção,
    na gaveta Nova OS e no orçamento.
  - Ao abrir OS ou orçamento, se a última consulta daquela placa tem mais de 30 dias, a API
    é consultada de novo, mesmo havendo cache e veículo no banco.
  - O custo extra é de centavos por mês.

### Cache, cota e LGPD

- **Ordem de consulta:**
  1. O próprio banco: `Vehicle` do tenant por placa, `Person` por documento.
  2. O Redis, com chave `lookup:{kind}:{sha256(chave)}`. TTL de 180 dias para CEP, 30 para
     CNPJ e 365 para placa; miss guardado por 1 dia.
  3. Só então a fonte externa.
- Cota por provider com contador por minuto no Redis (CNPJá 4/min, CNPJ.ws 2/min). Quando
  estoura, a cadeia pula para o próximo provider em vez de esperar.
- `PlateCache` deixa de guardar `chassis`, `renavam` e `raw_response` com dados de
  proprietário. Fica com placa, código FIPE, ano e cor.
- Log estruturado por chamada (kind, provider, status, ms, hit/miss), sem a chave
  consultada.
- O health check que já valida `APIPLACAS_TOKEN` passa a checar também o saldo da API
  Placas (`GET /saldo/{token}`) e alerta abaixo de 100 consultas.

### Endpoints e consolidação

- `GET /api/v1/lookups/cep/{cep}/`, `/cnpj/{cnpj}/`, `/placa/{placa}/` e `/vin/{vin}/`.
  Permissão `IsConsultantOrAbove`.
- Substituem `persons.cep_lookup`, `vehicle_catalog.plate_lookup`,
  `vehicles.services.lookup_plate` e a rota Next `app/api/plate/[plate]/route.ts`. Essas
  implementações duplicadas são removidas, e os chamadores passam a usar o service pelo
  proxy `/api/proxy/`.
- Validadores puros em `lookups/validators.py`:
  - CPF;
  - CNPJ, inclusive alfanumérico (`^[0-9A-Z]{12}[0-9]{2}$`, módulo 11 sobre `ord(c) - 48`);
  - IE do AM (9 dígitos, módulo 11);
  - VIN (17 caracteres, sem I/O/Q);
  - placa antiga e Mercosul;
  - RENAVAM.

  Os mesmos validadores rodam nos serializers de pessoa, cliente e RH, que hoje só
  conferem comprimento.
- No front, um hook TanStack Query por tipo, com schema Zod da resposta normalizada. Os
  três estados ficam assim:
  - **loading:** Skeleton;
  - **erro:** os selects ficam liberados, com aviso discreto;
  - **`found: false`:** abre os selects vazios, sem mensagem de erro.

## 5. Normalização dos dados que chegam de fora

Cada fonte entrega veículo, cor e seguradora num formato diferente. Exemplos reais, das
fixtures de `apps/cilia/tests/fixtures/` e do teste no navegador:

| Fonte | Veículo | Cor | Seguradora | Exemplo |
|---|---|---|---|---|
| Cilia (JSON) | `brand` + `model` longo, com intervalo de anos, motor e carroceria; `model_year`; `type_key` (carro, van, caminhão); chassi em `body`; `fuel` é código inteiro sem uso | `BRANCA`, `-PRETA` | `insurer.trade` (nome) e `insurer.document_identifier` (CNPJ, às vezes de filial ou de outra empresa do grupo) | `MERCEDES-BENZ` / `SPRINTER VANS (2023 A 2026) 517 CDI - EXTRA LONGO TETO ALTO 18L OM-654 CDI 2025` |
| XML IFX (Porto, Azul, Itaú) | só `descricaoModelo`, com marca, modelo, versão, portas e combustível juntos; `anoDoModeloDoVeiculo` | `corVeiculo`, quase sempre vazio | não vem: o usuário escolhe ao importar | `CHEVROLET NOVA MONTANA CAB DUPLA RS 1.2 12V TURBO FLEX AUT 4p Gasolina/Alcool` |
| HDI (HTML) | "MARCA MODELO ANO" numa linha; o parser separa por espaço e erra marca de duas palavras (LAND ROVER, CAOA CHERY) | texto | fixa (`hdi`) | — |
| API de placa | marca, modelo e versão em texto; `fipe.dados[]` com `codigo_fipe` e score | `Branca` | — | `Honda` / `POP` / `110I` |
| API de CNPJ | — | — | seguradora ou fornecedor como PJ | — |
| Box Empresa (migração futura) | texto digitado à mão | ~30 grafias | nome | `VIsturs`, `GEELY` dentro da RENAULT |

### Onde fica

- Os parsers continuam específicos de cada formato. Eles só **extraem** o texto bruto e
  deixam de "normalizar" mudando a caixa.
- Um módulo único, `apps/vehicle_catalog/matching.py`, com funções puras usadas por todas
  as fontes:
  - `match_vehicle(brand, text, year, fuel=None, codigo_fipe=None, vin=None, tipo=None)`
    devolve `VehicleMatch(make, family, model, version, confidence, candidates[:5])`;
  - `match_color(text)` devolve o enum de cor ou `None`;
  - `match_fuel(text)` devolve o enum de combustível ou `None`;
  - `match_insurer(cnpj=None, name=None, source=None)` devolve `Insurer` ou `None`;
  - `match_municipio(nome, uf)` devolve `Municipio` ou `None`.
- `ParsedBudget` ganha os resultados (`catalog_family`, `catalog_version`,
  `vehicle_match_confidence`, `color`, `insurer`, `insurer_cnpj`). `cilia/services.py` grava o que vier deles, em vez do texto.

### Como o veículo é casado

Na ordem, para no primeiro passo que resolver:

1. **Código FIPE + ano-modelo** (API de placa): versão exata.
2. **Regra aprendida** (`VehicleAlias`, abaixo) para `(fonte, texto normalizado)`:
   exata.
3. **Marca:**
   - tabela de apelidos aplicada ao campo de marca ou ao início da descrição: VW →
     Volkswagen, GM → Chevrolet, M.BENZ ou MERCEDES → Mercedes-Benz, CAOA CHERY, LAND
     ROVER e demais marcas de duas palavras;
   - o WMI do chassi, quando houver, desempata e confere;
   - o `type_key` do Cilia restringe o tipo (carro, moto, caminhão), mas a busca não pode
     depender dele, porque vans aparecem em tipos diferentes na FIPE.
4. **Limpeza do texto:**
   - maiúsculas, sem acento;
   - remove intervalo de anos `(2023 A 2026)`, ano solto no fim, `NOVO`/`NOVA`, número
     de portas (`4p`, `5p`) e pontuação (`CAB.` → `CAB`);
   - palavras de combustível (`Gasolina/Alcool`, `FLEX`, `FLEXONE`, `ALCOOL`) saem do
     texto e viram pista de combustível.
5. **Família:** dentro da marca, a `VehicleFamily` cujo nome aparece no início do texto
   limpo, usando também a tabela de exceções.
6. **Versão FIPE:** dentro da família, a melhor `VehicleModel` por sobreposição de palavras
   com o nome normalizado, pontuando motor (`1.2`, `1.5`), `TURBO`, câmbio (`AUT`),
   carroceria (`CAB DUPLA`, `HATCH`) e acabamento (`RS`, `EXL`). Só entram versões que
   existem no ano-modelo informado.
7. **Ano/combustível:** o `VehicleYearVersion` daquela versão no ano-modelo, filtrado pela
   pista de combustível. Se sobrar mais de um, fica sem versão.

**Confiança:**
- `exata`: código FIPE ou regra aprendida.
- `alta`: um candidato claramente à frente.
- `baixa`: vários candidatos próximos.
- `nenhuma`: nada casou.

Os limiares de pontuação e de vantagem são calibrados com as fixtures reais e, depois,
com a exportação do Box, medindo a taxa de acerto por fonte.

### O que acontece com o resultado

- **`exata` ou `alta` na versão:** grava `catalog_version` e a família.
- **Versão sem certeza, família certa:** grava `catalog_family` e marca
  `vehicle_needs_review=True`. É o mesmo "versão a confirmar" da tela.
- **`baixa` ou `nenhuma` na família:** as duas FKs ficam nulas e
  `vehicle_needs_review=True`. O seletor abre pré-carregado com os candidatos e o texto
  original ao lado.
- **Confirmação:** quando o usuário confirma ou corrige no seletor, o sistema grava uma
  `VehicleAlias(source, raw_key, alvo, confirmacoes)` (alvo = versão ou família) no schema public.
  - **Regra nova:** na primeira confirmação, ela vale como `alta`: o candidato aparece em
    primeiro e preenchido, mas a OS continua com selo.
  - **Exata:** a regra passa a `exata` com 2 confirmações iguais da mesma fonte, ou quando
    o administrador aprova *(decisão minha: um clique errado não pode virar verdade para
    sempre)*.
  - **Revisão:** o administrador vê, aprova e remove regras numa lista simples.
  - **Importação numa OS com veículo já confirmado:** o texto do arquivo é comparado com o
    veículo da OS.
    - Se casar com outro veículo, aparece um aviso de divergência ("o Cilia diz: …").
    - Se não casar com nada, a dupla (texto, veículo da OS) conta como uma confirmação
      para a regra.

    Assim o aprendizado acontece no uso normal, antes da migração do Box.
- **Pendências:**
  - A lista de OS ganha o filtro "Veículo a confirmar".
  - O card do Kanban ganha um selo.
  - Uma OS com `vehicle_needs_review` não entra em produção: requisito HARD no
    `TransitionValidator` para os destinos `waiting_parts`, `repair` e os setores de pátio.
    Ela pode ir para a seguradora (`waiting_auth`, `authorized`) com o veículo pendente
    *(decisão minha)*.

### Cor, combustível, seguradora e endereço

- **Cor:** `match_color` usa uma tabela de equivalências, mantida como dado:
  - gênero: PRETO → PRETA;
  - sufixos removidos: METÁLICO, PEROLIZADO, SÓLIDO;
  - prefixo `-` do Cilia removido;
  - sinônimos: GRAFITE e CHUMBO → CINZA; VINHO e BORDÔ → GRENA; CHAMPAGNE → BEGE;
    BRANCO PÉROLA → BRANCA.

  O que não casar vira `NAO_INFORMADA`, com o texto original guardado. O consultor
  escolhe na recepção, que passa a ter o campo de cor, ou na aba Dados da OS. Cor não
  bloqueia transição.
- **Combustível:** `match_fuel` converte `Gasolina/Alcool`, `FLEX`, `FLEXONE`, `G`, `D` e
  similares. Serve só como pista para a versão, já que o combustível gravado vem da versão.
- **Seguradora:**
  - Reaproveita `Insurer.trade_names`, que já existe, como lista de nomes conhecidos. O
    dicionário fixo `INSURER_TRADE_TO_CODE` vira dado nessa lista e sai do código.
    `InsurerAlias` não é criado.
  - **Casamento por CNPJ:** `Insurer` ganha `cnpjs` (ArrayField de CNPJs só com dígitos,
    além do `cnpj` principal).
    - O casamento é pela raiz (8 primeiros dígitos), o que cobre filiais.
    - O seed inclui os CNPJs que já aparecem no Cilia: Bradesco Seguros 33.055.146 e
      Bradesco Auto/RE 92.682.038; Yelum 61.550.141 e 61.589.370.
    - O Cilia casa primeiro pelo CNPJ e depois pelos nomes em `trade_names`.
  - **CNPJ da nota:** `ServiceOrder` ganha `insurer_cnpj`.
    - O importador grava o CNPJ que veio no orçamento da seguradora.
    - Na OS criada pela tela, o consultor escolhe entre os CNPJs da seguradora, e o
      principal vem pré-selecionado.
    - O fiscal emite a nota contra `insurer_cnpj` e, se estiver vazio, contra
      `Insurer.cnpj`.
  - **Importação numa OS que já existe:** vale a seguradora da OS. Se o texto do arquivo
    indicar outra, aparece um aviso de divergência na OS e a importação segue.
  - **Importação que cria OS** (polling do Cilia, `imports/attempts`) com seguradora
    desconhecida para e mostra o texto recebido. Qualquer usuário CONSULTANT+ vincula esse
    texto a uma seguradora existente, escolhida na lista, o que grava o nome em
    `trade_names`. Importação nunca cria seguradora *(decisão minha)*.
  - **XML:** o select do modal passa a listar `/insurers/`. A escolha do parser (Porto,
    Azul, Itaú ou genérico) vem de um campo da seguradora, não da lista fixa.
- **Segurado e endereço** (Cilia): CPF passa pelo validador, o telefone é normalizado e a
  cidade passa por `match_municipio` (nome + UF, sem acento). O CEP, quando vier, passa
  pela consulta da seção 4.

### Testes da normalização

- Um teste com as fixtures reais (Montana e Fit do XML, Sprinter e os demais do Cilia,
  HDI) que afirma a versão ou o modelo esperado de cada uma.
- Quando a exportação do Box existir, a mesma rotina roda sobre ela em modo relatório e
  devolve a taxa de acerto por fonte. Isso é a régua para ajustar os limiares.

## 6. Município

Tabela `Municipio(codigo_ibge, nome, uf)` no schema public, carregada da API de Localidades
do IBGE (5.571 municípios, Manaus = 1302603) por command idempotente.
`PersonAddress.municipio_ibge` passa a ser preenchido sempre, pelo CEP ou pela escolha UF →
município quando o CEP for geral ou falhar.

## 7. Permissões das telas de catálogo

| Tela | Hoje | Depois |
|---|---|---|
| `/cadastros/montadoras` | lista com troca de logo | consulta para todos; troca de logo e desativar só ADMIN+ |
| `/cadastros/cores` | CRUD | removida |
| `/cadastros/seguradoras` | CRUD | consulta para todos; edição só ADMIN+ |
| aba Seguradoras em `/cadastros` | lista `Person` INSURER (vazia) | link para `/cadastros/seguradoras` |

## 8. Testes mínimos

- `test_validators.py` com asserts para cada validador, incluindo CNPJ alfanumérico.
- Teste de `sync_fipe_catalog` com um parquet pequeno de fixture: carga, recarga sem
  duplicar e item removido virando inativo.
- Teste da cadeia de lookup com `respx` (já está nas dependências): primeiro provider
  falha, segundo acerta; todos falham → `found: false` com 200.
- Teste de API:
  - criar OS ou orçamento sem família → 400;
  - só com família → 201 com `vehicle_needs_review=True`;
  - com versão → snapshot de texto preenchido pelo servidor e selo desligado;
  - PATCH de KM numa OS pendente → 200.
- Teste da derivação de família com nomes reais da FIPE (Onix Hatch/Plus, Nova Montana,
  Sprinter, Grand Siena) e com a tabela de exceções.

## 9. Custos e riscos

- **Custo recorrente:** ~R$ 9/mês de placa (300 consultas × R$ 0,03; pacote mínimo de
  R$ 30 via PIX). Todo o resto é R$ 0.
- **fipeX:** tem um mantenedor só (iniciado em 05/2026). A Parallelum com token reconstrói
  o catálogo se ele parar. A FIPE vende a tabela completa: existe risco de propriedade
  intelectual sobre o dump, aceito para uso interno.
- **Sem SLA:** nenhuma fonte gratuita tem. Por isso os selects funcionam sempre sem rede
  externa.
- **CNPJ:** as bases gratuitas atrasam até ~45 dias em relação à Receita.
- **Logos:** são marcas registradas. Uso só para identificação interna.

## Deixado para o construtor

- Como ler o parquet: `pyarrow` como dependência nova, ou outro formato se o fipeX publicar
  um.
- Nomes finais de componentes, hooks e rotas, desde que o seletor seja um só.
- Hex aproximado de cada cor.
- Ordem dos commits, desde que cada passo deixe as telas funcionando.

## Ordem sugerida

1. Tabelas e enums sem nenhuma API em runtime:
   - carga FIPE (carro, moto e caminhão), com derivação de família e a tabela de exceções;
   - `Municipio`;
   - enums de cor e combustível;
   - `is_active` e unicidades novas;
   - `Insurer.cnpjs`.
2. `VehicleCatalogPicker` no lugar de todos os campos de veículo, mais as FKs
   `catalog_family` e `catalog_version` em OS e orçamento.
3. `matching.py` com `VehicleAlias` e `Insurer.trade_names`, ligado a todos os caminhos
   que criam ou atualizam OS a partir de texto (importação na OS, `ImportService`,
   orçamento → OS, quotes). Junto vêm o filtro "Veículo a confirmar", o aviso de
   divergência e o requisito de entrada em produção. O teste com as fixtures reais entra
   aqui.
4. Seguradoras: fonte única, permissões, filtro da lista de OS e logos.
5. `apps/lookups`: validadores e CEP com IBGE.
6. Placa consolidada, usando `match_vehicle`, e decode do VIN.
7. CNPJ e IE, depois de confirmar os termos do CNPJá.
