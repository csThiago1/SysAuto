# Catálogo de Veículos, Seguradoras e Consultas — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Montadora, modelo, versão, ano, cor, combustível e seguradora passam a ser escolhidos só em listas (catálogo FIPE completo, enum de cores, seguradoras do sistema). Consultas gratuitas de CEP, CNPJ e placa e os importadores (Cilia, XML IFX, HDI) convertem o que chega em itens dessas listas.

**Architecture:**
- O catálogo FIPE (montadora → família → versão → ano/combustível) fica em `apps/vehicle_catalog` (schema public). Ele é carregado todo mês a partir do dump do fipeX.
- OS e orçamento guardam duas FKs (`catalog_family`, `catalog_version`). Os campos de texto de hoje viram snapshot preenchido pelo servidor.
- Uma camada de casamento (`vehicle_catalog/matching.py`, `insurers/matching.py`, `lookups/municipios.py`) é usada por consultas, importadores e caminhos que hoje criam OS a partir de texto.
- O app novo `apps/lookups` (public) é o único ponto que chama fonte externa.
- No front, um único `VehicleCatalogPicker` substitui todos os campos de veículo.

**Tech Stack:** Django 5.0.10 + DRF + django-tenants + Celery beat; httpx 0.28 + respx (testes); Next.js 16 + TS strict + TanStack Query v5 + Zod + React Hook Form + cmdk (já instalado); vitest.

**Spec:** `docs/superpowers/specs/2026-10-19-catalogo-veiculos-seguradoras-consultas-design.md` (commit `2481291`). Leia junto. Onde este plano diverge, vale o plano (lista abaixo).

**Branch:** criar `feat/dscar-catalogo-veiculos` a partir de `feat/dscar-historico-sugestao-retornos`.

Caminhos:
- **backend:** relativos a `backend/core/` (no container, `/app`);
- **front:** relativos a `apps/dscar-web/src/`;
- **pacotes:** `packages/...`.

## Desvios da spec decididos no plano

1. **Leitura do fipeX:** o fipeX publica `YYYY/MM/fipex-prices.csv`, que na verdade é TSV (5,3 MB, 12 colunas). Ele é lido com `csv` da stdlib, sem `pyarrow`.
2. **Consultas por POST:** todas usam `POST /api/v1/lookups/{kind}/` com corpo `{"key": "..."}`, e não GET com a chave no path. O proxy Next grava a URL no log em resposta não-OK (`app/api/proxy/[...path]/route.ts:73`), e o access log também grava. CEP e municípios seguem o mesmo padrão; a lista de municípios é GET, porque não tem dado pessoal.
3. **`PlateCache` sai:** o Redis já guarda 365 dias, e a tabela tinha placa em claro no public. O passo "banco antes" passa a ser a última OS do tenant com aquela placa e com `catalog_family`.
4. **Ficam de fora o endpoint `/vin/` e a validação de inscrição estadual:** nenhuma tela chama o primeiro, e `Person` não tem campo de IE. `decode_vin` entra só como pista no casamento.
5. **Tomador fiscal da seguradora:** continua sendo uma `Person` com papel `INSURER`, porque o fiscal e o `FiscalDocument.destinatario` exigem `Person`.
   - Ela passa a ser criada pelo sistema na página da seguradora.
   - O papel sai só do formulário genérico de pessoa.
   - O faturamento procura essa pessoa pelo `order.insurer_cnpj` (ou `Insurer.cnpj`).
6. **Casamento por raiz do CNPJ só quando a raiz é única:** Porto e Azul dividem `61.198.164` no seed.
7. **CNPJs inválidos do seed:** cinco CNPJs do seed `0009` têm dígito verificador inválido e continuam como estão. O DV é validado só em CNPJ novo ou editado.
8. **Sem campo de parser na seguradora:** o parser XML é um só (`XmlIfxParser`). A `source` (`xml_porto`, `xml_azul`, `xml_itau`) sai de `Insurer.code`.
9. **`VEHICLE_NEEDS_REVIEW` não aceita o override presencial de gerente.** Os outros bloqueios HARD continuam aceitando.
10. **Revisão no Django admin:** as regras de família (`VehicleFamilyRule`) e as regras aprendidas (`VehicleAlias`) são revisadas lá, sem tela nova no ERP.
11. **Portas no casamento:** o número de portas (`4p`) continua como token de pontuação, porque distingue Gol 2p de 4p. A spec mandava remover.
12. **Hex das cores no backend:** fica em `COR_HEX`, servido pelo endpoint de cores e usado pelo PDF. O front não guarda cópia.
13. **`insurers/management/commands/load_insurers.py` é apagado:** conflita com o seed `0009` e todos os seus CNPJs próprios são inválidos.
14. **Fora deste plano:**
    - logos de montadora (Wikidata) e de seguradora (kit oficial ou Commons): coleta de arquivo com revisão humana, numa sessão própria. Até lá, o monograma cobre;
    - fallback Parallelum (`fipe_id` fica nullable para quando precisar);
    - relatório de acerto sobre a exportação do Box (projeto da migração).
15. **`ImportBudgetModal.tsx` está órfão** (nenhuma tela o renderiza). O select de seguradora dele passa a usar `/insurers/`, mas religar a importação na OS fica fora deste plano.
16. **Vínculo de seguradora desconhecida sem tela:** quando a importação para por seguradora desconhecida, o vínculo do texto a uma seguradora existente ganha endpoint (CONSULTANT+), mas não ganha tela, porque não existe tela de tentativas de importação.
17. **Casamento separado por domínio:** veículo, cor e combustível ficam em `vehicle_catalog`. `match_insurer` fica em `insurers/matching.py` e `match_municipio` em `lookups/municipios.py`, junto dos seus models.
18. **CEP do segurado:** o CEP que vem do Cilia é gravado como veio. A importação não dispara consulta externa; a cidade casa pelo nome, com `match_municipio`.
19. **Marca nunca é desativada pela carga FIPE:** `VehicleMake.is_active` fica só com o admin. A marca que some da fonte num mês fica sem família ativa (o Modelo dela sai vazio) e volta quando a fonte a traz de novo. A carga recusa (`ValueError`) dump com menos de 80% das versões ativas.

## Global Constraints

- Texto livre é proibido em montadora, modelo, versão, cor, combustível e seguradora. Nenhuma opção "Outro" ou "Não está na lista" reabre texto por outra porta.
- A placa só sugere: nunca bloqueia nem grava sozinha. Toda consulta nunca sobrescreve campo que o usuário já preencheu.
- Os selects funcionam sem rede externa. Uma API externa fora do ar nunca trava a tela.
- CPF, CNPJ, placa, chassi e RENAVAM nunca aparecem em log, em chave de cache ou em tabela pública em texto claro. A chave de cache é `lookup:{kind}:{sha256(chave)}`.
- **Timeouts:**
  - por provider, `httpx.Timeout(3.0, connect=1.5)`;
  - orçamento de 6 s por consulta;
  - sem retry em requisição de usuário.
- **Cache:** TTL de 180 dias (CEP), 30 (CNPJ) e 365 (placa); miss fica 1 dia.
- **Cota por minuto:** CNPJá 4, CNPJ.ws 2.
- O catálogo nunca apaga linha: o que sai da fonte vira `is_active=False`. FKs de OS e orçamento para o catálogo são `PROTECT`.
- **Multitenancy:** `vehicle_catalog`, `insurers` e `lookups` ficam em `SHARED_APPS` (public). Task Celery recebe `tenant_schema` e usa `schema_context`.
- **Backend:**
  - type hints em tudo;
  - `logger = logging.getLogger(__name__)`, nunca `print`;
  - nunca raw SQL;
  - nunca `except: pass`;
  - Black (linha 100) + isort;
  - permissões só via `PermissionsByActionMixin` (`write_permission`, `read_permission`, `write_actions`, `action_permissions`), nunca `get_permissions` à mão.
- **Front:**
  - TS strict, sem `any`;
  - toda resposta nova da API validada com Zod, nunca `as Type`;
  - três estados: Skeleton, erro e vazio;
  - `src/types/api.d.ts` só via `make gen-api-types`.
- **Testes backend:** `docker exec paddock_django pytest <caminho> -v`.
  - No container os settings são `dev`: chame task com `.run()`.
  - O cache é o Redis real: use `@override_settings(CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}})` nos testes de lookup.
  - Endpoint: `TenantTestCase` + `APIClient` com `client.defaults["SERVER_NAME"] = client.defaults["HTTP_HOST"] = self.domain.domain` e `force_authenticate(user, token={"role": "ADMIN"})` (modelo em `apps/vehicles/tests/test_api.py:12-30`).
- **Testes front:** o lint está quebrado. Use `cd apps/dscar-web && npm run typecheck && npx vitest run <arquivo>`.
- **Commits:** Conventional Commits em português, no imperativo (`feat(dscar): …`). Toda mensagem termina com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Override de gerente numa OS com veículo a confirmar:** `transition(..., force=True, manager_verified=True)` para `repair` continua recusando com `can_override: False`. O caminho de override hoje fura qualquer HARD (`services/order_service.py:379-403`). Teste na Task 9.
2. **OS já em produção que perde a versão:** um PATCH com `catalog_version: null` numa OS em `bodywork` religa o selo e bloqueia o próximo setor, sem mexer no status atual. Teste na Task 9.
3. **Rede fora do ar:** todos os providers levantando `httpx.ConnectTimeout` → 200 com `found: false`. O miss **não** vai para o cache (a próxima chamada tenta de novo), e nem a chave nem o hash aparecem no log. Teste na Task 12.
4. **Placa num formulário já meio preenchido:**
   - nunca troca o que o usuário escolheu;
   - o que ela preenche fica `dirty`. Hoje o `VehicleSection` perde o auto-preenchimento no PATCH (`DadosWorkspace.tsx:92-98`).

   Teste na Task 15.
5. **Versão FIPE que sai da fonte numa recarga:** a OS que aponta para ela continua abrindo, com `catalog_path` e snapshot, mas o seletor não a oferece mais. Testes nas Tasks 3 e 6.

---

# Parte 1 — Bases (sem API externa em runtime)

### Task 1: Normalização e enums do catálogo

**Files:**
- Create: `backend/core/apps/vehicle_catalog/normalize.py`
- Test: `backend/core/apps/vehicle_catalog/tests/test_normalize.py`

**Interfaces:**
- Produces:
  - `normalize_name(text: str) -> str`: maiúsculas, sem acento (NFKD), espaços colapsados, `strip`. Mantém pontuação.
  - `make_display_name(fipe_nome: str) -> str`.
  - `canonical_brand(text: str) -> str`: nome normalizado de exibição, depois do apelido.
  - `class TipoVeiculo(TextChoices)`: `CARRO="carro"`, `MOTO="moto"`, `CAMINHAO="caminhao"` (rótulo "Caminhão/ônibus"). Mais `TIPO_FROM_FIPEX: dict[str, TipoVeiculo]`, que mapeia `"caminhão"` para `CAMINHAO`.
  - `class Combustivel(TextChoices)`: `GASOLINA`, `ETANOL`, `FLEX`, `DIESEL`, `ELETRICO`, `HIBRIDO`, `GNV`, com valores em minúsculas. Mais `COMBUSTIVEL_FROM_SIGLA = {"g": GASOLINA, "e": ETANOL, "f": FLEX, "d": DIESEL, "l": ELETRICO, "h": HIBRIDO, "n": GNV}`.
  - `class CorVeiculo(TextChoices)`: valores `AMARELA AZUL BEGE BRANCA CINZA DOURADA GRENA LARANJA MARROM PRATA PRETA ROSA ROXA VERDE VERMELHA FANTASIA NAO_INFORMADA`, com rótulos "Amarela" … "Grená" … "Não informada".
  - `COR_HEX: dict[str, str]`: hex aproximado por valor. `NAO_INFORMADA` e `FANTASIA` ficam `""`.
  - `match_color(text: str) -> str | None`.
  - `match_fuel(text: str) -> str | None`.

- [ ] **Step 1: Escrever os testes**

```python
@pytest.mark.parametrize("raw,expected", [
    ("-PRETA", "PRETA"), ("Preto", "PRETA"), ("PRTA", "PRETA"), ("PRETRA", "PRETA"),
    ("PRATA METÁLICO", "PRATA"), ("BRANCO PÉROLA", "BRANCA"), ("Branco", "BRANCA"),
    ("GRAFITE", "CINZA"), ("CHUMBO", "CINZA"), ("VINHO", "GRENA"), ("BORDÔ", "GRENA"),
    ("CHAMPAGNE", "BEGE"), ("vermelho sólido", "VERMELHA"),
    ("XX", None), ("G7 1.0 FLEX 4P 1.0 12V FLEX", None), ("", None),
])
def test_match_color(raw, expected): assert match_color(raw) == expected

@pytest.mark.parametrize("raw,expected", [
    ("Gasolina/Alcool", "flex"), ("FLEXONE", "flex"), ("TOTAL FLEX", "flex"), ("G", "gasolina"),
    ("D", "diesel"), ("Die.", "diesel"), ("ÁLCOOL", "etanol"), ("GNV", "gnv"), ("xyz", None),
])
def test_match_fuel(raw, expected): assert match_fuel(raw) == expected

def test_normalize_name(): assert normalize_name("  Citroën  C4  ") == "CITROEN C4"

@pytest.mark.parametrize("fipe,display", [
    ("GM - Chevrolet", "Chevrolet"), ("VW - VolksWagen", "Volkswagen"), ("Kia Motors", "Kia"),
    ("Caoa Chery/Chery", "Chery"), ("MERCEDES-BENZ", "Mercedes-Benz"), ("HONDA", "Honda"),
    ("BMW", "BMW"), ("Land Rover", "Land Rover"),
])
def test_make_display_name(fipe, display): assert make_display_name(fipe) == display

@pytest.mark.parametrize("raw,canon", [
    ("VW", "VOLKSWAGEN"), ("GM", "CHEVROLET"), ("M.BENZ", "MERCEDES-BENZ"),
    ("MERCEDES", "MERCEDES-BENZ"), ("Chevrolet", "CHEVROLET"),
])
def test_canonical_brand(raw, canon): assert canonical_brand(raw) == canon
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `docker exec paddock_django pytest apps/vehicle_catalog/tests/test_normalize.py -v`
Expected: `ModuleNotFoundError: apps.vehicle_catalog.normalize`.

- [ ] **Step 3: Implementar `normalize.py`**

- **`make_display_name`:** procura primeiro em `MAKE_DISPLAY = {"GM - CHEVROLET": "Chevrolet", "VW - VOLKSWAGEN": "Volkswagen", "KIA MOTORS": "Kia", "CAOA CHERY/CHERY": "Chery"}`, pela chave normalizada. Se não estiver lá, usa `nome.title()` quando o nome está todo em maiúsculas e tem mais de 3 letras; senão, devolve o nome como veio.
- **`canonical_brand`:** usa `BRAND_ALIASES = {"VW": "VOLKSWAGEN", "GM": "CHEVROLET", "CHEV": "CHEVROLET", "M.BENZ": "MERCEDES-BENZ", "M BENZ": "MERCEDES-BENZ", "MB": "MERCEDES-BENZ", "MERCEDES": "MERCEDES-BENZ", "MERCEDES BENZ": "MERCEDES-BENZ", "LR": "LAND ROVER"}`. Se o texto não for apelido, devolve `normalize_name(make_display_name(text))`.
- **`match_color`, nesta ordem:**
  1. `normalize_name`, depois `lstrip("-")`;
  2. remove os sufixos `METALICO METALICA PEROLIZADO PEROLIZADA PEROLA SOLIDO SOLIDA FOSCO`;
  3. aplica a tabela `COLOR_EQUIV = {"PRTA": "PRETA", "PRETRA": "PRETA", "GRAFITE": "CINZA", "CHUMBO": "CINZA", "VINHO": "GRENA", "BORDO": "GRENA", "CHAMPAGNE": "BEGE"}`;
  4. troca o masculino pelo feminino (`PRETO BRANCO VERMELHO AMARELO ROXO DOURADO`);
  5. confere se o resultado pertence a `CorVeiculo.values`.
- **`match_fuel`:** procura token a token num dicionário, com os tokens sem pontuação (`Die.` vira `DIE`). `GASOLINA/ALCOOL`, `ALCOOL/GASOLINA` e `TOTAL FLEX` são tratados como `flex`.

- [ ] **Step 4: Rodar e ver passar** (mesmo comando, todos PASS).

- [ ] **Step 5: Commit** `feat(dscar): normalização e enums de cor, combustível e tipo do catálogo`

---

### Task 2: Models do catálogo (família, regras, unicidades novas)

**Files:**
- Modify: `backend/core/apps/vehicle_catalog/models.py`:
  - `VehicleMake` 26-47;
  - `VehicleModel` 50-70;
  - `VehicleYearVersion` 103-148.
- Create:
  - `backend/core/apps/vehicle_catalog/migrations/0007_catalogo_familia.py` (gerada);
  - `0008_seed_family_rules.py` (data).
- Create: `backend/core/apps/vehicle_catalog/tests/factories.py`
- Modify:
  - `backend/core/apps/vehicle_catalog/admin.py:11-37`;
  - `apps/parts_catalog/tests/factories.py:48-55`;
  - `apps/parts_catalog/views.py:94-109`.
- Test: `backend/core/apps/vehicle_catalog/tests/test_models.py`

**Interfaces:**
- Produces os models:
  - **`VehicleMake`:**
    - novos: `tipo`, que é CharField(10), choices `TipoVeiculo`, default `carro`; `display_name`, CharField(80); `is_active`, com default True; `fonte_ref`, CharField(7) com blank, no formato "2026-10";
    - `fipe_id` passa a `null=True, blank=True` e perde o unique;
    - `nome` perde o unique;
    - `UniqueConstraint(tipo, nome_normalizado)`.
  - **`VehicleFamily`:**
    - `make`, FK `VehicleMake` com PROTECT e `related_name="familias"`;
    - `nome`, CharField(80); `nome_normalizado`, CharField(80) com db_index; `is_active`; `fonte_ref`;
    - `UniqueConstraint(make, nome_normalizado)`.
  - **`VehicleFamilyRule`:**
    - `marca_nome_normalizado`, CharField(80): o nome FIPE da marca normalizado, para a regra existir antes da carga;
    - `tipo`;
    - `padrao`, CharField(200): regex aplicada com `re.match` ao nome FIPE normalizado da versão;
    - `familia`, CharField(80): aceita `\1`, expandido com `match.expand`;
    - `is_active`;
    - `clean()` valida que a regex compila.
  - **`VehicleModel`:**
    - novos: `tipo`; `codigo_fipe`, CharField(10); `familia`, FK `VehicleFamily` com PROTECT, null e `related_name="versoes_fipe"`; `is_active`; `fonte_ref`;
    - `fipe_id` passa a nullable;
    - sai o `unique_together (marca, fipe_id)`;
    - `UniqueConstraint(tipo, codigo_fipe)`.
  - **`VehicleYearVersion`:**
    - novos: `zero_km` (bool); `is_active`; `fonte_ref`;
    - `combustivel` passa a choices `Combustivel`;
    - `fipe_id` passa a nullable;
    - sai o `unique_together (modelo, fipe_id)`;
    - `UniqueConstraint(modelo, ano, combustivel)`;
    - zero km grava `ano=32000`, a convenção da FIPE;
    - property `label`: `"Zero km Flex"` quando é zero km, senão `"2025 Flex"`.
  - **FKs `marca` e `modelo` existentes:** passam de CASCADE a PROTECT.
- Produces, em `tests/factories.py`, `make_catalog(*, fipe_make: str = "GM - Chevrolet", tipo: str = "carro", family: str = "Onix Plus", model: str = "ONIX SED. Plus PREM. 1.0 12V TB Flex Aut", codigo: str = "004504-7", ano: int = 2025, combustivel: str = "flex", valor: Decimal = Decimal("98765.00"), zero_km: bool = False) -> VehicleYearVersion`. Usa `get_or_create`, para poder chamar várias vezes.

- [ ] **Step 1: Escrever os testes**

```python
class CatalogModelsTest(TestCase):
    def test_mesmo_nome_em_tipos_diferentes(self):
        VehicleMake.objects.create(tipo="carro", nome="Honda", nome_normalizado="HONDA", display_name="Honda")
        VehicleMake.objects.create(tipo="moto", nome="HONDA", nome_normalizado="HONDA", display_name="Honda")
        assert VehicleMake.objects.filter(nome_normalizado="HONDA").count() == 2

    def test_versao_unica_por_modelo_ano_combustivel(self):
        v = make_catalog()
        with pytest.raises(IntegrityError):
            VehicleYearVersion.objects.create(modelo=v.modelo, ano=2025, combustivel="flex", descricao="dup")

    def test_label_zero_km(self):
        assert make_catalog(codigo="004519-5", model="ONIX HATCH 1.0 12V Flex 5p Mec.",
                            family="Onix", ano=32000, zero_km=True).label == "Zero km Flex"

    def test_regra_com_regex_invalida_nao_valida(self):
        with pytest.raises(ValidationError):
            VehicleFamilyRule(marca_nome_normalizado="BMW", tipo="carro", padrao="^(", familia="x").full_clean()

    def test_seed_de_regras_existe(self):
        assert VehicleFamilyRule.objects.filter(marca_nome_normalizado="GM - CHEVROLET", padrao="^ONIX SED").exists()
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `docker exec paddock_django pytest apps/vehicle_catalog/tests/test_models.py -v`
Expected: `ImportError` (`VehicleFamily`, `make_catalog`).

