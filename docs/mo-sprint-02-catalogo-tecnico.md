# MO-Sprint 02 — Catálogo Técnico

**Duração:** 2 semanas | **Equipe:** Solo + Claude Code | **Prioridade:** P0
**Pré-requisitos:** MO-1 fechado · **Desbloqueia:** MO-3, MO-4, MO-5

---

## Objetivo

Criar o núcleo imutável do motor: `ServicoCanonico`, `PecaCanonica`,
`MaterialCanonico`, `InsumoMaterial`, `CategoriaMaoObra`, `Fornecedor` e o
mecanismo de aliases (fuzzy + pgvector). Sem catálogo canônico bem
estruturado, aliases explodem, orçamento não amarra, ficha técnica não
referencia nada estável.

---

## Referências obrigatórias

1. `/CLAUDE.md` — normalização de texto, padrão `embedding` via pgvector.
2. `docs/mo-roadmap.md` — seção "Arquitetura de apps", armadilha A1 (mutabilidade).
3. Spec v3.0 — §5 (catálogo técnico), §13 (motor de aliases).
4. `apps.persons.models.Pessoa` — base para `Fornecedor`.

---

## Escopo

### 1. Novo app: `apps.pricing_catalog` (TENANT_APP)

#### Models principais

```python
# apps/pricing_catalog/models/canonical.py
from pgvector.django import VectorField

class CategoriaServico(PaddockBaseModel):
    codigo = models.SlugField(unique=True)
    nome = models.CharField(max_length=100)
    ordem = models.PositiveSmallIntegerField(default=100)


class ServicoCanonico(PaddockBaseModel):
    codigo = models.SlugField(unique=True, db_index=True)
    nome = models.CharField(max_length=200)
    categoria = models.ForeignKey(CategoriaServico, on_delete=models.PROTECT)
    unidade = models.CharField(max_length=20, default="un")
    descricao = models.TextField(blank=True)
    aplica_multiplicador_tamanho = models.BooleanField(
        default=False,
        help_text="TRUE para pintura/funilaria/polimento. FALSE para "
                  "elétrica/alinhamento/diagnóstico. Default conservador: "
                  "False — obriga pensar ao cadastrar."
    )
    embedding = VectorField(dimensions=1024, null=True)
    is_active = models.BooleanField(default=True)


class CategoriaMaoObra(PaddockBaseModel):
    codigo = models.SlugField(unique=True)  # funileiro, pintor, montador...
    nome = models.CharField(max_length=80)
    ordem = models.PositiveSmallIntegerField(default=100)


class MaterialCanonico(PaddockBaseModel):
    """Abstração de material: 'tinta metálica preta', 'lixa P320'."""
    codigo = models.SlugField(unique=True)
    nome = models.CharField(max_length=150)
    unidade_base = models.CharField(max_length=20)  # L, kg, m, un, m2
    tipo = models.CharField(max_length=20, choices=[
        ("consumivel", "Consumível"),
        ("ferramenta", "Ferramenta"),
    ], default="consumivel")
    embedding = VectorField(dimensions=1024, null=True)


class InsumoMaterial(PaddockBaseModel):
    """SKU concreto: 'Tinta PPG Deltron Preto 1L'."""
    material_canonico = models.ForeignKey(
        MaterialCanonico, on_delete=models.PROTECT, related_name="insumos"
    )
    sku_interno = models.CharField(max_length=60, unique=True)
    gtin = models.CharField(max_length=14, blank=True, db_index=True)
    descricao = models.CharField(max_length=200)
    marca = models.CharField(max_length=60, blank=True)
    unidade_compra = models.CharField(max_length=20)
    fator_conversao = models.DecimalField(
        max_digits=10, decimal_places=4,
        help_text="Quantas unidades_base vêm em uma unidade_compra. "
                  "Ex: galão 3.6L → 3.6 se unidade_base=L."
    )
    is_active = models.BooleanField(default=True)


class PecaCanonica(PaddockBaseModel):
    codigo = models.SlugField(unique=True, db_index=True)
    nome = models.CharField(max_length=200)
    tipo_peca = models.CharField(max_length=20, choices=[
        ("genuina", "Genuína"),
        ("original", "Original"),
        ("paralela", "Paralela"),
        ("usada", "Usada"),
        ("recondicionada", "Recondicionada"),
    ], default="paralela")
    embedding = VectorField(dimensions=1024, null=True)
    is_active = models.BooleanField(default=True)


class CompatibilidadePeca(PaddockBaseModel):
    peca = models.ForeignKey(PecaCanonica, on_delete=models.CASCADE, related_name="compatibilidades")
    marca = models.CharField(max_length=60)
    modelo = models.CharField(max_length=100, blank=True)
    ano_inicio = models.IntegerField()
    ano_fim = models.IntegerField()

    class Meta:
        indexes = [models.Index(fields=["marca", "modelo", "ano_inicio", "ano_fim"])]
```