- [ ] **Step 3: Implementar os models e gerar a migration 0007**

Run: `docker exec paddock_django python manage.py makemigrations vehicle_catalog -n catalogo_familia`.

Antes do `AddConstraint` de `(tipo, codigo_fipe)`, acrescente à 0007 um `RunPython` que preenche `VehicleModel.codigo_fipe`:
- com o `codigo_fipe` da primeira `versoes`;
- quando não houver, com `f"legacy-{pk}"`.

Isso garante que a constraint valha em bancos que já têm linhas. O reverse é noop.

- [ ] **Step 4: Escrever a 0008 (seed de regras de família)**

Siga o padrão de `apps/insurers/migrations/0009_seed_cilia_insurers.py`, com `get_or_create` por `(marca_nome_normalizado, tipo, padrao)`. Todas as regras são do tipo `carro`.

| marca_nome_normalizado | padrao | familia |
|---|---|---|
| GM - CHEVROLET | `^ONIX SED` | Onix Plus |
| FIAT | `^GRAND SIENA` | Grand Siena |
| SUZUKI | `^GRAND VITARA` | Grand Vitara |
| JEEP | `^GRAND CHEROKEE` | Grand Cherokee |
| CITROEN | `^GRAND C4` | Grand C4 |
| CHRYSLER | `^GRAND CARAVAN` | Grand Caravan |
| DODGE | `^GRAND CARAVAN` | Grand Caravan |
| TOYOTA | `^COROLLA CROSS` | Corolla Cross |
| TOYOTA | `^YARIS CROSS` | Yaris Cross |
| MITSUBISHI | `^PAJERO SPORT` | Pajero Sport |
| MITSUBISHI | `^ECLIPSE CROSS` | Eclipse Cross |
| MITSUBISHI | `^OUTLANDER (SPORT\|SP)\b` | Outlander Sport |
| LAND ROVER | `^(NEW )?RANGE.*EVOQUE` | Range Rover Evoque |
| LAND ROVER | `^(NEW )?RANGE.*VELAR` | Range Rover Velar |
| LAND ROVER | `^(NEW )?RANGE.*SPORT` | Range Rover Sport |
| LAND ROVER | `^(NEW )?RANGE` | Range Rover |
| LAND ROVER | `^DISC.*SPORT` | Discovery Sport |
| LAND ROVER | `^DISC` | Discovery |
| LAND ROVER | `^DEF` | Defender |
| LAND ROVER | `^FREELANDER` | Freelander |
| BMW | `^(\d)\d\d` | Série \1 |
| MERCEDES-BENZ | `^CLASSE (\w+)` | Classe \1 |
| MERCEDES-BENZ | `^(A\|B\|C\|E\|S\|G\|CLA\|CLS\|CLK\|CL\|GLA\|GLB\|GLC\|GLE\|GLS\|GLK\|GL\|ML\|SLK\|SLC\|SL)-?\d` | Classe \1 |

- [ ] **Step 5: Admin e `parts_catalog`**

- **Admin:**
  - registrar `VehicleFamily` (busca por `nome`, filtro `make__tipo`);
  - registrar `VehicleFamilyRule`, com `list_display` dos quatro campos e edição na lista;
  - incluir `tipo` e `is_active` nos admins de Make, Model e YearVersion.
- **`parts_catalog`:**
  - a factory (`:48-55`) passa `defaults={"tipo": "carro", "display_name": ...}`;
  - `views.py:94-109` acrescenta `tipo="carro"` ao `filter(nome__icontains=...)`.

- [ ] **Step 6: Rodar os testes**

Run: `docker exec paddock_django pytest apps/vehicle_catalog apps/parts_catalog apps/vehicles -v`
Expected: PASS. `test_fipe_sync.py` ainda passa até a Task 3, que o remove.

- [ ] **Step 7: Commit** `feat(dscar): família, regras e unicidades novas no catálogo FIPE`

---

### Task 3: Carga mensal do fipeX (`sync_fipe_catalog`)

**Files:**
- Create:
  - `backend/core/apps/vehicle_catalog/fipe_sync.py`;
  - `management/commands/sync_fipe_catalog.py`.
- Replace: `backend/core/apps/vehicle_catalog/tasks.py`. As três tasks `/cars` saem e entra só a nova.
- Delete:
  - `apps/vehicle_catalog/utils.py`: o único importador é o `tasks.py` antigo; confirme com `rg normalizar_texto apps/vehicle_catalog`;
  - `apps/vehicle_catalog/tests/test_fipe_sync.py`.
- Modify: `backend/core/config/settings/base.py:235-275` (`CELERY_BEAT_SCHEDULE`).
- Create: `backend/core/apps/vehicle_catalog/tests/fixtures/fipex_2026_10_sample.tsv`
- Test: `backend/core/apps/vehicle_catalog/tests/test_fipe_sync.py` (novo)

**Interfaces:**
- Consumes: `normalize_name`, `make_display_name`, `TIPO_FROM_FIPEX` e `COMBUSTIVEL_FROM_SIGLA` (Task 1); os models da Task 2.
- Produces:
  - `FIPEX_URL = "https://huggingface.co/datasets/alanwgt/fipex-veiculos-brasil/resolve/main/{ano}/{mes:02d}/fipex-prices.csv"`;
  - `derive_family(fipe_make: str, fipe_model: str, rules: Sequence[VehicleFamilyRule]) -> str`, que devolve o nome de exibição da família;
  - `download_fipex(ano: int, mes: int, dest: Path) -> bool`: faz stream com `httpx`, timeout de 60 s, e devolve `False` em 404;
  - `load_fipex(path: Path, *, ref: str) -> SyncReport`;
  - `@dataclass SyncReport`: os campos `makes`, `families`, `models` e `versions` são `dict[str, int]` com as chaves `upserted` e `deactivated`. Também tem `single_version_families: list[str]`;
  - a task `@shared_task(bind=True, name="vehicle_catalog.sync_fipe_catalog", max_retries=3, default_retry_delay=600) def task_sync_fipe_catalog(self, tenant_schema: str = "public") -> dict[str, int]`.

- [ ] **Step 1: Gerar a fixture a partir do dump real**

Baixe o dump `2026/10` (TSV) para fora do repo e filtre:
- famílias `(nome_marca, 1º token normalizado)`:
  - `GM - Chevrolet`: `ONIX`, `MONTANA`;
  - `Honda`: `FIT`, `HR-V`;
  - `VW - VolksWagen`: `GOL`, `VIRTUS`;
  - `Hyundai`: `HB20X`;
  - `Nissan`: `KICKS`;
  - `Mercedes-Benz`: `SPRINTER`;
  - `HONDA`: `POP`;
  - `Toyota`: `COROLLA`;
- anos `{2013, 2018, 2019, 2020, 2021, 2023, 2025}` e as linhas `zero_km=true`.

Ficam cerca de 770 linhas e 88 KB, com o mesmo cabeçalho de 12 colunas.

```bash
curl -sL -o /tmp/fipex.tsv https://huggingface.co/datasets/alanwgt/fipex-veiculos-brasil/resolve/main/2026/10/fipex-prices.csv
```

O filtro é um script Python de poucas linhas com `csv.DictReader(delimiter="\t")`. A fixture precisa conter os códigos:
- `004504-7`, `004516-0`, `004499-7` (Onix);
- `004546-2`, `004541-1` (Montana);
- `014056-2` (Fit);
- `005275-2`, `005339-2`, `005317-1`, `005345-7` (Gol);
- `015097-5` (HB20X);
- `005486-0` (Virtus);
- `023158-4`, `023156-8` (Kicks);
- `021506-6`, `021501-5` (Sprinter);
- `811132-4` (Pop);
- `002111-3`, `002201-2` (Corolla e Corolla Cross);
- `004519-5` (zero km).

Confira com `grep -c`.

Acrescente a `tests/factories.py`:
- `SAMPLE = Path(__file__).parent / "fixtures" / "fipex_2026_10_sample.tsv"`, que as Tasks 6, 10, 11 e 14 reutilizam;
- `sample_without(codigo: str) -> Path`, que grava num `tempfile` uma cópia da fixture sem as linhas daquele código.

- [ ] **Step 2: Escrever os testes**

```python
RULES = lambda: list(VehicleFamilyRule.objects.filter(is_active=True))  # seed da 0008

@pytest.mark.parametrize("make,model,fam", [
    ("GM - Chevrolet", "ONIX HATCH LT 1.0 12V Flex 5p Mec.", "Onix"),
    ("GM - Chevrolet", "ONIX SED. Plus PREM. 1.0 12V TB Flex Aut", "Onix Plus"),
    ("GM - Chevrolet", "MONTANA RS 1.2 Turbo Flex 12V Aut.", "Montana"),
    ("Mercedes-Benz", "Sprinter 517 VAN E.L.T.A. 18L Die (E6)", "Sprinter"),
    ("Fiat", "Grand Siena 1.0 EVO Flex 8V 4p", "Grand Siena"),
    ("Honda", "HR-V Advance 1.5  Flex TB 16V 5p Aut.", "HR-V"),
    ("VW - VolksWagen", "T-Cross 1.0 TSI Flex 12V 5p Mec.", "T-Cross"),
    ("VW - VolksWagen", "Gol (novo) 1.0 Mi Total Flex 8V 4p", "Gol"),
    ("VW - VolksWagen", "New Beetle 2.0 Mi Mec./Aut.", "Beetle"),
    ("Hyundai", "HB20X Premium 1.6 Flex 16V Aut.", "HB20X"),
    ("Land Rover", "Range Rover EVOQUE HSE 2.0 Diesel Aut.", "Range Rover Evoque"),
    ("BMW", "320iA", "Série 3"),
    ("HONDA", "POP 110i", "Pop"),
])
@pytest.mark.django_db
def test_derive_family(make, model, fam): assert derive_family(make, model, RULES()) == fam

def test_derive_family_sem_regra_pega_primeiro_termo():
    assert derive_family("Fiat", "Grand Siena 1.0 EVO Flex 8V 4p", []) == "Grand"

class LoadFipexTest(TestCase):
    def test_carga_cria_tudo(self):
        rep = load_fipex(SAMPLE, ref="2026-10")
        v = VehicleYearVersion.objects.get(modelo__codigo_fipe="004504-7", ano=2025)
        assert v.combustivel == "flex" and v.modelo.familia.nome == "Onix Plus"
        assert v.modelo.marca.display_name == "Chevrolet" and v.valor_referencia > 0
        assert VehicleYearVersion.objects.get(modelo__codigo_fipe="004519-5", zero_km=True).ano == 32000
        assert VehicleModel.objects.get(codigo_fipe="811132-4").tipo == "moto"
        assert rep.versions["upserted"] == sum(1 for _ in open(SAMPLE)) - 1

    def test_recarga_nao_duplica(self):
        load_fipex(SAMPLE, ref="2026-10"); n = VehicleYearVersion.objects.count()
        load_fipex(SAMPLE, ref="2026-11"); assert VehicleYearVersion.objects.count() == n

    def test_item_removido_vira_inativo_e_continua_legivel(self):
        load_fipex(SAMPLE, ref="2026-10")
        load_fipex(sample_without("005275-2"), ref="2026-11")
        m = VehicleModel.objects.get(codigo_fipe="005275-2")
        assert m.is_active is False and not m.versoes.filter(is_active=True).exists()
        assert m.familia.is_active is True        # Gol segue ativo pelas outras versões

    def test_make_desativada_pelo_admin_continua_desativada(self):
        load_fipex(SAMPLE, ref="2026-10"); VehicleMake.objects.filter(nome="Nissan").update(is_active=False)
        load_fipex(SAMPLE, ref="2026-11"); assert not VehicleMake.objects.get(nome="Nissan").is_active
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `docker exec paddock_django pytest apps/vehicle_catalog/tests/test_fipe_sync.py -v` → ImportError.

- [ ] **Step 4: Implementar `fipe_sync.py`**

**`derive_family`:**
1. `n = normalize_name(fipe_model)`;
2. aplica as regras ativas da marca (`normalize_name(fipe_make)`) e do tipo, ordenadas por `len(padrao)` decrescente; na primeira que casar, devolve `m.expand(rule.familia)`;
3. sem regra, separa os tokens de `n`; enquanto houver mais de um, remove `NOVO`, `NOVA` e `NEW` do começo; remove o 1º token se ele for uma palavra do nome da marca;
4. pega `tok = re.split(r"[/.]", toks[0])[0] or toks[0]`;
5. devolve o rótulo de exibição:
   - com dígito, fica como está;
   - senão, capitaliza cada parte separada por `-`; quando o token tem `-`, as partes de até 2 letras ficam em maiúsculas (`HR-V`, `T-Cross`).

**`load_fipex`:** lê o TSV inteiro com `csv.DictReader(delimiter="\t")` e agrupa em memória. São cerca de 51 mil linhas e 11 mil modelos, o que cabe nos 250 MB do worker. O upsert é sempre `bulk_create(update_conflicts=True, unique_fields=..., update_fields=...)`, em lotes de 2.000.
1. **Makes:** chave `(tipo, nome_normalizado)`. `update_fields` = `nome, display_name, fonte_ref`. O `is_active` não entra, para preservar o que o admin desativou.
2. **Famílias:** derivadas por modelo. Chave `(make, nome_normalizado)`, com `update_fields` = `nome, fonte_ref, is_active`.
3. **Modelos:** chave `(tipo, codigo_fipe)`, com `update_fields` = `marca, familia, nome, nome_normalizado, fonte_ref, is_active`.
4. **Ano-versões:** chave `(modelo, ano, combustivel)`. Zero km grava `ano=32000`. `valor_referencia = Decimal(valor_centavos) / 100`; `descricao = label`; `codigo_fipe` também é gravado.
5. **Desativação:** em cada tabela, `filter(is_active=True).exclude(fonte_ref=ref).update(is_active=False)`. Sem `IN` gigante. As famílias sem modelo ativo também viram `is_active=False`.
6. **`single_version_families`:** famílias ativas com exatamente 1 modelo ativo.

**Command:**
- aceita `--file PATH` ou `--month YYYY-MM`; o padrão é o mês corrente e, se der 404, o mês anterior;
- baixa para um `tempfile`;
- imprime as contagens, mais `single_version_families` (quantidade e as 50 primeiras) para revisão.

**Task:** `with schema_context(tenant_schema): call_command("sync_fipe_catalog")`. Erro de rede vai para `self.retry(exc=exc)`.

**Beat:**

```python
"vehicle-catalog-sync-fipe": {
    "task": "vehicle_catalog.sync_fipe_catalog",
    "schedule": crontab(hour=4, minute=0, day_of_month=5),
    "kwargs": {"tenant_schema": "public"},
},
```

- [ ] **Step 5: Rodar e ver passar**

Run: `docker exec paddock_django pytest apps/vehicle_catalog -v` → PASS.

Depois carregue o dev de verdade com `docker exec paddock_django python manage.py sync_fipe_catalog`.
Expected: aproximadamente 240 makes, 2.300 famílias, 11.400 modelos e 51.200 versões.

- [ ] **Step 6: Commit** `feat(dscar): carga mensal do catálogo FIPE completo a partir do fipeX`

---

### Task 4: App `lookups`: validadores e municípios

**Files:**
- Create:
  - `backend/core/apps/lookups/{__init__,apps}.py`;
  - `validators.py`;
  - `models.py` (`Municipio`);
  - `municipios.py`;
  - `data/municipios.json`;
  - `migrations/0001_initial.py` e `0002_load_municipios.py`;
  - `management/commands/load_municipios.py`;
  - `urls.py`, `views.py`;
  - `tests/`.
- Modify:
  - `config/settings/base.py:40-46`: adicionar `"apps.lookups"` ao fim dos apps Paddock em `SHARED_APPS`;
  - `config/urls.py:18-45`: adicionar `path("api/v1/lookups/", include("apps.lookups.urls"))`.
- Modify (validadores nos serializers):
  - `apps/persons/serializers.py:99-120` (`PersonDocumentWriteSerializer.validate_value`);
  - `apps/customers/serializers.py:185-197`;
  - `apps/hr/serializers.py:302-310`.
- Test:
  - `apps/lookups/tests/test_validators.py`;
  - `test_municipios.py`.

**Interfaces:**
- Produces, em `validators.py` (funções puras):
  - `only_digits(s: str) -> str`;
  - `is_valid_cpf(v: str) -> bool`;
  - `is_valid_cnpj(v: str) -> bool`: aceita o formato alfanumérico `^[0-9A-Z]{12}[0-9]{2}$`, com módulo 11 sobre `ord(c) - 48`;
  - `clean_cnpj(v: str) -> str`: tira pontuação e passa para maiúsculas;
  - `is_valid_plate(v: str) -> bool`: placa antiga e Mercosul, sem hífen;
  - `normalize_plate(v: str) -> str`;
  - `is_valid_renavam(v: str) -> bool`;
  - `is_valid_vin(v: str) -> bool`: 17 caracteres, sem I, O e Q;
  - `decode_vin(v: str) -> VinInfo(wmi: str, make_hint: str | None, model_year: int | None)`.
- Produces o model `Municipio`: `codigo_ibge` CharField(7) como pk, `nome`, `nome_normalizado` (db_index) e `uf` CharField(2) (db_index).
- Produces `match_municipio(nome: str, uf: str) -> Municipio | None`, que compara pelo nome normalizado dentro da UF.
- Produces o endpoint `GET /api/v1/lookups/municipios/?uf=AM&search=man`: lista paginada de `{codigo_ibge, nome, uf}`, com permissão `IsAuthenticated`.

- [ ] **Step 1: Escrever os testes**

```python
@pytest.mark.parametrize("v,ok", [("52998224725", True), ("529.982.247-25", True),
                                  ("52998224724", False), ("11111111111", False), ("", False)])
def test_cpf(v, ok): assert is_valid_cpf(v) is ok

@pytest.mark.parametrize("v,ok", [("11222333000181", True), ("11.222.333/0001-81", True),
    ("12ABC34501DE35", True), ("12.ABC.345/01DE-35", True), ("12ABC34501DE36", False),
    ("33055146000193", True), ("61198164001142", False), ("00000000000000", False)])
def test_cnpj(v, ok): assert is_valid_cnpj(v) is ok

@pytest.mark.parametrize("v,ok", [("ABC1234", True), ("ABC1D23", True), ("abc-1d23", True),
                                  ("PHO0000", True), ("AB1234", False), ("ABCD123", False)])
def test_plate(v, ok): assert is_valid_plate(v) is ok

def test_renavam(): assert is_valid_renavam("12345678900") and not is_valid_renavam("12345678901")

def test_vin():
    assert is_valid_vin("8AC907655SE254082") and not is_valid_vin("8AC907655SE25408I")
    info = decode_vin("8AC907655SE254082")
    assert info.make_hint == "MERCEDES-BENZ" and info.model_year == 2025

class MunicipioTest(TestCase):
    def test_seed_tem_manaus(self): assert Municipio.objects.get(codigo_ibge="1302603").nome == "Manaus"
    def test_match_sem_acento(self): assert match_municipio("sao paulo", "SP").codigo_ibge == "3550308"
    def test_match_uf_errada(self): assert match_municipio("Manaus", "PA") is None
```

Acrescente também:
- um teste do command `load_municipios --from-ibge` com `respx`, usando um payload de dois municípios em que um tem `"microrregiao": null` e a UF só em `regiao-imediata.regiao-intermediaria.UF.sigla`;
- um teste de API (`TenantTestCase`): `GET /api/v1/lookups/municipios/?uf=AM&search=manaus` devolve `1302603`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `docker exec paddock_django pytest apps/lookups -v`.

- [ ] **Step 3: Implementar**

**Validadores:**
- CPF e CNPJ seguem módulo 11 padrão. No CNPJ, os pesos são `5,4,3,2,9,8,7,6,5,4,3,2` e, para o 2º dígito, `6` + esses pesos. Resto menor que 2 dá DV 0.
- RENAVAM: inverte os 10 primeiros dígitos, aplica os pesos `2,3,4,5,6,7,8,9,2,3`, calcula `(soma*10) % 11` e troca 10 por 0.
- `decode_vin`:
  - o ano vem do 10º caractere: `A-H` = 1980/2010…, `J-N`, `P`, `R-T`, `V-Y`, `1-9`; vale o maior candidato que não passe do ano corrente + 1;
  - `WMI_MAKES` só com WMIs conferidos: `9BW` VOLKSWAGEN, `9BG` CHEVROLET, `9BD` FIAT, `93H` HONDA, `9C2` HONDA, `9BR` TOYOTA, `8AJ` TOYOTA, `94D` NISSAN, `93Y` RENAULT, `9BF` FORD, `8AF` FORD, `8AC` MERCEDES-BENZ, `9BM` MERCEDES-BENZ, `8AP` FIAT, `935` CITROEN, `936` PEUGEOT, `8AD` PEUGEOT, `988` JEEP, `9C6` YAMAHA, `3VW` VOLKSWAGEN, `WVW` VOLKSWAGEN, `WBA` BMW, `WDD` MERCEDES-BENZ, `SAL` LAND ROVER, `KMH` HYUNDAI, `KNA` KIA, `JHM` HONDA;
  - WMI desconhecido dá `make_hint=None`.

**Municípios:**
- `data/municipios.json` é a lista `[{codigo_ibge, nome, uf}]` dos 5.571 municípios.
- Gere o arquivo com `load_municipios --from-ibge --dump`, que faz GET em `https://servicodados.ibge.gov.br/api/v1/localidades/municipios` e lê a UF por `microrregiao.mesorregiao.UF.sigla`, com fallback em `regiao-imediata.regiao-intermediaria.UF.sigla`.
- A `0002` carrega o JSON com `bulk_create(update_conflicts=True)`, para todo ambiente ter a tabela sem rede no boot.
- Sem `--from-ibge`, o command faz upsert a partir do JSON.

**Serializers:**
- `validate_value` rejeita CPF ou CNPJ com DV inválido, conforme o `doc_type`, com a mensagem "CPF inválido." ou "CNPJ inválido.";
- `customers` e `hr` passam a chamar `is_valid_cpf` além do comprimento;
- os commands de ETL não mudam.

- [ ] **Step 4: Rodar**

Run: `docker exec paddock_django pytest apps/lookups apps/persons apps/customers apps/hr -v` → PASS.

Se algum teste antigo usa CPF inventado, troque por `52998224725`.

- [ ] **Step 5: Commit** `feat(dscar): app lookups com validadores de documento e tabela de municípios do IBGE`

---

### Task 5: Seguradoras — vários CNPJs e casamento único

**Files:**
- Modify: `apps/insurers/models.py:14-75`
- Create: `apps/insurers/migrations/0010_insurer_cnpjs_susep.py` (gerada) e `0011_seed_cnpjs.py` (data).
- Create: `apps/insurers/matching.py`
- Modify: `apps/insurers/serializers.py:13-55`.
- Delete: `apps/insurers/management/commands/load_insurers.py`.
- Test: `apps/insurers/tests/test_matching.py`, `test_serializer.py`

**Interfaces:**
- Produces no model `Insurer`:
  - `cnpjs: ArrayField(CharField(14), default=list, blank=True)`, só com dígitos, incluindo o principal; o `save()` garante `only_digits(self.cnpj)` dentro da lista;
  - `susep_code: CharField(10, null=True, blank=True, unique=True)`.
- Produces `match_insurer(*, cnpj: str = "", name: str = "", code: str = "") -> Insurer | None`. Considera só seguradoras ativas e para no primeiro acerto:
  1. `code` exato;
  2. CNPJ exato em `cnpjs`;
  3. raiz de 8 dígitos, mas só se exatamente uma seguradora tiver aquela raiz;
  4. `normalize_name(name)` igual a um item normalizado de `trade_names`, ou a `name` ou `trade_name`.
- Produces no `InsurerSerializer`: expõe `code` (read_only), `trade_names`, `cnpjs` e `susep_code`. O DV é validado só quando o CNPJ é novo ou mudou.
- Produces no `InsurerMinimalSerializer`, o da lista: `code` e `cnpjs` (read_only). Os selects do front precisam deles (Tasks 11 e 20).

- [ ] **Step 1: Escrever os testes**

```python
class MatchInsurerTest(TestCase):
    @classmethod
    def setUpTestData(cls):  # o seed 0009 + 0011 já roda nas migrations
        cls.porto = Insurer.objects.get(code="porto"); cls.azul = Insurer.objects.get(code="azul")

    def test_cnpj_exato_do_cilia(self): assert match_insurer(cnpj="33055146000193").code == "bradesco"
    def test_cnpj_formatado(self): assert match_insurer(cnpj="33.164.021/0001-00").code == "tokio"
    def test_raiz_unica_cobre_filial(self): assert match_insurer(cnpj="61550141000107").code == "yelum"
    def test_raiz_compartilhada_nao_casa(self): assert match_insurer(cnpj="61198164009999") is None
    def test_raiz_compartilhada_cai_no_nome(self):
        assert match_insurer(cnpj="61198164009999", name="AZUL SEGUROS").code == "azul"
    def test_nome_sem_acento_e_caixa(self): assert match_insurer(name="yelum seguradora").code == "yelum"
    def test_codigo(self): assert match_insurer(code="hdi").code == "hdi"
    def test_inativa_ignorada(self):
        Insurer.objects.filter(code="suhai").update(is_active=False)
        assert match_insurer(code="suhai") is None
```

Os testes do serializer:
- `test_cnpj_novo_invalido_400`: um POST com `61198164001142` dá erro em `cnpj`;
- `test_seed_invalido_editado_em_outro_campo_ok`: um PATCH só de `brand_color` na Azul é válido.

- [ ] **Step 2: Rodar e ver falhar**

Run: `docker exec paddock_django pytest apps/insurers -v`.

- [ ] **Step 3: Implementar**

A 0011 preenche `cnpjs` de todas as seguradoras com os dígitos do `cnpj` e acrescenta os que já aparecem nas fontes:
- `bradesco` += `33055146000193`;
- `yelum` += `61550141009129`;
- `hdi` += `29980158007593`.

O reverse é noop.

`match_insurer` carrega `list(Insurer.objects.filter(is_active=True))` e casa em Python. São cerca de 15 linhas: `# ponytail: varredura em memória; índice GIN em cnpjs se passar de algumas centenas`.

- [ ] **Step 4: Rodar** (mesmo comando → PASS)

- [ ] **Step 5: Commit** `feat(dscar): seguradora com vários CNPJs e casamento por CNPJ, raiz e nome`

---

# Parte 2 — Catálogo na API e no registro

### Task 6: API de leitura do catálogo

**Files:**
- Modify:
  - `apps/vehicle_catalog/views.py`: `VehicleMakeViewSet` 456-500 e `VehicleModelViewSet` 503-529;
  - `serializers.py`;
  - `urls.py:14-22`.
- Create: `apps/vehicle_catalog/snapshot.py`
- Test: `apps/vehicle_catalog/tests/test_catalog_api.py`, `test_snapshot.py`

**Interfaces:**
- Produces os endpoints, todos paginados (`StandardPagination`, `?page_size=` até 200), com `read_permission = IsAuthenticated` e `filter_backends = [DjangoFilterBackend, SearchFilter]`. Cada um mostra só `is_active=True`, exceto o primeiro com `include_inactive=true` para ADMIN+.
  - `GET /api/v1/vehicle-catalog/makes/?tipo=carro&search=chev[&include_inactive=true]`:
    - devolve `{id, label, nome, tipo, logo_url, is_active}`, em que `label` é `display_name`;
    - ordena por `display_name`.
  - `GET /families/?marca=<id>&search=` devolve `{id, label, marca}`.
  - `GET /models/?familia=<id>&ano=2025&search=lt 1.0 turbo`:
    - devolve `{id, label, codigo_fipe, familia}`, em que `label` é `nome`;
    - `ano` filtra modelos com versão ativa naquele ano;
    - a busca usa `nome` e `nome_normalizado`;
    - o `SearchFilter` exige todas as palavras, o que cobre a busca por palavras soltas.
  - `GET /years/?modelo=<id>`:
    - devolve `{id, label, ano, zero_km, combustivel, combustivel_label, valor_referencia}`;
    - ordena por `-ano`.
  - `PATCH /makes/{id}/` (`{is_active}`) e `PATCH /makes/{id}/logo/` exigem `IsAdminOrAbove` (`write_actions = ("partial_update", "logo")`, `write_permission = IsAdminOrAbove`).
- Produces em `snapshot.py`:
  - `catalog_path(*, make: VehicleMake | None = None, family: VehicleFamily | None = None, version: VehicleYearVersion | None = None) -> dict | None`:
    - devolve `{"tipo", "make": {id, label, logo_url}, "family": {id, label} | None, "model": {id, label} | None, "version": {id, label} | None}`;
    - deriva de baixo para cima (version → model → family → make);
    - mostra a linha mesmo inativa.
  - `@dataclass(frozen=True) VehicleSnapshot(make: str, make_logo: str, model: str, version: str, year: int | None, zero_km: bool, fuel_type: str, fipe_value: Decimal | None)`, com a property `description` = `" ".join(make, model, version)`.
  - `build_snapshot(family: VehicleFamily | None, version: VehicleYearVersion | None) -> VehicleSnapshot`:
    - `model` é o nome da família; `version` é `VehicleModel.nome`;
    - `year` é o ano, ou o ano corrente quando é zero km;
    - `fuel_type` é o rótulo do combustível.
  - `resolve_family(family, version) -> VehicleFamily | None`: quando há versão, vale `version.modelo.familia`.
- **Mantidas:** as actions antigas `makes/{id}/models/` e `models/{id}/years/` continuam até a Task 18. Só `logo` muda de permissão.

- [ ] **Step 1: Escrever os testes** (`TenantTestCase`; os dados vêm de `load_fipex(SAMPLE, ref="2026-10")` no `setUpTestData`)

```python
def test_makes_filtra_tipo_e_pagina(self):
    r = self.client.get("/api/v1/vehicle-catalog/makes/?tipo=moto")
    assert {m["label"] for m in r.data["results"]} == {"Honda"}
def test_busca_versao_por_palavras_soltas(self):
    fam = VehicleFamily.objects.get(nome="Onix Plus")
    r = self.client.get(f"/api/v1/vehicle-catalog/models/?familia={fam.id}&ano=2025&search=prem tb")
    assert [m["codigo_fipe"] for m in r.data["results"]] == ["004504-7"]
def test_inativo_some_da_lista_mas_path_funciona(self):
    v = VehicleYearVersion.objects.get(modelo__codigo_fipe="005275-2", ano=2013)
    VehicleModel.objects.filter(pk=v.modelo_id).update(is_active=False)
    r = self.client.get(f"/api/v1/vehicle-catalog/models/?familia={v.modelo.familia_id}")
    assert "005275-2" not in {m["codigo_fipe"] for m in r.data["results"]}
    assert catalog_path(version=v)["model"]["label"].startswith("Gol (novo)")
def test_logo_exige_admin(self):
    self._auth("MANAGER"); mk = VehicleMake.objects.first()
    assert self.client.patch(f"/api/v1/vehicle-catalog/makes/{mk.id}/logo/", {"logo_url": "x"}).status_code == 403
def test_include_inactive_so_admin(self): ...  # CONSULTANT com include_inactive=true não vê inativa
```

`test_snapshot.py`:
- `build_snapshot(fam, v)` para `004504-7` em 2025 dá `make == "Chevrolet"`, `model == "Onix Plus"`, `version == "ONIX SED. Plus PREM. 1.0 12V TB Flex Aut"`, `year == 2025`, `fuel_type == "Flex"`;
- com zero km, `year == timezone.localdate().year`;
- `build_snapshot(fam, None)` dá `version == ""` e `year is None`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `docker exec paddock_django pytest apps/vehicle_catalog/tests/test_catalog_api.py apps/vehicle_catalog/tests/test_snapshot.py -v`.