#### Fornecedor — perfil sobre `Pessoa`

```python
# apps/pricing_catalog/models/supplier.py

class Fornecedor(PaddockBaseModel):
    pessoa = models.OneToOneField(
        "persons.Pessoa",
        on_delete=models.CASCADE,
        related_name="perfil_fornecedor",
    )
    condicoes_pagamento = models.CharField(max_length=100, blank=True)
    prazo_entrega_dias = models.PositiveIntegerField(null=True, blank=True)
    avaliacao = models.PositiveSmallIntegerField(
        null=True, blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    is_active = models.BooleanField(default=True)


class CodigoFornecedorPeca(PaddockBaseModel):
    peca_canonica = models.ForeignKey(PecaCanonica, on_delete=models.CASCADE, related_name="codigos_fornecedor")
    fornecedor = models.ForeignKey(Fornecedor, on_delete=models.CASCADE)
    sku_fornecedor = models.CharField(max_length=60)
    preco_referencia = models.DecimalField(max_digits=12, decimal_places=2, null=True)
    data_referencia = models.DateField(null=True)
    prioridade = models.PositiveSmallIntegerField(default=100)
    # quanto menor, preferido em sugestão de compra

    class Meta:
        unique_together = [("peca_canonica", "fornecedor", "sku_fornecedor")]
```

#### Aliases — 3 tabelas paralelas

```python
# apps/pricing_catalog/models/aliases.py

class AliasServico(PaddockBaseModel):
    canonico = models.ForeignKey(ServicoCanonico, on_delete=models.CASCADE, related_name="aliases")
    texto = models.CharField(max_length=300)
    texto_normalizado = models.CharField(max_length=300, db_index=True)
    origem = models.CharField(max_length=20, choices=[
        ("import", "Importação"),
        ("manual", "Cadastro manual"),
        ("auto_alta", "Auto — confiança alta"),
        ("auto_media", "Auto — confiança média (revisar)"),
    ])
    confianca = models.FloatField(null=True, blank=True)
    confirmado_em = models.DateTimeField(null=True, blank=True)
    confirmado_por = models.ForeignKey(
        "authentication.GlobalUser", null=True, blank=True,
        on_delete=models.SET_NULL
    )
    ocorrencias = models.PositiveIntegerField(default=1)

    class Meta:
        indexes = [models.Index(fields=["texto_normalizado"])]


class AliasPeca(PaddockBaseModel):
    # campos análogos a AliasServico, FK para PecaCanonica
    ...


class AliasMaterial(PaddockBaseModel):
    # campos análogos, FK para MaterialCanonico
    ...
```

### 2. Normalização de texto

Criar módulo utilitário **reutilizável** (vai ser usado em MO-8 também):

```python
# apps/pricing_catalog/utils/text.py

ABREVIACOES = {
    r"\bp/choque\b": "para-choque",
    r"\bpara-choques?\b": "para-choque",
    r"\bdiant\b": "dianteiro",
    r"\btraz\b": "traseiro",
    r"\bs/pint(ura)?\b": "sem pintura",
    r"\bc/pint(ura)?\b": "com pintura",
    r"\bpint\b": "pintura",
    r"\bdto\b": "direito",
    r"\besq\b": "esquerdo",
    # expandir...
}

def normalizar_texto(s: str) -> str:
    """1. lower
       2. strip acentos
       3. colapsa espaços
       4. expande abreviações via regex
       5. remove pontuação exceto - e /
       6. strip final
    """
    ...
```