- [ ] **Step 3: Implementar**

- `ReadOnlyModelViewSet` + `UpdateModelMixin` só em makes.
- Use `filterset_fields` com os nomes reais dos campos (`marca`, `familia`, `modelo`, `tipo`).
- O `ano` dos modelos e o `include_inactive` ficam em `get_queryset`.
- Retire o cache `vehicle_models:make:{pk}`, que ninguém invalida.

- [ ] **Step 4: Rodar** (PASS)

- [ ] **Step 5: Commit** `feat(dscar): API paginada do catálogo por tipo, família, versão e ano`

---

### Task 7: OS, orçamento e veículo gravam o catálogo (fase de transição)

Nesta task as FKs passam a ser aceitas e derivam o snapshot. O texto livre continua aceito quando a FK não vem, para as telas atuais seguirem funcionando. As Tasks 16 e 17 fecham o texto.

**Files:**
- Modify: `apps/service_orders/models/service_order.py:242-281`
  - Novos campos:
    - `catalog_family`: FK `vehicle_catalog.VehicleFamily`, PROTECT, null, `related_name="+"`;
    - `catalog_version`: FK `vehicle_catalog.VehicleYearVersion`, PROTECT, null, `related_name="+"`;
    - `vehicle_needs_review`: bool, default False, `db_index`;
    - `vehicle_source`: CharField(20), blank;
    - `vehicle_source_text`: CharField(300), blank;
    - `year_manufacture`: PositiveSmallIntegerField, null;
    - `zero_km`: bool;
    - `insurer_cnpj`: CharField(14), blank.
  - **Remove:** `vehicle_make_id`, `vehicle_model_id`, `vehicle_year_version_id` (260-274).
- Modify: `apps/budgets/models.py:18-62`
  - Novos campos: `catalog_family`, `catalog_version`, `vehicle_needs_review`, `vehicle_year_manufacture` e `vehicle_zero_km`.
  - `vehicle_description` passa a `blank=True`.
- Modify: `apps/vehicles/models.py`
  - Novo campo: `family`, FK PROTECT null.
  - `chassis` e `renavam` passam a `EncryptedCharField` (de `encrypted_model_fields.fields`), em três passos: adicionar `_enc`, copiar e remover/renomear.
- Create: `apps/service_orders/services/vehicle.py`
- Modify:
  - `apps/service_orders/serializers/core.py`: Create 630-769 e Update 772-870;
  - Detail 517-627: `catalog_path`.
- Modify:
  - `apps/service_orders/services/order_service.py`: create 42-90, update 92-316 (FIELD_GROUPS 163-167, propagação 304-314);
  - `services/versioning_service.py:404-428` (`create_from_budget`).
- Modify:
  - `apps/budgets/serializers.py:87-120`;
  - `apps/budgets/services.py`: create 38-75 e clone 192-215;
  - `apps/vehicles/serializers.py`.
- Modify: `apps/service_orders/views/orders.py:316-321`: tirar a placa da mensagem de log.
- Test:
  - `apps/service_orders/tests/test_catalog_vehicle.py`;
  - `apps/budgets/tests/test_catalog_vehicle.py`;
  - `apps/vehicles/tests/test_api.py` (ajuste).

**Interfaces:**
- Consumes: `build_snapshot`, `resolve_family` e `catalog_path` (Task 6); `make_catalog` (Task 2).
- Produces:
  - `apply_catalog_vehicle(order: ServiceOrder, *, family: VehicleFamily | None, version: VehicleYearVersion | None, needs_review: bool | None = None, source: str = "", source_text: str = "") -> None`. Não salva. Grava:
    - `catalog_family = resolve_family(...)`;
    - `catalog_version`;
    - os campos do snapshot: `make`, `make_logo`, `model`, `vehicle_version`, `year`, `zero_km`, `fuel_type`, `fipe_value` e `vehicle_fipe_value_snapshot`;
    - `vehicle_needs_review = needs_review if needs_review is not None else version is None`;
    - `vehicle_source` e `vehicle_source_text`, só quando informados.
  - Na API de OS (create e update), os campos graváveis `catalog_family` e `catalog_version` (só ativos) e `year_manufacture`.
  - Os read-only `vehicle_needs_review`, `vehicle_source`, `vehicle_source_text` e `zero_km`.
  - O Detail ganha `catalog_path`.
  - No orçamento: `BudgetService.create(..., catalog_family=None, catalog_version=None, vehicle_year_manufacture=None, ...)` e o Read com `catalog_path`.

- [ ] **Step 1: Escrever os testes**

```python
class CatalogVehicleOSTest(TenantTestCase):  # POST /api/v1/service-orders/ como ADMIN
    def test_com_versao_preenche_snapshot_e_sem_selo(self):
        v = make_catalog()
        r = self.post_os(catalog_version=v.id, make="LIXO", model="LIXO")
        o = ServiceOrder.objects.get(pk=r.data["id"])
        assert (o.make, o.model, o.year, o.fuel_type) == ("Chevrolet", "Onix Plus", 2025, "Flex")
        assert o.catalog_family.nome == "Onix Plus" and o.vehicle_needs_review is False
        assert r.data["catalog_path"]["version"]["label"] == "2025 Flex"
    def test_so_familia_fica_com_selo(self):
        r = self.post_os(catalog_family=make_catalog().modelo.familia_id)
        assert r.status_code == 201 and r.data["vehicle_needs_review"] is True
    def test_versao_de_outra_familia_400(self):
        a = make_catalog(); b = make_catalog(family="Montana", model="MONTANA RS 1.2 Turbo Flex 12V Aut.", codigo="004546-2")
        assert self.post_os(catalog_family=a.modelo.familia_id, catalog_version=b.id).status_code == 400
    def test_patch_familia_nova_limpa_versao_antiga(self): ...
    def test_patch_km_em_os_pendente_200(self): ...   # mileage_in só; selo continua True
    def test_ano_fabricacao_fora_400(self):
        assert self.post_os(catalog_version=make_catalog().id, year_manufacture=2022).status_code == 400
    def test_propaga_para_outra_os_da_mesma_placa(self): ...  # FKs + snapshot + selo
    def test_sem_catalogo_continua_aceitando_texto(self):  # transição — removido na Task 16
        assert self.post_os(make="Honda", model="Civic").status_code == 201
```

Em `budgets/tests/test_catalog_vehicle.py`:
- um POST `/api/v1/budgets/` com `catalog_version` preenche `vehicle_description == "Chevrolet Onix Plus ONIX SED. Plus PREM. 1.0 12V TB Flex Aut"`, `vehicle_year == 2025` e `vehicle_fuel_type == "Flex"`;
- `create_from_budget` copia as duas FKs e o selo;
- `clone` também copia as duas FKs.

Em `vehicles/tests/test_api.py`: `POST /api/v1/vehicles/` sem `family` dá 400, e o `chassis` volta decifrado na leitura.

- [ ] **Step 2: Rodar e ver falhar**

Run: `docker exec paddock_django pytest apps/service_orders/tests/test_catalog_vehicle.py apps/budgets/tests/test_catalog_vehicle.py apps/vehicles -v`.

- [ ] **Step 3: Migrations e models**

Run: `docker exec paddock_django python manage.py makemigrations service_orders budgets vehicles`.

Para `chassis` e `renavam` de `Vehicle`, edite a migration gerada para a sequência AddField `_enc` → RunPython copiando → RemoveField → RenameField.

- [ ] **Step 4: Implementar a gravação**

**Serializers** (Create e Update):
- declarar `catalog_family` e `catalog_version` como `PrimaryKeyRelatedField(queryset=...filter(is_active=True), required=False, allow_null=True)`;
- incluir os novos campos derivados em `read_only_fields`; os serializers usam `exclude`, então todo campo novo nasce gravável;
- `validate()`:
  - versão e família incompatíveis → `{"catalog_version": "Versão não pertence ao modelo."}`;
  - `year_manufacture` fora de `{ano, ano-1}` quando há versão (zero km: ano corrente e anterior) → erro em `year_manufacture`.

**Services:**
- `ServiceOrderService.create` e `update` chamam `apply_catalog_vehicle` quando o payload traz `catalog_family` ou `catalog_version`.
- No `update`, se veio só `catalog_family` e a versão atual é de outra família, a versão passa a `None`.
- Acrescentar os campos novos a `FIELD_GROUPS["vehicle_updated"]` e ao conjunto da propagação por placa (304-314).
- `BudgetService` ganha `_apply_catalog_vehicle(budget, family, version)`, que preenche `vehicle_description`, `vehicle_version`, `vehicle_fuel_type`, `vehicle_make_logo` e `vehicle_year` a partir do mesmo `build_snapshot`.
- `create_from_budget` (404-428):
  - com FK no orçamento: `apply_catalog_vehicle(order, family=budget.catalog_family, version=budget.catalog_version, needs_review=budget.vehicle_needs_review)`;
  - sem FK: mantém o código atual até a Task 11, que troca pelo casamento.
- `clone` copia as FKs.

**Vehicles:** `VehicleSerializer.validate` exige `family` no create.

- [ ] **Step 5: Rodar a suíte dos apps tocados**

Run: `docker exec paddock_django pytest apps/service_orders apps/budgets apps/vehicles apps/cilia apps/quotes -q` → PASS.

- [ ] **Step 6: Commit** `feat(dscar): OS e orçamento gravam família e versão do catálogo com snapshot do servidor`

---

### Task 8: Cor como enum fechado (backend + front)

**Files:**
- Modify:
  - `apps/service_orders/models/service_order.py:250` (`color`);
  - `apps/budgets/models.py` (`vehicle_color`);
  - `apps/vehicles/models.py` (`color`).
  - Todos passam a CharField(20) com `choices=CorVeiculo.choices` e `default=CorVeiculo.NAO_INFORMADA`.
- Create: uma data migration em cada app, que mapeia o texto por `match_color(texto) or "NAO_INFORMADA"`. O reverse é noop.
- Replace:
  - `VehicleColorViewSet` (`vehicle_catalog/views.py:32-68`) por `colors_list` (GET, `IsAuthenticated`), que devolve `[{value, label, hex}]` de `CorVeiculo` + `COR_HEX`, sem paginação;
  - a rota `colors` em `urls.py`.
- Delete:
  - model `VehicleColor` (`models.py:8-23`, `DeleteModel`) e `VehicleColorSerializer`;
  - `management/commands/load_vehicle_colors.py`.
- Modify:
  - `apps/documents/data_loaders.py:194-204`: `_color_hex(value)` passa a ser `COR_HEX.get(value, "")`, e o template recebe `get_color_display()`;
  - `apps/service_orders/transition_validator.py:527-543`: o aviso `VEHICLE_COLOR` olha `order.color in ("", CorVeiculo.NAO_INFORMADA)`.
- Front:
  - Modify:
    - `app/(app)/os/[numero]/_components/shared/ColorSelect.tsx`: tira o modo livre (19-30) e a opção desconhecida (49-51);
    - `app/(app)/os/[numero]/_hooks/useVehicleCatalog.ts:9-16`: `useVehicleColors` com Zod.
  - Delete:
    - `app/(app)/cadastros/cores/`, inclusive `ColorDialog`;
    - `hooks/useVehicleColors.ts`;
    - a entrada `cad-cores` em `components/dock/nav-config.ts:132`;
    - o export no barrel `hooks/index.ts`.
- Test:
  - `apps/service_orders/tests/test_color_enum.py`;
  - `app/(app)/os/[numero]/_components/shared/ColorSelect.test.tsx`.

**Interfaces:**
- Produces:
  - o endpoint `GET /api/v1/vehicle-catalog/colors/` → `[{"value": "PRETA", "label": "Preta", "hex": "#1a1a1a"}, …]`, com 17 itens;
  - no front, `useVehicleColors(): UseQueryResult<VehicleColorOption[]>` com `vehicleColorOptionSchema = z.object({value: z.string(), label: z.string(), hex: z.string()})`;
  - `ColorSelect` com as props `{value: string, onChange(value: string), disabled?}`, em que o valor é o código do enum.

- [ ] **Step 1: Escrever os testes**

Backend:
- `test_patch_cor_fora_do_enum_400`: `color="Preto"` é rejeitada;
- `test_patch_cor_enum_200`: `color="PRETA"` é aceita;
- `test_endpoint_cores`: 17 itens e o primeiro com as chaves `value`, `label` e `hex`;
- `test_migracao_mapeia`: chame a função da data migration com um `ServiceOrder(color="Prta")` e confira `"PRETA"`.

Front (`ColorSelect.test.tsx`):
- com `vi.mock("@/lib/api")` devolvendo `[]`, não existe `input[type=text]`;
- com a lista carregada, escolher "Preta" chama `onChange("PRETA")`.

- [ ] **Step 2: Rodar e ver falhar**

Run:
- `docker exec paddock_django pytest apps/service_orders/tests/test_color_enum.py -v`;
- `cd apps/dscar-web && npx vitest run src/app/\(app\)/os/\[numero\]/_components/shared/ColorSelect.test.tsx`.

- [ ] **Step 3: Implementar backend e front**

Os defaults dos formulários passam a `"NAO_INFORMADA"`:
- `os/_components/new-os.schema.ts:37`;
- `os/[numero]/_schemas/service-order.schema.ts:68-83`;
- `os/[numero]/_utils/form-defaults.ts:69-78`.

- [ ] **Step 4: Rodar tudo**

Run:
- `docker exec paddock_django pytest apps/service_orders apps/budgets apps/vehicles apps/documents apps/vehicle_catalog -q`;
- `cd apps/dscar-web && npm run typecheck && npx vitest run`.

Expected: PASS.

- [ ] **Step 5: Commit** `feat(dscar): cor do veículo vira enum fechado do Renavam e sai o cadastro de cores`

---

### Task 9: "Veículo a confirmar" bloqueia produção, filtra a lista e marca o card

**Files:**
- Modify:
  - `apps/service_orders/transition_validator.py`: `_validate_to_waiting_parts` 718-757, `_validate_to_repair` 759-834, `_validate_workshop_transition` 836-880;
  - `apps/service_orders/services/order_service.py:379-403`.
- Modify:
  - `apps/service_orders/views/orders.py:167-179` (`filterset_fields`);
  - `serializers/core.py:428-460` (List `fields`).
- Front:
  - `packages/types/src/service-order.types.ts:298-403`: `vehicle_needs_review: boolean`;
  - `components/kanban/KanbanCard.tsx:85-94`: troca o selo morto `has_transition_blocks` (86-91) pelo novo;
  - `app/(app)/os/page.tsx`: estado em 133-140, `filters` em 150-158, `advancedCount` em 143, reset em 165, `hasFilters` em 176, chips em 372-398 e o select em `AdvancedFilters` 70-126.
- Test:
  - `apps/service_orders/tests/test_transition_validator.py` (helper `_make_order` em 22-85);
  - `tests/test_vehicle_review_transition.py`;
  - `components/kanban/KanbanCard.test.tsx`.

**Interfaces:**
- Produces:
  - o bloco HARD `ValidationBlock(code="VEHICLE_NEEDS_REVIEW", message="Confirme a versão do veículo em Dados da OS antes de entrar em produção.")`, para os destinos `waiting_parts`, `repair`, `mechanic`, `bodywork`, `painting`, `assembly`, `polishing` e `washing`;
  - `NON_OVERRIDABLE_BLOCKS = frozenset({"VEHICLE_NEEDS_REVIEW"})` em `order_service.py`;
  - o filtro `GET /service-orders/?vehicle_needs_review=true`.

- [ ] **Step 1: Escrever os testes**

```python
# test_transition_validator.py — _make_order passa a setar order.vehicle_needs_review = kwargs.get("vehicle_needs_review", False)
@pytest.mark.parametrize("status,target", [("budget", "repair"), ("waiting_parts", "repair"),
    ("authorized", "waiting_parts"), ("repair", "bodywork"), ("bodywork", "painting"), ("polishing", "washing")])
def test_veiculo_a_confirmar_bloqueia_producao(status, target):
    r = TransitionValidator.validate(_make_order(status=status, vehicle_needs_review=True), target)
    assert "VEHICLE_NEEDS_REVIEW" in {b.code for b in r.hard_blocks}
def test_seguradora_pode_receber_com_veiculo_pendente():
    r = TransitionValidator.validate(_make_order(status="budget", vehicle_needs_review=True), "waiting_auth")
    assert "VEHICLE_NEEDS_REVIEW" not in {b.code for b in r.hard_blocks}

# test_vehicle_review_transition.py (TenantTestCase, ServiceOrderService direto)
def test_override_de_gerente_nao_fura(self):
    with pytest.raises(ValidationError) as e:
        ServiceOrderService.transition(order_id=self.os.pk, new_status="repair", changed_by_id=..., force=True, manager_verified=True)
    assert e.value.detail["transition_blocks"]["can_override"] is False
def test_os_em_producao_que_perde_versao_volta_a_bloquear(self):  # Review Focus 2
    # OS em bodywork com versão; PATCH catalog_version=None → vehicle_needs_review True, status segue bodywork,
    # transition para painting → VEHICLE_NEEDS_REVIEW
def test_filtro_lista(self):
    assert [o["id"] for o in self.client.get("/api/v1/service-orders/?vehicle_needs_review=true").data["results"]] == [str(self.pend.pk)]
```

`KanbanCard.test.tsx`: com `vehicle_needs_review: true` aparece o texto "Veículo a confirmar"; com `false`, não aparece.

- [ ] **Step 2: Rodar e ver falhar**

Run:
- `docker exec paddock_django pytest apps/service_orders/tests/test_transition_validator.py apps/service_orders/tests/test_vehicle_review_transition.py -v`;
- `cd apps/dscar-web && npx vitest run src/components/kanban/KanbanCard.test.tsx`.

- [ ] **Step 3: Implementar**

- **Validator:** o helper `_vehicle_review_blocks(order) -> list[ValidationBlock]` é chamado:
  - no início de `_validate_to_waiting_parts`;
  - no início de `_validate_to_repair`, fora dos dois ramos;
  - em `_validate_workshop_transition`.
- **`transition`:** quando `{b.code for b in result.hard_blocks} & NON_OVERRIDABLE_BLOCKS`, levanta o mesmo erro com `can_override: False`, antes do ramo de override.
- **Front:**
  - o select "Veículo" ("Todos" / "A confirmar") envia `vehicle_needs_review: "true"`;
  - o selo âmbar no card diz "Veículo a confirmar".

- [ ] **Step 4: Rodar** (os mesmos comandos, mais `npm run typecheck`) → PASS.

- [ ] **Step 5: Commit** `feat(dscar): veículo a confirmar bloqueia entrada em produção, com filtro e selo no kanban`

---

# Parte 3 — Normalização do que chega de fora

### Task 10: `match_vehicle` e regras aprendidas

**Files:**
- Create: `apps/vehicle_catalog/matching.py`
- Modify: `apps/vehicle_catalog/models.py` (+`VehicleAlias`) e `admin.py`. A migration é a próxima, gerada pelo `makemigrations`.
- Test: `apps/vehicle_catalog/tests/test_matching.py`

**Interfaces:**
- Consumes:
  - `normalize_name`, `canonical_brand`, `make_display_name` e `match_fuel` (Task 1);
  - `decode_vin` (Task 4);
  - a fixture e `load_fipex` (Task 3).
- Produces o model `VehicleAlias`:
  - `source`: CharField(20), com os valores `cilia`, `xml_ifx`, `hdi`, `placa`, `orcamento`, `quotes` e `box`;
  - `raw_key`: CharField(300);
  - `version`: FK `VehicleYearVersion`, PROTECT, null;
  - `family`: FK `VehicleFamily`, PROTECT, null;
  - `confirmacoes`: PositiveIntegerField, default 1;
  - `aprovado`: bool;
  - `created_at` e `updated_at`;
  - `UniqueConstraint(source, raw_key)`;
  - a property `is_exact`, que vale `aprovado or confirmacoes >= 2`.
- Produces:
  - `@dataclass(frozen=True) VehicleMatch(make: VehicleMake | None, family: VehicleFamily | None, model: VehicleModel | None, version: VehicleYearVersion | None, confidence: Literal["exata", "alta", "baixa", "nenhuma"], review: bool, candidates: tuple[VehicleModel, ...] = ())`;
  - `match_vehicle(brand: str, text: str, year: int | None, *, fuel: str | None = None, codigo_fipe: str | None = None, vin: str | None = None, tipo: str | None = None, source: str = "") -> VehicleMatch`;
  - `alias_key(text: str, year: int | None) -> str`;
  - `record_alias_confirmation(source: str, text: str, year: int | None, *, version: VehicleYearVersion | None, family: VehicleFamily | None) -> VehicleAlias`.
  - Regra para quem chama: grava `version` quando ela não é `None`, senão grava `family`; o selo é `review`.

- [ ] **Step 1: Escrever os testes com as fixtures reais** (`TestCase`; `setUpTestData` com `load_fipex(SAMPLE, ref="2026-10")`)

```python
CASES = [  # (brand, text, year, fipe esperado ou None, família esperada, confiança)
    ("", "CHEVROLET NOVA MONTANA CAB DUPLA RS 1.2 12V TURBO FLEX AUT 4p Gasolina/Alcool", 2025, "004546-2", "Montana", "alta"),
    ("", "HONDA NOVO FIT EXL-AT 1.5 I-VTEC FLEXONE 5p Gasolina/Alcool", 2021, "014056-2", "Fit", "alta"),
    ("VOLKSWAGEN", "GOL 1.0MI TOTAL FLEX 8V 4P", 2013, None, "Gol", "baixa"),
    ("HYUNDAI", "HB20X PREMIUM 1.6 FLEX 16V AUT", 2018, "015097-5", "HB20X", "alta"),
    ("VOLKSWAGEN", "VIRTUS 1.6 MSI Flex 16V 5p Mec.", 2018, "005486-0", "Virtus", "alta"),
    ("NISSAN", "KICKS (2017 A 2021) S DIRECT AUT 1.6 16V FLEX 2019", 2019, "023158-4", "Kicks", "alta"),
    ("CHEVROLET", "ONIX PLUS (2020 A 2025) PREMIER 1.0 12V TURBO FLEX 2025", 2025, "004504-7", "Onix Plus", "alta"),
    ("MERCEDES-BENZ", "SPRINTER VANS (2023 A 2026) 517 CDI - EXTRA LONGO TETO ALTO 18L OM-654 CDI 2025", 2025, None, "Sprinter", "baixa"),
]
@pytest.mark.parametrize("brand,text,year,fipe,fam,conf", CASES)
def test_fixtures_reais(brand, text, year, fipe, fam, conf):
    m = match_vehicle(brand, text, year)
    assert (m.family.nome, m.confidence) == (fam, conf)
    assert (m.version.modelo.codigo_fipe if m.version else None) == fipe
    assert m.review is (fipe is None)

def test_codigo_fipe_e_exato():
    m = match_vehicle("Honda", "POP 110I", 2020, codigo_fipe="811132-4")
    assert m.confidence == "exata" and m.version.ano == 2020 and m.make.tipo == "moto" and not m.review
def test_marca_de_duas_palavras_no_texto(): ...       # brand="LAND", text="ROVER ..." → make Land Rover (se houver no sample) ou nenhuma sem erro
def test_nada_casa(): assert match_vehicle("", "XX", 2020).confidence == "nenhuma"
def test_alias_primeira_confirmacao_preenche_com_selo():
    v = VehicleYearVersion.objects.get(modelo__codigo_fipe="005275-2", ano=2013)
    record_alias_confirmation("hdi", "VOLKSWAGEN GOL 1.0MI TOTAL FLEX 8V 4P", 2013, version=v, family=None)
    m = match_vehicle("VOLKSWAGEN", "GOL 1.0MI TOTAL FLEX 8V 4P", 2013, source="hdi")
    assert m.version == v and m.confidence == "alta" and m.review is True
def test_alias_duas_confirmacoes_vira_exata(): ...    # 2× mesma versão → confidence "exata", review False
def test_alias_alvo_diferente_reinicia(): ...         # confirmações voltam a 1 com o novo alvo
def test_alias_de_outra_fonte_nao_vale(): ...         # alias "hdi" não afeta source="cilia"
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `docker exec paddock_django pytest apps/vehicle_catalog/tests/test_matching.py -v`.

- [ ] **Step 3: Implementar `matching.py`**

O algoritmo foi calibrado contra o dump de 2026-10: os 8 casos acima saem exatamente assim.

```python
FUEL_WORDS = {"FLEX","FLEXONE","FLEXFUEL","GASOLINA","ALCOOL","ETANOL","DIESEL","DIE","GNV","HIBRIDO","HYBRID","ELETRICO"}
TOKEN_SYN = {"AT": "AUT", "AUTOMATICO": "AUT", "MT": "MEC", "MANUAL": "MEC", "TB": "TURBO", "PREM": "PREMIER", "SED": "SEDAN"}
DROP = {"NOVO", "NOVA", "NEW", "TOTAL"}
YEAR_RANGE = re.compile(r"\(\s*\d{4}\s*A\s*\d{4}\s*\)")
ENGINE = re.compile(r"^\d\.\d$")

def version_tokens(text: str) -> tuple[set[str], str | None]:
    t = YEAR_RANGE.sub(" ", normalize_name(text))
    t = re.sub(r"(\d\.\d)([A-Z])", r"\1 \2", t)              # 1.0MI → 1.0 MI
    t = re.sub(r"[()/,;:]|(?<!\d)-|-(?!\d)", " ", t)          # separa EXL-AT, mantém 35-160
    out, fuel = set(), match_fuel(text)
    for tok in t.split():
        tok = (tok.replace(".", "") if not re.search(r"\d", tok) else tok).rstrip(".")
        if not tok or tok in DROP or tok in FUEL_WORDS:
            continue
        out.add(TOKEN_SYN.get(tok, tok))
    return out, fuel

def _weight(tokens: set[str]) -> float:
    return sum(1 if re.search(r"\d", t) else 2 for t in tokens)

def _score(source: set[str], candidate: set[str]) -> float:
    return _weight(source & candidate) - 0.5 * _weight(candidate - source)
```

O `match_vehicle`, na ordem e parando no primeiro passo que resolve:
1. **`codigo_fipe`:** com `year` (ou o ano do VIN), devolve `VehicleYearVersion(modelo__codigo_fipe=..., ano=year)` ativa, com confiança `exata` e `review=False`.
2. **Alias `(source, alias_key(brand+" "+text, year))`:** se `is_exact`, devolve o alvo com `exata` e `review=False`; senão, o alvo com `alta` e `review=True`.
3. **Marca:**
   - primeiro `canonical_brand(brand)`;
   - senão, o maior nome de exibição normalizado que seja prefixo do texto completo (cobre "LAND ROVER" e "CAOA CHERY");
   - senão, o apelido do 1º token;
   - senão, `decode_vin(vin).make_hint`.

   As makes candidatas são todas as ativas com aquele nome de exibição, em qualquer tipo. O `tipo` só desempata famílias homônimas, e o padrão é `carro`.
4. **Limpeza do resto:**
   - tira o prefixo da marca e dos seus apelidos;
   - tira `YEAR_RANGE` e o ano de 4 dígitos solto no fim;
   - tira `NOVO`, `NOVA` e `NEW`.
5. **Família:** a família ativa das makes candidatas cujo `nome_normalizado` é prefixo do resto, seguido de espaço ou do fim do texto ("GOL" não casa "GOLF"), tentando a mais longa primeiro. Sem família, devolve `nenhuma`.
6. **Versão FIPE:** compara os tokens do resto com os de `VehicleModel.nome`, nos dois lados sem os tokens da família.
   - Só entram modelos ativos com versão ativa em `year`, quando `year` existe.
   - Descarta candidato cuja cilindrada (`ENGINE`) não bate com a do texto, quando os dois têm.
   - Com o candidato de maior pontuação `s1` e o seguinte `s2`, a confiança é `alta` se `s1 >= 3` e (`s2` não existe ou `s1 - s2 >= 1.5`); senão é `baixa`, com família, sem versão e com os 5 primeiros em `candidates`.
7. **Ano/combustível do modelo `alta`:** as versões ativas em `year`, filtradas pela pista de combustível. Se sobrar exatamente uma, ela é a versão; senão, a versão fica `None` e `review=True`.

`alias_key` = `normalize_name(YEAR_RANGE.sub(" ", text))` com espaços colapsados + `f"|{year or ''}"`.

`record_alias_confirmation`:
- faz `get_or_create`;
- com o mesmo alvo, soma 1 a `confirmacoes`;
- com alvo diferente, troca o alvo, volta `confirmacoes` a 1 e `aprovado` a False.

No admin, `VehicleAliasAdmin` tem a action "Aprovar regras selecionadas", filtro por `source` e `aprovado`, e excluir. É a única lista de revisão.

- [ ] **Step 4: Rodar** (PASS)

Se um caso divergir, ajuste só `TOKEN_SYN` ou `DROP`, nunca os limiares, e registre o motivo no commit.

- [ ] **Step 5: Commit** `feat(dscar): casamento de veículo com o catálogo FIPE e regras aprendidas por fonte`

---

### Task 11: Importadores e caminhos de texto passam pela normalização

**Files:**
- Create: `apps/cilia/normalization.py`
- Modify: `apps/cilia/dtos.py`
  - `ParsedBudget` 66-128 ganha os campos;
  - `_persist_cilia_budget` 287-369: busca de seguradora em 302-308 e criação em 335-352.
- Modify: `apps/cilia/sources/cilia_parser.py`
  - remove `INSURER_TRADE_TO_CODE` (32-43), `_resolve_insurer_code` (482-501) e `_normalize_color`/`_normalize_brand`/`_normalize_model` (519-548);
  - lê `insurer.document_identifier`, `vehicle.type_key` e `client.address.{city,state,zip_code|cep}`.
- Modify:
  - `apps/cilia/sources/hdi_html_parser.py:87`: lê o CNPJ de `tables[1]`; em 171-173, a cor sai sem `.title()`;
  - `apps/cilia/sources/xml_ifx_parser.py:212-214`: a cor sai sem `.title()`.
- Modify: `apps/cilia/services.py:139-231` (`apply_parsed_budget_to_order`).
- Modify:
  - `apps/service_orders/services/order_service.py` (`update`): grava a regra quando o usuário confirma;
  - `services/versioning_service.py:404-428`: caminho sem FK;
  - `apps/quotes/services.py:434-448`.
- Modify: `apps/service_orders/models/service_order.py`: +`import_warnings` (JSONField, `default=list`, `blank=True`), exposto no Detail e gravável só como lista vazia, para dispensar o aviso.
- Modify:
  - `apps/insurers/views.py`: action `trade_names` (POST, detail, `IsConsultantOrAbove`);
  - `app/(app)/os/[numero]/_components/ImportBudgetModal.tsx:33-38,241-250`: troca a lista fixa por `InsurerSelect` (`os/[numero]/_components/shared/InsurerSelect.tsx`). O select lista só seguradoras com `code`. O envio passa `insurer_code` = `code` da seguradora escolhida; `source` é `xml_{code}` para porto, azul e itau e `"soma"` para qualquer outro código (o ramo XML só aceita `soma`, `xml_porto`, `xml_azul` e `xml_itau`; com `soma` o backend grava a tentativa como `xml_porto`).
- Delete: `apps/cilia/tests/test_cilia_parser_normalization.py`. Ajuste a cor esperada em `test_hdi_html_parser.py` de "Preta" para "PRETA".
- Test:
  - `apps/cilia/tests/test_normalization.py`;
  - `apps/cilia/tests/test_import_service.py` (ampliar);
  - `apps/insurers/tests/test_trade_names_endpoint.py`.

**Interfaces:**
- Consumes:
  - `match_vehicle` e `record_alias_confirmation` (Task 10);
  - `match_color` (Task 1);
  - `match_insurer` (Task 5);
  - `match_municipio` e `is_valid_cpf` (Task 4);
  - `apply_catalog_vehicle` (Task 7).
- Produces os campos novos de `ParsedBudget`:
  - entrada: `insurer_trade: str = ""`, `insurer_cnpj: str = ""`, `vehicle_tipo_hint: str = ""`, `segurado_city: str = ""`, `segurado_uf: str = ""`, `segurado_cep: str = ""`;
  - resultados: `catalog_family_id: int | None = None`, `catalog_version_id: int | None = None`, `vehicle_review: bool = True`, `color: str = ""`, `insurer_id: UUID | None = None`, `normalized: bool = False`.
- Produces `normalize_parsed_budget(parsed: ParsedBudget) -> None`. É idempotente (`parsed.normalized`) e preenche os resultados. Também acerta `parsed.insurer_code = insurer.code` quando casou, porque o código a jusante ainda lê `insurer_code`.
- Produces `UnknownInsurerError(Exception)`, com os atributos `trade` e `cnpj`.
- Produces o endpoint `POST /api/v1/insurers/{id}/trade-names/` (`{"name": "..."}`) → 200 com `trade_names`. Acrescenta o nome se ele não estiver na lista, comparando sem caixa nem acento.

- [ ] **Step 1: Escrever os testes**

```python
class NormalizeParsedBudgetTest(TenantTestCase):  # setUpTestData: load_fipex(SAMPLE)
    def test_cilia_onix_bradesco(self):
        pb = CiliaParser().parse(json.loads((FIXTURES / "cilia_bradesco_discount_10pct.json").read_text()))
        normalize_parsed_budget(pb)
        assert VehicleYearVersion.objects.get(pk=pb.catalog_version_id).modelo.codigo_fipe == "004504-7"
        assert (pb.color, pb.insurer_code, pb.insurer_cnpj) == ("PRETA", "bradesco", "33055146000193")
    def test_xml_montana_insurer_escolhido(self): ...   # insurer_code="porto" → insurer porto, versão 004546-2

class PersistTest(TenantTestCase):
    def test_kicks_yelum_cria_os_com_versao(self):
        # fixture cilia_yelum_insurer_supplied.json → OS waiting_auth, catalog_version 023158-4,
        # vehicle_needs_review False, insurer yelum (CNPJ de filial 61550141009129), insurer_cnpj == "61550141009129"
    def test_sprinter_fica_so_familia_com_texto_original(self):
        # cilia_1446508_v1.json → catalog_family Sprinter, catalog_version None, vehicle_needs_review True,
        # vehicle_source "cilia", vehicle_source_text.startswith("MERCEDES-BENZ SPRINTER VANS"), sem erro de varchar(100)
    def test_seguradora_desconhecida_para_com_texto(self):
        # insurer.trade "Seguradora X", CNPJ desconhecido → ImportAttempt.error_type == "UnknownInsurer",
        # error_message contém "Seguradora X"; nenhuma OS criada
    def test_segurado_com_cpf_valido_e_municipio(self):
        # ParsedBudget com segurado_cpf="52998224725", city "Manaus"/"AM" → PersonDocument CPF + PersonAddress municipio_ibge "1302603"
    def test_segurado_com_cpf_invalido_nao_grava_documento(self): ...

class ApplyToExistingOrderTest(TenantTestCase):
    def test_veiculo_diferente_gera_aviso(self):
        # OS confirmada com Kicks 023158-4; aplicar parsed Onix → import_warnings == ["Veículo diverge: o cilia diz 'CHEVROLET ONIX PLUS ...'"], FKs da OS intactas
    def test_texto_sem_casamento_conta_confirmacao(self):
        # OS confirmada; parsed com texto "XPTO 123" → VehicleAlias(source="cilia", confirmacoes=1, version=OS.catalog_version)
    def test_os_sem_veiculo_recebe_o_casado(self): ...
    def test_seguradora_diferente_gera_aviso_e_mantem_a_da_os(self): ...