Teste `test_text_normalization.py` com 30 pares (entrada → esperado).

### 3. Motor de aliases — resolução em pipeline

```python
# apps/pricing_catalog/services/aliases.py

from dataclasses import dataclass
from typing import Literal

@dataclass
class MatchResult:
    canonico_id: int
    score: float
    metodo: Literal["exato", "fuzzy", "embedding"]
    confianca: Literal["alta", "media", "baixa"]


class AliasMatcher:
    TAU_FUZZY_ALTO = 92
    TAU_EMB_ALTO = 0.90
    TAU_EMB_MEDIO = 0.75

    def match_servico(self, texto: str, top_k: int = 5) -> list[MatchResult]:
        """Pipeline: normaliza → match exato → fuzzy (rapidfuzz) → embedding (pgvector)."""
        normalizado = normalizar_texto(texto)

        # 1. exato no texto_normalizado
        exatos = AliasServico.objects.filter(texto_normalizado=normalizado).values_list("canonico_id", flat=True).distinct()
        if exatos:
            return [MatchResult(cid, 100.0, "exato", "alta") for cid in exatos[:top_k]]

        # 2. fuzzy via rapidfuzz sobre todos os aliases
        # ATENÇÃO: não carregar todos em memória em prod — usar Postgres
        # trigram (`pg_trgm`) ou LIMIT inteligente por prefixo.
        # v1 pode rodar em memória (catálogo ainda < 5k aliases).

        # 3. embedding — pgvector cosine distance
        embedding = embed_text(texto, model="voyage-3")
        vetorial = ServicoCanonico.objects.order_by(
            -F("embedding").cosine_distance(embedding)
        ).annotate(
            sim=F("embedding").cosine_similarity(embedding)
        ).filter(sim__gte=self.TAU_EMB_MEDIO)[:top_k]

        return [...]
```

Endpoint usado em autocomplete de orçamento (em MO-7) e ingestão de PDF (MO-8).

### 4. Geração de embeddings

Background task:

```python
@shared_task
def embed_canonicos_pendentes(tenant_schema: str) -> None:
    with schema_context(tenant_schema):
        for obj in ServicoCanonico.objects.filter(embedding__isnull=True, is_active=True):
            obj.embedding = embed_text(f"{obj.nome}. {obj.descricao}", model="voyage-3")
            obj.save(update_fields=["embedding"])
        for obj in PecaCanonica.objects.filter(embedding__isnull=True, is_active=True):
            obj.embedding = embed_text(obj.nome, model="voyage-3")
            obj.save(update_fields=["embedding"])
        for obj in MaterialCanonico.objects.filter(embedding__isnull=True, is_active=True):
            obj.embedding = embed_text(obj.nome, model="voyage-3")
            obj.save(update_fields=["embedding"])
```

Disparada por signal `post_save` + job noturno de safety-net.

### 5. Endpoints

```
# Categorias base
GET/POST/PATCH  /api/v1/pricing/categorias-servico/
GET/POST/PATCH  /api/v1/pricing/categorias-mao-obra/

# Canônicos
GET             /api/v1/pricing/servicos/                 (paginado, busca)
POST            /api/v1/pricing/servicos/                 (MANAGER+)
GET             /api/v1/pricing/servicos/{id}/
PATCH           /api/v1/pricing/servicos/{id}/            (MANAGER+)
POST            /api/v1/pricing/servicos/match/           body: {texto} → top 5

GET/POST/PATCH  /api/v1/pricing/pecas/
POST            /api/v1/pricing/pecas/match/

GET/POST/PATCH  /api/v1/pricing/materiais/
GET/POST/PATCH  /api/v1/pricing/insumos/                  (filtro ?material=)
POST            /api/v1/pricing/insumos/by-gtin/          body: {gtin} → insumo

# Aliases
GET             /api/v1/pricing/aliases/servico/
POST            /api/v1/pricing/aliases/servico/          (confirma alias)
GET             /api/v1/pricing/aliases/servico/revisao/  (fila confiança média)
POST            /api/v1/pricing/aliases/servico/{id}/approve/
POST            /api/v1/pricing/aliases/servico/{id}/reject/

# Fornecedor
GET/POST/PATCH  /api/v1/pricing/fornecedores/             (MANAGER+ escrita)
GET/POST        /api/v1/pricing/pecas/{id}/fornecedores/  (adicionar código fornecedor)
```