class ConfirmacaoPelaTelaTest(TenantTestCase):
    def test_patch_que_confirma_grava_regra(self):
        # OS do import (vehicle_source "hdi", texto Gol, só família) → PATCH catalog_version=005275-2/2013
        # → VehicleAlias("hdi", alias_key(texto, 2013)).confirmacoes == 1; segunda OS igual + PATCH → is_exact

def test_create_from_budget_sem_fk_usa_casamento(self): ...  # Budget legado com vehicle_description "Chevrolet Onix Plus Premier 1.0 Turbo" → OS com família Onix Plus e selo
def test_quotes_aprovar_usa_casamento(self): ...            # OrcamentoService.aprovar → OS com catalog_family quando casar

# test_trade_names_endpoint.py
def test_consultant_vincula_nome(self): ...  # POST {"name": "Yelum Seg."} → 200 e o nome em trade_names
def test_storekeeper_403(self): ...
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `docker exec paddock_django pytest apps/cilia apps/imports apps/insurers apps/budgets apps/quotes -v`.

- [ ] **Step 3: Implementar**

**`normalize_parsed_budget`:**
- **Veículo:** `match_vehicle(parsed.vehicle_brand, parsed.vehicle_model or parsed.vehicle_description, parsed.vehicle_year, vin=parsed.vehicle_chassis, tipo=hint, source=parsed.source)`. O `hint` é `{"car": "carro", "truck": "caminhao", "motorcycle": "moto"}.get(type_key)`; `van` e outros dão `None`.
- **Cor:** `match_color(parsed.vehicle_color) or ""`.
- **Seguradora:** `match_insurer(cnpj=parsed.insurer_cnpj, name=parsed.insurer_trade, code=parsed.insurer_code)`.

Chamado no começo de `apply_parsed_budget_to_order` e de `_persist_cilia_budget`. Isso cobre também o reconcile (`orders.py:1773-1800`), que remonta o DTO e passa por `apply`.

**`_persist_cilia_budget`:**
- sem seguradora → `UnknownInsurerError(trade, cnpj)`. `fetch_cilia_budget` e `import_xml_ifx` gravam isso como `error_type="UnknownInsurer"`, com `error_message=f"Seguradora não reconhecida: '{trade}'"`;
- a OS nova usa:
  - `apply_catalog_vehicle(order, family=..., version=..., needs_review=parsed.vehicle_review, source=parsed.source, source_text=f"{brand} {model}".strip()[:300])`;
  - `color = parsed.color or NAO_INFORMADA`;
  - `insurer_cnpj = only_digits(parsed.insurer_cnpj)`;
- `model` e `make` vêm só do snapshot; o `vehicle_description` não entra mais em `model`;
- a Person nova recebe:
  - `PersonDocument` CPF só se `is_valid_cpf`;
  - `PersonContact` com o telefone em dígitos (10 ou 11);
  - `PersonAddress(city, state, zip_code, municipio_ibge, is_primary=True)` só se `match_municipio` casar.

**`apply_parsed_budget_to_order`:**
- **OS sem `catalog_family`:** aplica o casamento com `source` e `source_text`.
- **OS com veículo confirmado** (`catalog_family` e `not vehicle_needs_review`):
  - se o casamento achou família ou versão diferente → acrescenta a `import_warnings` `f"Veículo diverge: o {source} diz '{source_text}'"`;
  - se o casamento deu `nenhuma` ou só a família da própria OS → `record_alias_confirmation(source, source_text, year, version=order.catalog_version, family=order.catalog_family)`.
- **Cor:** só preenche quando está `NAO_INFORMADA`.
- **Seguradora:**
  - OS sem seguradora e casou → grava `insurer`, `customer_type="insurer"` e `insurer_cnpj`;
  - casou outra → aviso `f"Seguradora diverge: o arquivo diz '{trade}'"`;
  - não casou e veio texto → aviso `"Seguradora do arquivo não reconhecida: '...'"`;
  - não força mais `customer_type` com código inexistente.
- Devolve também `"import_warnings"` em `update_fields` quando mudou.

**`ServiceOrderService.update`:** quando `catalog_family` ou `catalog_version` mudam e a OS tem `vehicle_source_text`, chama `record_alias_confirmation(order.vehicle_source, order.vehicle_source_text, order.year, version=..., family=...)`.

**Caminhos de texto:**
- `create_from_budget` sem FK: `match_vehicle("", budget.vehicle_description, budget.vehicle_year, source="orcamento")`;
- quotes: `match_vehicle(orc.veiculo_marca, f"{orc.veiculo_modelo} {orc.veiculo_versao}", orc.veiculo_ano, source="quotes")`;
- os dois aplicam com `apply_catalog_vehicle`.

- [ ] **Step 4: Rodar**

Run: `docker exec paddock_django pytest apps/cilia apps/imports apps/insurers apps/budgets apps/quotes apps/service_orders -q` → PASS.

- [ ] **Step 5: Commit** `feat(dscar): importadores e orçamentos casam veículo, cor e seguradora com as listas`

---

# Parte 4 — Consultas automáticas

### Task 12: Núcleo das consultas + CEP

**Files:**
- Create:
  - `apps/lookups/providers.py`;
  - `apps/lookups/service.py`;
  - `apps/lookups/tests/fixtures/{viacep,opencep,awesomeapi}_01310100.json`.
- Modify:
  - `apps/lookups/views.py` e `urls.py` (Task 4);
  - `config/settings/base.py`: `AWESOMEAPI_TOKEN = config("AWESOMEAPI_TOKEN", default="")`, mais a mesma chave no `.env.example`.
- Test:
  - `apps/lookups/tests/test_service.py`;
  - `test_cep.py`.

**Interfaces:**
- Produces `LookupResult` (TypedDict): `found: bool`, `source: str`, `fields: dict[str, Any]`, `unmatched: list[str]`.
- Produces `lookup(kind: Literal["cep", "cnpj", "placa"], key: str) -> LookupResult`. Nunca levanta exceção; chave inválida dá `found: False` com `source="invalid"`.
- Produces em `providers.py`: `viacep(cep: str) -> dict | None`, `opencep(...)` e `awesomeapi(...)`. Todos devolvem `{"cep", "logradouro", "complemento", "bairro", "cidade", "uf", "ibge"}`, ou `None` quando a fonte diz "não existe".
- Produces `CHAINS: dict[str, list[Callable[[str], dict | None]]]` e `QUOTAS = {"cnpja_open": 4, "cnpjws": 2}`.
- Produces o endpoint `POST /api/v1/lookups/<kind>/` com corpo `{"key"}`, permissão `IsConsultantOrAbove`, sempre 200.
- Produces a resposta de CEP: `fields = {"cep", "logradouro", "complemento", "bairro", "municipio": {"id": codigo_ibge, "label": nome} | None, "uf"}`. Se o IBGE não está na tabela, `unmatched` recebe `["municipio"]`.

- [ ] **Step 1: Gravar as fixtures**

Faça uma chamada real a cada fonte para o CEP público `01310100` (Av. Paulista) e salve o JSON cru. A AwesomeAPI só entra se houver token. Confira os nomes reais das chaves e use exatamente eles no provider.

- [ ] **Step 2: Escrever os testes** (`@override_settings(CACHES=LOCMEM)`, `respx`)

```python
@respx.mock
def test_primeiro_falha_segundo_acerta(self):
    respx.get("https://viacep.com.br/ws/01310100/json/").mock(side_effect=httpx.ConnectTimeout)
    respx.get("https://opencep.com/v1/01310100").mock(return_value=Response(200, json=OPENCEP))
    r = lookup("cep", "01310-100")
    assert r["found"] and r["source"] == "opencep" and r["fields"]["municipio"]["id"] == "3550308"
@respx.mock
def test_viacep_erro_true_conta_como_miss(self): ...       # {"erro": "true"} → tenta o próximo
@respx.mock
def test_rede_fora_nao_cacheia_miss_e_nao_loga_chave(self):  # Review Focus 3
    for url in (VIACEP, OPENCEP): respx.get(url).mock(side_effect=httpx.ConnectTimeout)
    with self.assertLogs("apps.lookups", level="INFO") as logs:
        assert lookup("cep", "01310100")["found"] is False
    assert not any("01310100" in l or sha256_hex("01310100") in l for l in logs.output)
    assert cache.get(cache_key("cep", "01310100")) is None
@respx.mock
def test_nao_existe_cacheia_miss_1_dia(self): ...           # todos respondem "não existe" → miss com TTL 86400
def test_cache_hit_nao_chama_rede(self): ...                # segunda chamada sem respx → mesmo resultado
def test_cota_estourada_pula_provider(self): ...            # QUOTAS["cnpja_open"]=0 via override → nunca chamado (use kind fake no teste ou cnpj na Task 13)
def test_endpoint_chave_invalida_200(self):
    r = self.client.post("/api/v1/lookups/cep/", {"key": "123"}, format="json")
    assert r.status_code == 200 and r.data["found"] is False
def test_endpoint_storekeeper_403(self): ...
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `docker exec paddock_django pytest apps/lookups -v`.

- [ ] **Step 4: Implementar**

**`service.lookup`:**
1. limpa e valida a chave: CEP com 8 dígitos; CNPJ com `is_valid_cnpj`; placa com `is_valid_plate`;
2. passa pelo DB-first do tipo, se houver: placa (Task 14) e CNPJ (Task 13);
3. lê o cache `cache_key(kind, key) = f"lookup:{kind}:{sha256_hex(key)}"`;
4. percorre `CHAINS[kind]`:
   - para no prazo `monotonic() + 6.0`;
   - pula provider sem cota: `cache.add(f"lookup:quota:{name}:{minute}", 0, 60)` + `cache.incr`, comparado com o limite;
   - chama em `try/except Exception`, logando `logger.warning("lookup provider falhou", extra={"kind", "provider", "ms"})`;
   - loga cada chamada com `kind`, `provider`, `status` (`hit`, `miss` ou `error`) e `ms`, sem a chave.
5. No primeiro dict, normaliza para a lista (`_normalize_cep`, usando `Municipio`) e guarda no cache com `TTL[kind]`.
6. Se pelo menos um provider respondeu "não existe" e nenhum acertou, guarda o miss por 1 dia. Se todos deram erro, não guarda.

**Providers:** usam `httpx.get(url, timeout=httpx.Timeout(3.0, connect=1.5))`. 404 ou corpo de erro de negócio dá `None`.

**View:** `LookupView(APIView)`, com `permission_classes = [IsAuthenticated, IsConsultantOrAbove]`, `post(request, kind)` e 404 para `kind` desconhecido. Nunca devolve 4xx por chave ruim.

**Proxy Next** (`app/api/proxy/[...path]/route.ts:73`): o `console.error` troca o caminho de `lookups/...` por `lookups/<redacted>`. É uma linha de defesa extra.

- [ ] **Step 5: Rodar** (PASS)

- [ ] **Step 6: Commit** `feat(dscar): consulta de CEP com fallback, cache, cota e código IBGE`

---

### Task 13: Consulta de CNPJ

**Files:**
- Modify: `apps/lookups/providers.py` (`cnpja_open`, `minhareceita`, `cnpjws`), `service.py` (`_normalize_cnpj`).
- Create: `apps/lookups/tests/fixtures/{cnpja,minhareceita,cnpjws}_33000167000101.json`
- Test: `apps/lookups/tests/test_cnpj.py`

**Interfaces:**
- Produces os providers, com estas URLs:
  - `cnpja_open`: `https://open.cnpja.com/office/{cnpj}`;
  - `minhareceita`: `https://minhareceita.org/{cnpj}`;
  - `cnpjws`: `https://publica.cnpj.ws/cnpj/{cnpj}`.
- Os providers devolvem `{"razao_social", "nome_fantasia", "situacao", "logradouro", "numero", "complemento", "bairro", "cep", "ibge", "cidade", "uf", "cnae_codigo", "cnae_descricao", "simples": bool | None, "mei": bool | None, "email", "telefone"}`. Não guardam QSA.
- Produces a resposta de CNPJ: `fields` = os campos acima, com `municipio: {id, label} | None` no lugar de `ibge`/`cidade`.
- Regra da cadeia: CNPJ alfanumérico usa só `[cnpja_open]`, porque é o único que aceita.

- [ ] **Step 1: Gravar as fixtures**

Faça uma chamada real a cada fonte para `33000167000101` (Petrobras, dado público de empresa) e mapeie os caminhos de cada JSON para o dict comum.

**Antes de ligar em produção:** confirme os termos de uso comercial do CNPJá. Se não permitirem, mude `CHAINS["cnpj"]` para `[minhareceita, cnpjws, cnpja_open]`.

- [ ] **Step 2: Escrever os testes**

- `test_cnpja_acerta`: `fields["razao_social"]` não vazio e `fields["municipio"]["id"] == "3304557"` (Rio de Janeiro);
- `test_cnpja_429_cai_no_minhareceita`;
- `test_cota_do_cnpja_estourada_pula_sem_chamar`: o `route.called` fica False;
- `test_alfanumerico_so_cnpja`;
- `test_404_em_todos_found_false`.

- [ ] **Step 3: Rodar e ver falhar → implementar → rodar** (`docker exec paddock_django pytest apps/lookups -v`)

- [ ] **Step 4: Commit** `feat(dscar): consulta de CNPJ em fontes abertas com cota por provider`

---

### Task 14: Consulta de placa (endpoint novo, sem remover os antigos)

**Files:**
- Modify:
  - `apps/lookups/providers.py` (`apiplacas`);
  - `service.py` (`_db_first_placa`, `_normalize_placa`, regra de restrição).
- Modify: `apps/authentication/views_health.py:47-52`.
- Create: `apps/lookups/tests/fixtures/apiplacas_ok.json` e `apiplacas_saldo.json`. Saem de uma consulta real, com estes ajustes:
  - a placa trocada por `ABC1D23`;
  - o chassi, o RENAVAM e os dados de proprietário apagados;
  - a cor trocada por `Branca`;
  - o primeiro item de `fipe.dados` trocado por `002111-3`, com ano-modelo 2023.
- Test: `apps/lookups/tests/test_placa.py`

**Interfaces:**
- Consumes:
  - `match_vehicle` e `catalog_path` (Tasks 10 e 6);
  - `match_color` (Task 1);
  - `settings.APIPLACAS_TOKEN` e `APIPLACAS_URL` (`base.py:390-394`).
- Produces `apiplacas(placa: str) -> dict | None`, que devolve `{"marca", "modelo", "versao", "ano_modelo", "ano_fabricacao", "cor", "codigos_fipe": [(codigo, score)], "situacao"}`:
  - leia os campos como `vehicle_catalog/views.py:218-279` (`_normalize_plate_response`) lê hoje;
  - 402/403 loga "token API Placas inválido" e devolve `None`.
- Produces a resposta de placa:
  - `fields = {"vehicle": catalog_path(...) | None, "color": {"value", "label"} | None, "year_manufacture": int | None, "restricao": {"situacao": str, "consultado_em": iso} | None}`;
  - `unmatched` recebe os textos que não casaram;
  - nunca devolve o chassi.
- Produces as regras:
  - **DB-first:** a última `ServiceOrder` do tenant com aquela placa e `catalog_family` dá o veículo, a cor e o ano de fabricação, com `source="os"`;
  - **Casamento:** tenta `match_vehicle(marca, f"{modelo} {versao}", ano_modelo, codigo_fipe=c)` para cada código, do maior score para o menor, e para no primeiro `exata`. Se nenhum for exato, faz o casamento por texto. O caminho volta até onde casou (só a make, só a família ou a versão);
  - **Restrição:** vem do cache (365 d). Se o cache tem mais de 30 dias ou não existe, consulta a API de novo, mesmo havendo OS no banco. Se a API falhar, devolve a restrição antiga com o `consultado_em` antigo.
- Produces no health: `checks["api_placas_saldo"] = {"saldo": int, "baixo": saldo < 100}`, com cache de 1 h em `lookup:apiplacas:saldo`. O status HTTP do health não muda por causa disso.

- [ ] **Step 1: Escrever os testes** (`TenantTestCase`, `respx`, `override_settings(APIPLACAS_TOKEN="t", CACHES=LOCMEM)`, `load_fipex(SAMPLE)`)

- `test_codigo_fipe_vira_versao_exata`: a fixture com `codigos_fipe` `[("002111-3", 90)]` e ano 2023 dá `fields["vehicle"]["version"]["label"] == "2023 Flex"` e `color["value"] == "BRANCA"`;
- `test_sem_codigo_casa_por_texto_ate_onde_der`;
- `test_os_no_banco_dispensa_api_mas_restricao_velha_reconsulta`: com uma OS do tenant com a placa e o cache de 31 dias, a API é chamada uma vez e o veículo vem da OS;
- `test_restricao_recente_nao_reconsulta`;
- `test_402_found_false_sem_logar_placa`;
- `test_resposta_nao_tem_chassi`;
- `test_health_saldo_cacheado`: duas chamadas ao healthz geram um único GET de saldo.

- [ ] **Step 2: Rodar e ver falhar → implementar → rodar** (`docker exec paddock_django pytest apps/lookups apps/authentication -v`)

- [ ] **Step 3: Commit** `feat(dscar): consulta de placa casada com o catálogo e alerta de restrição renovado em 30 dias`

---

# Parte 5 — Telas

### Task 15: `VehicleCatalogPicker`, hooks de catálogo e de consulta

**Files:**
- Run first: `make gen-api-types` (gera `src/types/api.d.ts`).
- Create:
  - `components/vehicle/catalog.schema.ts`;
  - `components/vehicle/CatalogCombobox.tsx`;
  - `components/vehicle/VehicleCatalogPicker.tsx`;
  - `components/vehicle/MakeLogo.tsx`.
- Create:
  - `hooks/useCatalog.ts`;
  - `hooks/useLookup.ts`;
  - `lib/prefill.ts`.
- Modify: `hooks/index.ts` (exports).
- Test:
  - `components/vehicle/VehicleCatalogPicker.test.tsx`;
  - `lib/prefill.test.ts`;
  - `hooks/useLookup.test.ts`.

**Interfaces:**
- Consumes: os endpoints das Tasks 6, 8, 12, 13 e 14.
- Produces em `catalog.schema.ts`:
  - `catalogOptionSchema = z.object({ id: z.number(), label: z.string(), logo_url: z.string().optional() })`;
  - `catalogSelectionSchema = z.object({ tipo: z.enum(["carro","moto","caminhao"]), make: catalogOptionSchema, family: catalogOptionSchema.nullable(), model: catalogOptionSchema.nullable(), version: catalogOptionSchema.nullable() })`, com `export type CatalogSelection`. É o mesmo formato de `catalog_path`;
  - `paginatedSchema<T>(item: T)`;
  - `lookupResultSchemas = { cep, cnpj, placa }`, que validam `{found, source, fields, unmatched}`.
- Produces em `useCatalog.ts`: `useCatalogOptions(level: "makes" | "families" | "models" | "years", params: { tipo?: string; marca?: number; familia?: number; modelo?: number; ano?: number }, search: string)`.
  - Usa `useInfiniteQuery` com `page_size=50` em `/api/proxy/vehicle-catalog/{level}/`.
  - Fica desligado quando falta o pai.
  - Valida cada página com Zod.
- Produces em `useLookup.ts`: `useLookup<K extends "cep" | "cnpj" | "placa">(kind: K, key: string | null)`.
  - Faz `useQuery` com POST `/api/proxy/lookups/{kind}/` e `{key}`.
  - Fica ligado quando `key !== null`.
  - Usa `retry: false` e `staleTime: 10 min`, e valida com Zod.
  - Quem chama fixa `key` no blur ou no botão, com debounce de 400 ms.
- Produces em `prefill.ts`: `applyIfEmpty<T extends FieldValues>(form: UseFormReturn<T>, values: Partial<Record<Path<T>, unknown>>): void`.
  - Só chama `setValue(name, v, { shouldDirty: true })` quando o valor atual é vazio: `""`, `null`, `undefined` ou `"NAO_INFORMADA"`.
- Produces o componente `VehicleCatalogPicker`:
  - props `{ value: CatalogSelection | null; onChange(sel: CatalogSelection | null): void; sourceText?: string; error?: string; disabled?: boolean }`;
  - o tipo é um seletor de três botões (Carro / Moto / Caminhão), com carro como padrão;
  - quatro `CatalogCombobox` com os rótulos Montadora, Modelo, Versão e Ano;
  - trocar um nível limpa os de baixo;
  - quando há família sem versão, mostra o selo "Versão a confirmar";
  - quando vem `sourceText`, mostra "Como veio da fonte: …" (só leitura);
  - não existe botão de preencher manualmente nem input livre.
- Produces o componente `CatalogCombobox`:
  - `Popover` (`components/ui/popover.tsx`) + `cmdk` `Command` com `shouldFilter={false}`;
  - a busca vai ao servidor com debounce de 300 ms;
  - a lista tem o item "Carregar mais" quando há `hasNextPage`;
  - estados: Skeleton no loading, "Nenhum resultado" no vazio e aviso discreto no erro.
- Produces o componente `MakeLogo`: mostra o logo da montadora ou o monograma, no padrão do `InsurerLogo` (`InsurerSelect.tsx:19-57`).

- [ ] **Step 1: Escrever os testes**

```tsx
// prefill.test.ts — Review Focus 4
it("não sobrescreve e marca dirty", () => {
  const { result } = renderHook(() => useForm({ defaultValues: { color: "PRETA", chassis: "" } }));
  act(() => applyIfEmpty(result.current, { color: "BRANCA", chassis: "9BW" }));
  expect(result.current.getValues()).toEqual({ color: "PRETA", chassis: "9BW" });
  expect(result.current.formState.dirtyFields).toEqual({ chassis: true });
});
// VehicleCatalogPicker.test.tsx (vi.mock("@/lib/api"), QueryClientProvider retry:false)
it("trocar a montadora limpa modelo, versão e ano", ...);
it("família sem versão mostra 'Versão a confirmar'", ...);
it("não tem campo de texto livre", () => { ...; expect(screen.queryByPlaceholderText(/Ex:/)).toBeNull(); });
it("busca da versão manda o texto ao servidor", ...);   // apiFetch chamado com search=lt%201.0
// useLookup.test.ts
it("found:false é estado normal, não erro", ...);
it("payload fora do schema vira erro", ...);
it("não dispara com key null", ...);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/dscar-web && npx vitest run src/lib/prefill.test.ts src/components/vehicle src/hooks/useLookup.test.ts`.

- [ ] **Step 3: Implementar** (componentes e hooks acima)

- [ ] **Step 4: Rodar**

Run: `npx vitest run` e `npm run typecheck` → PASS.

- [ ] **Step 5: Commit** `feat(dscar): seletor único de veículo em cascata com busca no servidor`

---

### Task 16: OS e recepção no seletor; a API de OS fecha o texto

**Files:**
- Modify:
  - `app/(app)/os/_components/new-os.schema.ts:24-54`: sai `make`/`model`/`vehicle_version`/`fuel_type`/`year`; entram `catalog_selection` (obrigatório com `family`), `year_manufacture` e `color`;
  - `os/_components/NewOSDrawer.tsx`: defaults 81-87, auto-preenchimento 108-131, bloco do veículo 257-336.
- Modify:
  - `app/(app)/recepcao/page.tsx`: `STEP_FIELDS[0]` 25-30 vira `["plate", "catalog_selection"]`; o resumo 151-158 usa `catalog_selection`;
  - `recepcao/_components/StepPlaca.tsx` 36-66 e 110-130: entra o picker e o `ColorSelect`.
- Modify:
  - `app/(app)/os/[numero]/_components/sections/VehicleSection.tsx`:
    - a placa (104-142) usa `useLookup` no blur;
    - entram o picker e `ColorSelect`;
    - saem o combustível em texto (172-173), o ano livre (176-184), o valor FIPE digitado (194-202) e o `make_logo` hidden (207);
    - o valor FIPE e o combustível aparecem só para leitura, a partir do snapshot;
    - o picker recebe `sourceText={order.vehicle_source_text}`.
  - `StepPlaca` e `NewOSDrawer` mostram o alerta de restrição quando `fields.restricao.situacao` não é normal.
  - `os/[numero]/_schemas/service-order.schema.ts:68-124`;
  - `_utils/form-defaults.ts:69-78`: `catalog_selection` vem de `order.catalog_path`;
  - `_v2/dados/DadosWorkspace.tsx:92-98`: o PATCH mapeia `catalog_selection` para `catalog_family`/`catalog_version`;
  - um banner de `import_warnings` com o botão "Dispensar", que faz PATCH `import_warnings: []`.
- Modify: `packages/types/src/service-order.types.ts:338-351`: `catalog_family`, `catalog_version`, `catalog_path`, `vehicle_needs_review`, `vehicle_source_text`, `year_manufacture`, `zero_km`, `insurer_cnpj` e `import_warnings`.
- Modify (backend, fechar o texto) em `apps/service_orders/serializers/core.py`:
  - Create e Update: `make`, `make_logo`, `model`, `vehicle_version`, `year`, `fuel_type`, `fipe_value` e `vehicle_fipe_value_snapshot` entram em `read_only_fields`, e as `extra_kwargs` deles saem (669-680, 805-817);
  - `validate()` do Create, **depois** da checagem de seguradora (682-712): sem `catalog_family` e sem `catalog_version`, devolve `{"catalog_family": "Escolha a montadora e o modelo."}`;
  - `validate()` do Update: o mesmo, só quando o payload traz uma das duas chaves e a família resultante é `None`;
  - apagar o `create()` morto (743-769) e `_MAKE_LOGOS` (715-741). A view nunca chama `serializer.save()` (`views/orders.py:307-312`).
- Modify (testes):
  - `apps/service_orders/tests/test_catalog_vehicle.py`: trocar `test_sem_catalogo_continua_aceitando_texto` por `test_sem_familia_400`;
  - `tests/test_legacy_core.py:215-245`: o payload passa a ter `catalog_family`;
  - `e2e/service-order-form.spec.ts:41,91-92`: o placeholder da placa vira `ABC-1D23`, e o passo do veículo usa o picker (buscar "Chevrolet" → "Onix Plus").
- Test:
  - `app/(app)/os/_components/NewOSDrawer.test.tsx`;
  - `os/[numero]/_components/sections/VehicleSection.test.tsx`.

**Interfaces:**
- Consumes: `VehicleCatalogPicker`, `useLookup`, `applyIfEmpty` e `catalogSelectionSchema` (Task 15); `ColorSelect` (Task 8).
- Produces o payload de criação, que passa a ser `{..., plate, catalog_family, catalog_version, color, year_manufacture, chassis}`.

- [ ] **Step 1: Escrever os testes**

`NewOSDrawer.test.tsx`:
- enviar sem família mostra "Escolha a montadora e o modelo";
- a placa encontrada com o caminho completo preenche o picker e a cor, e mostra o alerta quando `restricao.situacao` não é normal;
- a placa encontrada não troca uma família já escolhida.

`VehicleSection.test.tsx`:
- o que a placa preencheu entra nos `dirtyFields`;
- não existe input de combustível, de ano nem de valor FIPE.

Backend: `test_sem_familia_400` e `test_patch_make_texto_ignorado`, em que `make="X"` não muda nada.

- [ ] **Step 2: Rodar e ver falhar**

Run:
- `npx vitest run src/app/\(app\)/os`;
- `docker exec paddock_django pytest apps/service_orders -q`.

- [ ] **Step 3: Implementar.** A placa consulta no blur e no botão "Consultar", nunca no 7º caractere (remova os `handlePlateChange` de 127-131 e 62-66).

- [ ] **Step 4: Rodar tudo**

Run:
- `docker exec paddock_django pytest apps/service_orders apps/budgets apps/cilia -q`;
- `cd apps/dscar-web && npm run typecheck && npx vitest run`.

Expected: PASS.

- [ ] **Step 5: Commit** `feat(dscar): abertura de OS, recepção e dados da OS usam o seletor de veículo`

---

### Task 17: Orçamento particular no seletor; a API de orçamento fecha o texto

**Files:**
- Modify: `app/(app)/orcamentos-particulares/novo/page.tsx`
  - sai o `usePlateLookup` local (63-76);
  - sai o auto-preenchimento que sobrescreve (102-121);
  - saem os campos livres 264-360;
  - o formulário passa a RHF + Zod com `catalog_selection`, `ColorSelect`, `year_manufacture`, `chassis` e o alerta de restrição vindo de `useLookup("placa")`.
- Modify: `packages/types/src/budget.types.ts:105-116` (`BudgetCreatePayload`).
- Modify (backend) em `apps/budgets/serializers.py:110-120`:
  - `catalog_family` e `catalog_version` (`PrimaryKeyRelatedField`, ativos);
  - `vehicle_color` (`ChoiceField(CorVeiculo)`);
  - `vehicle_year_manufacture`;
  - `validate`: sem família nem versão → 400;
  - saem `vehicle_description`, `vehicle_version`, `vehicle_engine`, `vehicle_fuel_type` e `vehicle_make_logo` da entrada.
- Modify: `apps/budgets/services.py:38-75`: a assinatura troca os textos pelas FKs.
- Modify: `apps/budgets/tests/test_views.py:59-67`: `test_create_as_consultant` passa a enviar `catalog_version`.
- Test: `app/(app)/orcamentos-particulares/novo/page.test.tsx` e `apps/budgets/tests/test_catalog_vehicle.py` (ampliar).

**Interfaces:**
- Consumes: Task 15.
- Produces `BudgetCreatePayload = { customer_id: number; vehicle_plate: string; catalog_family: number; catalog_version: number | null; vehicle_color: string; vehicle_year_manufacture: number | null; vehicle_chassis: string }`.

- [ ] **Step 1: Escrever os testes**

- backend: `test_budget_sem_familia_400` e `test_budget_so_familia_201_com_selo`;
- front: a placa não sobrescreve a cor escolhida, e o envio monta o payload com os ids.

- [ ] **Step 2: Rodar e ver falhar → implementar → rodar**

Run:
- `docker exec paddock_django pytest apps/budgets -q`;
- `npx vitest run src/app/\(app\)/orcamentos-particulares && npm run typecheck`.

- [ ] **Step 3: Commit** `feat(dscar): orçamento particular escolhe o veículo no catálogo`

---

### Task 18: Remover as implementações antigas

**Files:**
- Delete (backend):
  - em `apps/vehicle_catalog/views.py`: `plate_lookup` e helpers (74-453), a rota `plate/` em `urls.py`, as actions `makes/{id}/models/` (469-487) e `models/{id}/years/` (516-529), e `tests/test_plate_lookup.py`;
  - o model `PlateCache` (73-100; `DeleteModel`, próxima migration).
- Delete (backend):
  - em `apps/vehicles/services.py`: `lookup_plate`, `_persist_from_plate_data` e `_parse_year` (90 e vizinhos);
  - em `apps/vehicles/views.py`: a action `lookup` (27-36);
  - os testes de lookup em `apps/vehicles/tests/test_services.py` e `test_api.py`.
- Delete (front):
  - `app/api/plate/[plate]/route.ts`;
  - `components/vehicle/VehicleFipeFields.tsx`;
  - `components/vehicle/FipeSelectGroup.tsx`;
  - `hooks/useVehicleFipe.ts` e os exports em `hooks/index.ts:121-127`;
  - `usePlateLookup` em `app/(app)/os/[numero]/_hooks/useVehicleCatalog.ts:18-41`.
- Modify:
  - `hooks/useServiceOrders.ts:90-96`: `usePlateApi` passa a chamar `POST /api/proxy/lookups/placa/` e adaptar `fields.vehicle` para o `VehicleData` de `VehiclePlateSearch`, só para a tela pausada `orcamentos/novo` continuar abrindo;
  - `app/(app)/cadastros/montadoras/page.tsx:11,18` e `_components/MakeLogoDialog.tsx:11`: usam `useCatalogOptions("makes", { tipo }, search)` com paginação; logo e desativar ficam dentro de `<PermissionGate role="ADMIN">`.
- Test: nenhum novo. A prova é a suíte inteira verde e o `rg` limpo.

- [ ] **Step 1: Apagar e ajustar os imports**

- [ ] **Step 2: Conferir que não sobrou referência**

Run:

```bash
rg -n "plate_lookup|lookup_plate|PlateCache|VehicleFipeFields|FipeSelectGroup|useVehicleFipe|api/plate/|/models/\"|years/\"" backend/core/apps apps/dscar-web/src
```

Expected: nenhuma linha fora de migrations e de `api.d.ts` (que é regenerado no próximo passo).

- [ ] **Step 3: Gerar a migration, os tipos e rodar tudo**

Run:
- `docker exec paddock_django python manage.py makemigrations vehicle_catalog`;
- `make gen-api-types`;
- `docker exec paddock_django pytest -q`;
- `cd apps/dscar-web && npm run typecheck && npx vitest run`.

Expected: PASS.

- [ ] **Step 4: Commit** `refactor(dscar): remove as três consultas de placa antigas, o PlateCache e os campos FIPE livres`

---

### Task 19: Cadastro de pessoa — CEP, CNPJ, município e IBGE preservado

**Files:**
- Modify: `components/Cadastros/PersonFormModal.tsx`
  - `handleCepBlur` (229-240): passa para `useLookup("cep")` + `applyIfEmpty`, com o `municipio_ibge` gravado;
  - o campo IBGE digitado (703-717) vira `MunicipioCombobox`;
  - no blur do documento CNPJ, `useLookup("cnpj")` + `applyIfEmpty` em razão social, fantasia, endereço e município; situação diferente de "ATIVA" vira aviso âmbar;
  - `ALL_ROLES` (`:102`) perde `"INSURER"`, mas o papel é mantido quando a pessoa já o tem;
  - ao lado do CPF, um link "Conferir na Receita" que abre `https://servicos.receita.fazenda.gov.br/servicos/cpf/consultasituacao/consultapublica.asp` em nova aba, sem passar o CPF na URL.
- Create: `components/Cadastros/MunicipioCombobox.tsx`, com a UF (select das 27) → `GET /api/proxy/lookups/municipios/?uf=&search=`.
- Modify: `app/(app)/os/[numero]/_components/sections/CustomerSection.tsx`
  - 212-241: `addr` inclui `municipio_ibge`;
  - `:272`: envia **todos** os endereços da pessoa, trocando só o principal, porque o backend apaga e recria (`persons/serializers.py:372-376`);
  - 293-310: `applyIfEmpty`.
- Modify: `app/(app)/rh/colaboradores/novo/page.tsx:86,117-130`: `useLookup("cep")` + `applyIfEmpty`.
- Delete:
  - `useCepLookup` (`hooks/usePersonMutations.ts:16-21`) e o export (`hooks/index.ts:22`);
  - `CepData` (`packages/types/src/person.types.ts:72-79`);
  - o backend `persons/views.py:107-134` (`cep_lookup`).
- Modify:
  - `packages/utils/src/validators.ts:31-48`: `isValidCNPJ` alfanumérico, com o mesmo algoritmo da Task 4;
  - `apps/persons/serializers.py:342-345` (`validate_roles`): recusa **adicionar** `INSURER` com a mensagem "Seguradoras são cadastradas em Cadastros → Seguradoras.". Manter o papel numa pessoa que já o tem continua permitido.