**Armadilha CLAUDE.md:** uso de `SimpleRouter` com prefixo explícito evita o
problema de `DefaultRouter` em "" engolindo paths.

### 6. Seeds iniciais

Management command `setup_catalogo_base`:

- 12 `CategoriaServico` (funilaria, pintura, restauração, polimento, lavagem,
  vitrificação, remoção/instalação, elétrica, mecânica, alinhamento,
  balanceamento, outros).
- 8 `CategoriaMaoObra` (funileiro, pintor, montador, eletricista, mecânico,
  polidor, lavador, auxiliar).
- 20 `MaterialCanonico` (primer, tinta base metálica, verniz, thinner,
  lixa P320/P600/P1200, massa poliéster, fita crepe, papel mascaramento,
  graxa branca, limpa-contato, selante, silicone, etc).
- 30 `ServicoCanonico` top-30 DS Car (lista vem do relatório databox —
  `docs/Relatorio OS DAtabox.txt`).

Todos com `aplica_multiplicador_tamanho` conservador (default False);
manualmente marcar True em pintura, funilaria, polimento, vitrificação.

### 7. Frontend

#### Types

```typescript
// packages/types/src/pricing-catalog.types.ts

export interface ServicoCanonico { ... }
export interface PecaCanonica { ... }
export interface MaterialCanonico { ... }
export interface InsumoMaterial { ... }
export interface CategoriaMaoObra { ... }
export interface Fornecedor { ... }

export interface AliasMatch {
  canonico_id: number
  canonico_nome: string
  score: number
  metodo: 'exato' | 'fuzzy' | 'embedding'
  confianca: 'alta' | 'media' | 'baixa'
}
```

#### Páginas

- `/cadastros/catalogo/servicos` — lista + filtro categoria + CRUD.
- `/cadastros/catalogo/pecas` — lista + compatibilidade veicular expandível.
- `/cadastros/catalogo/materiais` — lista + vínculo de insumos.
- `/cadastros/catalogo/insumos` — lista + busca GTIN.
- `/cadastros/catalogo/categorias-mao-obra` — CRUD simples.
- `/cadastros/catalogo/fornecedores` — lista + filtros + códigos por peça.
- `/cadastros/catalogo/aliases/revisao` — fila de aliases em confiança
  média com UI lado-a-lado (texto original × canônico sugerido × outras
  opções do top 5).

#### Hook reutilizável

```typescript
// apps/dscar-web/src/hooks/usePricingCatalog.ts

export function useMatchServico(texto: string) {
  return useQuery({
    queryKey: ['match-servico', texto],
    queryFn: () => api.post('/api/proxy/pricing/servicos/match/', { texto }),
    enabled: texto.trim().length >= 3,
    staleTime: 60_000,
  })
}
```

Usado em MO-7 como autocomplete da composição de OS.

---

## Testes

```
apps/pricing_catalog/tests/
  test_models.py                — uniqueness, FK protection, slug
  test_text_normalization.py    — 30 pares de entrada/saída
  test_alias_matcher.py         — pipeline completo com fixtures
  test_embeddings.py            — mock Voyage, task roda e salva
  test_services_supplier.py     — Fornecedor OneToOne com Pessoa
  test_views_catalog.py         — RBAC, paginação, /match/
```

Golden set de 50 textos reais vindo do `Relatorio OS DAtabox.txt` para
validar que `AliasMatcher` resolve ≥ 90%.

---

## Critérios de aceite

- [ ] `setup_catalogo_base` cria 12 + 8 + 20 + 30 registros iniciais.
- [ ] `POST /pricing/servicos/match/` com texto normal ("subst para-choque dt")
      retorna `ServicoCanonico` correto com `metodo: exato|fuzzy|embedding`.