- Test:
  - `components/Cadastros/PersonFormModal.test.tsx`;
  - `CustomerSection.test.tsx`;
  - `src/lib/validators.test.ts`, que importa de `@paddock/utils` (se o vitest não resolver, adicione o alias em `vitest.config.ts`);
  - `apps/persons/tests/test_roles_insurer.py`.

**Interfaces:**
- Consumes: `useLookup` e `applyIfEmpty` (Task 15); `/lookups/municipios/` (Task 4); `/lookups/cep/` e `/lookups/cnpj/` (Tasks 12 e 13).

- [ ] **Step 1: Escrever os testes**

Front:
- o CEP preenche só a rua vazia e grava `municipio_ibge`;
- o CEP com falha deixa escolher UF → município;
- o CNPJ com situação "BAIXADA" mostra o aviso;
- `CustomerSection` salva o endereço mantendo `municipio_ibge` e os outros endereços;
- `isValidCNPJ("12.ABC.345/01DE-35")` é true e `isValidCNPJ("12ABC34501DE36")` é false.

Backend:
- POST de pessoa com `roles=["INSURER"]` → 400;
- PATCH de uma pessoa INSURER existente com `roles=["INSURER"]` → 200.

- [ ] **Step 2: Rodar e ver falhar → implementar → rodar**

Run:
- `npx vitest run src/components/Cadastros src/app/\(app\)/os src/lib/validators.test.ts && npm run typecheck`;
- `docker exec paddock_django pytest apps/persons -q`.

- [ ] **Step 3: Commit** `feat(dscar): cadastro de pessoa preenche por CEP e CNPJ e sempre guarda o código IBGE`

---

### Task 20: Seguradoras — fonte única, permissões, filtro da lista e tomador fiscal

**Files:**
- Modify: `apps/insurers/views.py:46-181`
  - sai `DestroyModelMixin` (47-54);
  - `write_permission = IsAdminOrAbove`;
  - `get_queryset` (68-71) aceita `?include_inactive=true` só para ADMIN+;
  - o cache do `list` (78-84) só vale sem querystring;
  - novas actions `tomadores` (GET) e `tomador` (POST), as duas ADMIN+.
- Modify:
  - `apps/service_orders/billing.py:90-125,366-378`: `_resolve_insurer_person(insurer, cnpj: str = "")` busca por `cnpj or insurer.cnpj`, e o chamador passa `order.insurer_cnpj`;
  - `ServiceOrderService.create`: `insurer_cnpj` vazio com seguradora vira os dígitos de `insurer.cnpj`;
  - `validate()` do Create e do Update: `insurer_cnpj` precisa estar em `insurer.cnpjs`.
- Modify (front):
  - `app/(app)/cadastros/seguradoras/page.tsx`: "Nova" (89-93, 117), "Editar" e logo dentro de `<PermissionGate role="ADMIN">`; "Remover" (45-57, 207-215) vira "Desativar"/"Reativar" (PATCH `is_active`);
  - `_components/InsurerDialog.tsx:17,22-25`: CNPJ com `isValidCNPJ`, mais `cnpjs` e `trade_names` editáveis (um por linha);
  - `[id]/page.tsx`: painel "Tomador da nota" por CNPJ, com "Criar tomador (busca na Receita)" ou "Abrir cadastro".
- Modify (front):
  - `components/Cadastros/index.tsx:27-35`: a aba `INSURER` (`:33`) vira link para `/cadastros/seguradoras`;
  - `app/(app)/os/page.tsx:37,98-104,148,155`: o filtro usa `useInsurers()` e envia o UUID;
  - `os/_components/NewOSDrawer.tsx`: com uma seguradora de mais de um CNPJ, aparece um select "CNPJ da nota" com o principal pré-selecionado.
- Modify: `hooks/useInsurers.ts`: `useDeleteInsurer` sai e `useSetInsurerActive` entra.
- Modify (testes):
  - `apps/insurers/tests/test_tenant_profile_endpoint.py:16`: `force_authenticate` com `token={"role": "ADMIN"}`;
  - `apps/service_orders/tests/test_billing_person_resolution.py:64-120`: passa o CNPJ da OS.
- Test:
  - `apps/insurers/tests/test_permissions.py`;
  - `test_tomador.py`;
  - `apps/service_orders/tests/test_insurer_cnpj.py`;
  - `app/(app)/cadastros/seguradoras/page.test.tsx`.

**Interfaces:**
- Consumes: `lookup("cnpj", ...)` (Task 13); `Insurer.cnpjs` (Task 5); `ServiceOrder.insurer_cnpj` (Task 7).
- Produces:
  - `GET /api/v1/insurers/{id}/tomadores/` → `[{"cnpj", "person_id": int | None, "person_name": str, "has_address": bool}]`;
  - `POST /api/v1/insurers/{id}/tomador/` (`{"cnpj"}`) → `{"person_id"}`:
    - faz `get_or_create` de uma `Person` PJ com `full_name = insurer.name`, papel `INSURER` e `PersonDocument` CNPJ primário;
    - preenche o endereço por `lookup("cnpj")` quando acha;
    - é idempotente.

- [ ] **Step 1: Escrever os testes**

Permissões:
- MANAGER: POST e PATCH → 403;
- ADMIN: PATCH `is_active=false` → 200;
- não existe DELETE → 405;
- CONSULTANT: `?include_inactive=true` não vê inativa;
- `?search=porto` não envenena a lista sem busca.

Tomador:
- o POST cria uma Person INSURER com CNPJ e endereço (respx com a fixture do CNPJá);
- um segundo POST devolve o mesmo id.

Billing:
- uma OS com `insurer_cnpj` de filial resolve a Person daquele CNPJ;
- sem `insurer_cnpj`, usa o principal.

OS:
- `insurer_cnpj` fora de `insurer.cnpjs` → 400.

Front:
- CONSULTANT não vê "Nova Seguradora";
- "Desativar" chama PATCH.

- [ ] **Step 2: Rodar e ver falhar → implementar → rodar**

Run:
- `docker exec paddock_django pytest apps/insurers apps/service_orders apps/fiscal -q`;
- `npx vitest run src/app/\(app\)/cadastros && npm run typecheck`.

- [ ] **Step 3: Verificação final do branch**

Run:
- `docker exec paddock_django pytest -q`;
- `docker exec paddock_django black --check apps && docker exec paddock_django isort --check-only apps`;
- `cd apps/dscar-web && npm run typecheck && npx vitest run`.

Expected: tudo verde.

- [ ] **Step 4: Commit** `feat(dscar): seguradora vira fonte única com edição só de admin e tomador fiscal por CNPJ`

---

# Adendo de 22/10/2026 — chassi e placa só gratuita

**Pedido do dono, depois das 20 tasks:** "precisamos também de busca por chassis do veículo" e, sobre a placa, "Só gratuito". Ele também pediu uma busca gratuita ou interna no catálogo para o chassi, além de achar OS pelo chassi e de o chassi preencher o veículo.

**Muda a decisão da spec.** Na tabela "Fontes por tipo", a placa era "API Placas, R$ 0,03/consulta". Agora a API Placas fica desligada por configuração, e a placa passa a buscar só no histórico de OS do tenant. O alerta automático de roubo/furto deixa de existir, e no lugar entra um aviso fixo para conferir no app Sinesp Cidadão. Não existe API gratuita de placa: o SINESP não publica uma, e as bibliotecas que o consultam funcionam por engenharia reversa do app.

**Chassi, sempre gratuito e na ordem abaixo:**
1. Última OS do tenant com o mesmo chassi (veículo completo).
2. Regra aprendida no catálogo: `VehicleAlias(source="chassi")` com chave `alias_key(chassi[:8], ano_modelo)`.
   - Os 8 primeiros caracteres são o WMI mais o VDS e identificam o modelo de fábrica, não o carro.
   - A regra nasce quando uma OS com chassi válido fica com a versão confirmada pela tela.
   - Ela passa a "exata" com 2 confirmações iguais, ou com aprovação do admin.
3. Decodificação local: a montadora vem do WMI e o ano-modelo do 10º caractere.

Nenhuma fonte externa é usada.

### Task 21: Placa só gratuita

**Files:**
- Modify:
  - `backend/core/config/settings/base.py:400-403`: acrescentar `APIPLACAS_ENABLED = config("APIPLACAS_ENABLED", default=False, cast=bool)`, e a mesma chave no `.env.example`;
  - `apps/lookups/service.py`: `_chain` e `_lookup_placa`;
  - `apps/authentication/views_health.py`.
- Modify: `apps/dscar-web/src/components/vehicle/PlacaLookup.tsx`. Acrescentar `SinespHint` e usá-lo nas 4 telas que já usam o `PlacaLookup` (NewOSDrawer, StepPlaca, VehicleSection e orçamento particular).
- Modify:
  - `docs/superpowers/specs/2026-10-19-catalogo-veiculos-seguradoras-consultas-design.md`: uma nota datada em "Decisões do dono" e na tabela "Fontes por tipo";
  - este plano: item 20 dos Desvios.
- Test: `apps/lookups/tests/test_placa.py`, o teste do health em `apps/authentication/tests/` e `PlacaLookup.test.tsx`.

**Interfaces:**
- Produces:
  - com `APIPLACAS_ENABLED=False`, `lookup("placa", ...)` nunca faz chamada HTTP e não lê nem grava o cache de placa;
    - devolve o DB-first da OS (`source="os"`, `restricao=None`), ou `found: False` com `source="none"`;
  - com `True`, o comportamento atual continua igual;
  - o health, com a API desligada, reporta `checks["api_placas"] = "disabled"`, conta como ok e não consulta o saldo;
  - o componente `SinespHint` mostra o texto "Roubo/furto: confira no app Sinesp Cidadão." abaixo do campo de placa, sempre que uma consulta de placa já rodou.

- [ ] **Step 1: Escrever os testes**
  - `test_api_desligada_nao_chama_rede`: com respx sem rotas (qualquer chamada falha), dá `found: False`, `source == "none"`, e nenhuma chave `lookup:placa:*` no cache;
  - `test_api_desligada_usa_os_do_tenant`: devolve o veículo da OS, com `restricao` None;
  - `test_api_ligada_continua_igual`: um teste existente com `override_settings(APIPLACAS_ENABLED=True)`;
  - `test_health_api_desligada_200_sem_saldo`: o health responde 200, e a rota de saldo não é chamada;
  - vitest: `SinespHint` aparece depois da consulta e não aparece antes.
- [ ] **Step 2: Rodar e ver falhar → implementar → rodar.** Use `docker exec paddock_django timeout 1800 pytest apps/lookups apps/authentication -q` e, no front, `npx vitest run src/components/vehicle` mais `npm run typecheck`.
- [ ] **Step 3: Commit** `feat(dscar): consulta de placa só gratuita, com a API Placas desligada por padrão`

### Task 22: Chassi no backend — busca de OS e consulta gratuita com regra aprendida

**Files:**
- Modify: as buscas.
  - `apps/service_orders/views/orders.py:181`: `search_fields` ganha `"chassis"`;
  - `apps/budgets/views.py:36`: `search_fields` ganha `"vehicle_chassis"`.
- Modify: a consulta por chassi.
  - `apps/lookups/service.py`: `Kind`, `_clean_key`, `lookup` e o novo `_lookup_chassi`;
  - `apps/lookups/urls.py`: a regex passa a `cep|cnpj|placa|chassi`;
  - `apps/lookups/validators.py`: `decode_vin` ganha `tipo_hint` (`"moto"` para os WMI `9C2` e `9C6`, senão `"carro"`).
- Modify:
  - `apps/vehicle_catalog/models.py`: `VehicleAlias.Source` ganha `CHASSI = "chassi", "Chassi"`, com migration só de choices;
  - `apps/vehicle_catalog/matching.py`: nova função `vin_rule_key(vin: str) -> str | None`.
- Modify: `apps/service_orders/services/order_service.py`, nos pontos de `create` (≈96) e `update` (≈319), para gravar o aprendizado.
- Test: `apps/lookups/tests/test_chassi.py` e `apps/service_orders/tests/test_chassi_search.py`.

**Interfaces:**
- Produces:
  - `vin_rule_key(vin) -> str | None` = `alias_key(vin[:8], decode_vin(vin).model_year)`, ou `None` quando o VIN é inválido ou não tem ano;
  - `lookup("chassi", vin) -> LookupResult` com `fields = {"vehicle": catalog_path | None, "color": {value,label} | None, "year_manufacture": int | None, "ano_modelo": int | None, "confianca": "exata" | "alta" | None}`. O campo `source` diz de onde veio:
    - `"os"`: a última OS ativa do tenant com `chassis__iexact` e `catalog_family`;
    - `"regra"`: um `VehicleAlias` de `source="chassi"` com aquela chave e alvo ativo. A confiança é `"exata"` se `is_exact`, senão `"alta"`;
    - `"vin"`: só a make ativa cujo `display_name` normalizado é igual a `decode_vin(vin).make_hint`, com o tipo vindo de `tipo_hint` e carro como padrão, mais o `ano_modelo`;
    - `"none"`: nada casou. Com VIN inválido, `found` é False e `source` é `"invalid"`;
  - a consulta não usa cache nem fonte externa e é sempre 200. O chassi nunca aparece em log;
  - **aprendizado:** chama `record_alias_confirmation("chassi", chassis[:8], model_year, version=order.catalog_version, family=order.catalog_family)` quando, depois de `create` ou `update`:
    - a OS tem `catalog_version`;
    - `vehicle_needs_review` é False;
    - o `chassis` é um VIN válido;
    - e, no `update`, o par do catálogo ou o chassi mudou.

    PATCH que não mexe em veículo nem em chassi não conta.

- [ ] **Step 1: Escrever os testes** (`TenantTestCase`; a carga vai no `setUp`, como manda o adendo das constraints)
  - `test_busca_os_por_final_do_chassi`: `GET /service-orders/?search=254082` acha a OS com chassi `8AC907655SE254082`;
  - `test_busca_orcamento_por_chassi`;
  - `test_chassi_da_os_anterior`: `source == "os"`, com o caminho completo;
  - `test_regra_aprendida`:
    - uma OS criada pela tela com a versão 021506-6 (Sprinter 2025) e o chassi `8AC907655SE254082`;
    - um `lookup` de `8AC90765XSE999999` (outro carro, mesmo prefixo e mesmo ano) dá `source == "regra"` e `confianca == "alta"`;
    - depois de uma segunda OS confirmada, dá `"exata"`;
  - `test_patch_sem_veiculo_nao_conta_confirmacao`;
  - `test_decodificacao_local`: um chassi `8AC...S...` sem histórico dá `source == "vin"`, a make "Mercedes-Benz" do tipo carro e `ano_modelo == 2025`;
  - `test_wmi_de_moto_escolhe_make_moto`: `9C2...` dá a make Honda do tipo moto;
  - `test_vin_invalido_200`: dá `found` False e `source == "invalid"`;
  - `test_chassi_fora_do_log`: o caplog não contém o chassi.
- [ ] **Step 2: Rodar e ver falhar → implementar → rodar** com `docker exec paddock_django timeout 1800 pytest apps/lookups apps/vehicle_catalog/tests/test_matching.py apps/service_orders/tests/test_chassi_search.py apps/service_orders/tests/test_catalog_vehicle.py -q`.
- [ ] **Step 3: Commit** `feat(dscar): busca de OS pelo chassi e consulta gratuita que aprende o modelo pelo chassi`

### Task 23: Chassi nas telas

**Files:**
- Modify:
  - `apps/dscar-web/src/hooks/useLookup.ts` e `components/vehicle/catalog.schema.ts`: kind `"chassi"`, com o schema Zod dos `fields` da Task 22;
  - `components/vehicle/PlacaLookup.tsx`: generalizar `usePlacaLookup` para `useVehicleLookup(kind: "placa" | "chassi", onFound)`, mantendo o padrão de nonce e o `reset`. Sem duplicar o hook.
- Modify: o campo de chassi passa a consultar no blur, quando tem 17 caracteres válidos.
  - `app/(app)/os/_components/NewOSDrawer.tsx`;
  - `app/(app)/recepcao/_components/StepPlaca.tsx`;
  - `app/(app)/os/[numero]/_components/sections/VehicleSection.tsx`;
  - `app/(app)/orcamentos-particulares/novo/page.tsx`.
- Modify: `app/(app)/os/page.tsx:243`: o placeholder passa a "Buscar OS (placa, chassi, nº, cliente)...".
- Test: `components/vehicle/PlacaLookup.test.tsx` (ampliar) e `app/(app)/os/_components/NewOSDrawer.test.tsx` (ampliar).

**Interfaces:**
- Consumes: Task 22.
- Produces: no blur do chassi, `applyIfEmpty` / `placaPrefill` preenchem a seleção do catálogo e a cor, e `keepYearManufacture` preenche o ano de fabricação. Nunca sobrescreve o que já foi escolhido.
  - Com `source="vin"`, só a montadora é pré-selecionada (família vazia), com a dica "Pelo chassi: <Montadora>, ano-modelo <ano>".
  - Com `source="regra"` e confiança `"alta"`, a versão vem pré-selecionada, com a dica "Sugerido pelo chassi — confirme a versão".

- [ ] **Step 1: Escrever os testes**
  - o hook com `"chassi"` chama `POST /api/proxy/lookups/chassi/` com o chassi no corpo;
  - NewOSDrawer:
    - um resultado `os` preenche o picker;
    - um resultado `vin` pré-seleciona só a montadora;
    - nada sobrescreve uma família já escolhida;
    - um chassi com menos de 17 caracteres não consulta.
- [ ] **Step 2: Rodar e ver falhar → implementar → rodar** com `npx vitest run src/components/vehicle src/app/\(app\)/os src/app/\(app\)/recepcao src/app/\(app\)/orcamentos-particulares` mais `npm run typecheck`. Antes, rode `make gen-api-types` se o OpenAPI mudou.
- [ ] **Step 3: Commit** `feat(dscar): chassi preenche o veículo nas telas de OS, recepção e orçamento`