- [ ] Busca GTIN em `/insumos/by-gtin/` retorna insumo em ≤ 20ms.
- [ ] Fila de revisão de aliases exibe sugestão + canônico + alternativas.
- [ ] Background task `embed_canonicos_pendentes` roda sem erros;
      `ServicoCanonico.embedding` preenchido para 100% dos canônicos seed.
- [ ] `make lint`, `make typecheck`, `make test-backend` passam.
- [ ] CLAUDE.md atualizado com app novo, novas migrations, padrões de
      normalização e aliases.

---

## Armadilhas específicas desta sprint

### P1 · `VectorField` requer pgvector habilitado
Migration `0001_initial` precisa de `CreateExtension('vector')` antes dos
campos `VectorField`. CLAUDE.md já menciona pgvector — verifique que o
`Dockerfile` do postgres habilita a extensão em dev; em prod RDS precisa
ter extensão criada.

### P2 · `MaterialCanonico.unidade_base` é IMUTÁVEL após uso
Uma vez referenciado por `FichaTecnicaInsumo` (MO-4) e `LoteInsumo` (MO-5),
mudar `unidade_base` quebra cálculo histórico. Serializer de `update`:
`read_only_fields = [..., "unidade_base"]`.

### P3 · `InsumoMaterial.fator_conversao` é obrigatório
Sem isso, `valor_unitario_base` em MO-5 não calcula. Zod no frontend com
`.positive()` + help text explicando.

### P4 · Fornecedor `Pessoa.tipo` deve ser PJ ou PF
`Pessoa` já tem esse campo (ver `apps.persons`). Serializer valida antes
de criar `Fornecedor`. Mostrar erro amigável se tentar criar fornecedor
sobre um cliente (type=PF) — ou permitir e sinalizar: "Esta pessoa também
é cliente."

### P5 · Aliases podem apontar para canônico desativado
Quando `ServicoCanonico.is_active=False`, `AliasMatcher.match_servico`
exclui esse canônico do resultado. Mas aliases históricos permanecem
(auditoria).

### P6 · Embedding custa dinheiro — bulk
Voyage `voyage-3` permite até 128 textos por request. Task bulk, não 1 por 1.

### P7 · Busca fuzzy em produção precisa de pg_trgm
Em dev, rapidfuzz in-memory resolve. Mas com 10k aliases fica lento.
Migration cria índice GIN trigram em `texto_normalizado`:
```python
from django.contrib.postgres.indexes import GinIndex
class Meta:
    indexes = [GinIndex(fields=["texto_normalizado"], name="alias_trgm_idx", opclasses=["gin_trgm_ops"])]
```
Requer `CREATE EXTENSION pg_trgm`.

### P8 · Sem `description` em serializer de update
CLAUDE.md — "Serializers de update: nunca usar somente `exclude`".
Explicitar `read_only_fields` em todo serializer do catálogo.

---

## Handoff para MO-3, MO-4 e MO-5

Depois de MO-2, os sprints paralelos podem assumir:

- `CategoriaMaoObra` existe e tem 8 categorias.
- `MaterialCanonico` e `InsumoMaterial` com `fator_conversao` correto.
- `ServicoCanonico` com flag `aplica_multiplicador_tamanho` populada.
- `AliasMatcher.match_servico/peca/material` pronto.
- Embeddings rodando para todo canônico criado.

MO-4 consome `CategoriaMaoObra` e `MaterialCanonico` em `FichaTecnica*`.
MO-3 consome `CategoriaMaoObra` em `CustoHoraService`.
MO-5 consome `InsumoMaterial` e `PecaCanonica` em `UnidadeFisica` e `LoteInsumo`.

---

## Checklist pós-sprint

Atualizar CLAUDE.md com:

- App novo `apps.pricing_catalog`.
- Padrão de normalização de texto + utilitário compartilhado.
- Pipeline de aliases.
- Padrão de embedding com Voyage.
- Extensões Postgres: `vector`, `pg_trgm`.
- Variáveis: `VOYAGE_API_KEY`.
