# MO-Sprint 06 — Motor de Precificação + Snapshots

**Duração:** 2 semanas | **Equipe:** Solo + Claude Code | **Prioridade:** P0 (marco crítico)
**Pré-requisitos:** MO-3 (adapters custo), MO-4 (ficha técnica), MO-5 (custo base peça/insumo)
**Desbloqueia:** MO-7 (orçamento/OS)

---

## Objetivo

Implementar o **núcleo**: dado um serviço + peça, calcular o preço final
determinístico, auditável e reversível. O motor:

1. Resolve ficha técnica (MO-4).
2. Aplica multiplicadores por tamanho (MO-1 perfil).
3. Busca custos (MO-3 hora + MO-5 peça/insumo) **no instante do cálculo**.
4. Calcula margem ajustada por fator de responsabilidade do segmento.
5. Aplica teto de benchmark p90 (se disponível — MO-8).
6. Grava **Snapshot imutável** com decomposição completa.

Nenhum cálculo de preço é feito pelo frontend. Nenhum ad-hoc via
`Decimal` espalhado. Tudo flui por `MotorPrecificacaoService.calcular()`.

Qualquer aprovação de orçamento/OS referencia um snapshot. Reaprovar
= novo snapshot (não mutação).

---

## Referências obrigatórias

1. `docs/mo-roadmap.md` — **armadilhas A4 (snapshot imutável), A7 (benchmark teto), A10 (Claude nunca preço)**.
2. Spec v3.0 — §14 (pipeline cálculo), §15 (snapshot), §16 (markup peça), §17 (fator responsabilidade).
3. `FichaTecnicaService.resolver()` + `.aplicar_multiplicadores()` (MO-4).
4. `CustoHoraService` (MO-3) e `CustoPecaService` / `CustoInsumoService` (MO-5).
5. CLAUDE.md — Decimal sempre (`max_digits=18, decimal_places=2` em dinheiro).

---

## Escopo

### 1. App `apps.pricing_engine` — finalizar

O esqueleto foi criado em MO-3 (`ParametroRateio`, `ParametroCustoHora`,
`CustoHoraFallback`). Aqui adicionamos os models do motor principal.

#### Models

```python
# apps/pricing_engine/models.py

class MargemOperacao(PaddockBaseModel):
    """Margem base por segmento veicular × tipo de operação.
    Ajustada no cálculo final pelo fator_responsabilidade."""

    TIPO_OPERACAO = [
        ("servico_mao_obra", "Serviço / Mão de obra"),
        ("peca_revenda",     "Peça (revenda)"),
        ("insumo_comp",      "Insumo complementar"),
    ]

    empresa = models.ForeignKey(
        "pricing_profile.Empresa",
        on_delete=models.CASCADE,
        related_name="margens",
    )
    segmento = models.ForeignKey(
        "pricing_profile.SegmentoVeicular",
        on_delete=models.PROTECT,
    )
    tipo_operacao = models.CharField(max_length=30, choices=TIPO_OPERACAO)
    margem_percentual = models.DecimalField(
        max_digits=5, decimal_places=4,
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("5"))],
        help_text="Margem base, ex: 0.4000 = 40%. Multiplicada por "
                  "(1 + fator_responsabilidade) no cálculo final.",
    )
    vigente_desde = models.DateField()
    vigente_ate = models.DateField(null=True, blank=True)

    class Meta:
        unique_together = [("empresa", "segmento", "tipo_operacao", "vigente_desde")]


class MarkupPeca(PaddockBaseModel):
    """Override fino de margem por peça específica ou faixa de custo.

    Hierarquia: peça específica > faixa > default por segmento (MargemOperacao).
    """
    empresa = models.ForeignKey(
        "pricing_profile.Empresa",
        on_delete=models.CASCADE,
    )
    peca_canonica = models.ForeignKey(
        "pricing_catalog.PecaCanonica",
        null=True, blank=True,
        on_delete=models.CASCADE,
    )
    faixa_custo_min = models.DecimalField(max_digits=12, decimal_places=2, null=True)
    faixa_custo_max = models.DecimalField(max_digits=12, decimal_places=2, null=True)
    margem_percentual = models.DecimalField(max_digits=5, decimal_places=4)
    vigente_desde = models.DateField()
    vigente_ate = models.DateField(null=True, blank=True)
    observacao = models.CharField(max_length=200, blank=True)

    class Meta:
        constraints = [
            # Ou é peça específica, OU é faixa — nunca os dois.
            models.CheckConstraint(
                check=(
                    Q(peca_canonica__isnull=False, faixa_custo_min__isnull=True) |
                    Q(peca_canonica__isnull=True, faixa_custo_min__isnull=False)
                ),
                name="markup_peca_ou_faixa",
            )
        ]


class CalculoCustoSnapshot(PaddockBaseModel):
    """IMUTÁVEL. Decomposição completa do preço no instante do cálculo.

    ARMADILHA A4: não edite. Para corrigir, crie outro snapshot e aponte
    a linha de orçamento/OS para o novo. O antigo fica como histórico.
    """

    ORIGEM = [
        ("orcamento_linha", "Linha de orçamento"),
        ("os_linha",        "Linha de OS"),
        ("simulacao",       "Simulação avulsa"),
    ]

    empresa = models.ForeignKey("pricing_profile.Empresa", on_delete=models.PROTECT)
    servico_canonico = models.ForeignKey(
        "pricing_catalog.ServicoCanonico", null=True, blank=True,
        on_delete=models.PROTECT,
    )
    peca_canonica = models.ForeignKey(
        "pricing_catalog.PecaCanonica", null=True, blank=True,
        on_delete=models.PROTECT,
    )
    # Um snapshot cobre 1 serviço OU 1 peça/insumo (linha única de orçamento).

    origem = models.CharField(max_length=30, choices=ORIGEM)

    # Contexto usado no cálculo — gravado em JSON para auditoria
    contexto = models.JSONField()
    # Ex: {
    #   "veiculo": {"marca": "VW", "modelo": "Gol", "ano": 2018, "versao": "1.0 MPI"},
    #   "segmento_codigo": "popular",
    #   "tamanho_codigo": "medio",
    #   "tipo_pintura_codigo": "solida",
    #   "quem_paga": "seguradora",
    #   "aplica_multiplicador_tamanho": true
    # }

    # Decomposição — TUDO em Decimal(18,2) ou (18,4) para unitários
    custo_mo        = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    custo_insumos   = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    rateio          = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    custo_peca_base = models.DecimalField(max_digits=18, decimal_places=2, default=0)

    custo_total_base = models.DecimalField(max_digits=18, decimal_places=2)
    # = custo_mo + custo_insumos + rateio + custo_peca_base

    fator_responsabilidade = models.DecimalField(max_digits=5, decimal_places=4)
    margem_base            = models.DecimalField(max_digits=5, decimal_places=4)
    margem_ajustada        = models.DecimalField(max_digits=5, decimal_places=4)
    # = margem_base × (1 + fator_responsabilidade)

    preco_calculado = models.DecimalField(max_digits=18, decimal_places=2)
    # = custo_total_base × (1 + margem_ajustada)

    preco_teto_benchmark = models.DecimalField(
        max_digits=18, decimal_places=2, null=True, blank=True,
    )
    # p90 do benchmark por segmento+serviço (MO-8). NULL se indisponível.
    preco_final = models.DecimalField(max_digits=18, decimal_places=2)
    # = min(preco_calculado, preco_teto_benchmark) se teto disponível
    # = preco_calculado caso contrário

    # Referências aos insumos das quais o snapshot depende (para auditoria)
    decomposicao = models.JSONField()
    # Ex: {
    #   "ficha_id": 412, "ficha_versao": 3,
    #   "mao_obra": [
    #     {"categoria": "pintor", "horas": 3.0, "custo_hora": 85.50, "fonte_custo": "rh-adapter", "subtotal": 256.50}
    #   ],
    #   "insumos": [
    #     {"material": "tinta_base", "quantidade_base": 0.48, "custo_unit_base": 120.00, "subtotal": 57.60}
    #   ],
    #   "rateio": {"valor_hora": 25.30, "horas_servico": 4.0, "total": 101.20},
    #   "peca": {"peca_id": 123, "max_valor_nf": 450.00, "unidades_disponiveis": 3},
    #   "benchmark": {"p90": 1250.00, "n_amostras": 42, "fonte": "seguradora-xyz-pdf"}
    # }

    calculado_em = models.DateTimeField(auto_now_add=True)
    calculado_por = models.ForeignKey(
        "authentication.GlobalUser",
        null=True, on_delete=models.SET_NULL,
    )

    class Meta:
        indexes = [
            models.Index(fields=["empresa", "servico_canonico", "calculado_em"]),
            models.Index(fields=["empresa", "peca_canonica", "calculado_em"]),
        ]
        # IMUTÁVEL — nunca sobrescrever campos de decomposição.
        # Convenção: save() levanta se snapshot já tem PK.

    def save(self, *args, **kwargs):
        if self.pk and self._state.adding is False:
            # Permite save apenas se nenhum campo crítico mudou
            original = CalculoCustoSnapshot.objects.only(
                "preco_final", "custo_total_base", "decomposicao"
            ).get(pk=self.pk)
            if (
                original.preco_final != self.preco_final
                or original.custo_total_base != self.custo_total_base
                or original.decomposicao != self.decomposicao
            ):
                raise ValueError(
                    "CalculoCustoSnapshot é imutável — crie novo snapshot."
                )
        super().save(*args, **kwargs)
```

---

### 2. Service principal: `MotorPrecificacaoService`

```python
# apps/pricing_engine/services/motor.py

from dataclasses import dataclass, field
from decimal import Decimal, ROUND_HALF_UP

D0 = Decimal("0")
D2 = Decimal("0.01")


@dataclass
class ContextoCalculo:
    """Entrada do motor — imutável."""
    empresa_id: int
    veiculo_marca: str
    veiculo_modelo: str
    veiculo_ano: int
    veiculo_versao: str | None = None
    segmento_codigo: str | None = None          # se já resolvido
    tamanho_codigo: str | None = None           # idem
    tipo_pintura_codigo: str | None = None
    quem_paga: str = "cliente"                  # "cliente" | "seguradora"
    aplica_multiplicador_tamanho: bool = True


@dataclass
class ResultadoServico:
    snapshot_id: str
    preco_final: Decimal
    custo_total_base: Decimal
    margem_ajustada: Decimal
    teto_aplicado: bool
    decomposicao: dict


@dataclass
class ResultadoPeca:
    snapshot_id: str
    preco_final: Decimal
    custo_base: Decimal
    margem_ajustada: Decimal
    decomposicao: dict


class MotorPrecificacaoService:
    """Fachada única do motor de preços.

    Nenhuma view ou outro service deve montar preço ad-hoc.
    """

    @staticmethod
    def calcular_servico(
        ctx: ContextoCalculo,
        servico_canonico_id: int,
        user_id: str | None = None,
    ) -> ResultadoServico:
        # 1. Resolver enquadramento (segmento + tamanho + responsabilidade)
        enq = EnquadramentoService.resolver(
            marca=ctx.veiculo_marca,
            modelo=ctx.veiculo_modelo,
            ano=ctx.veiculo_ano,
            versao=ctx.veiculo_versao,
            override_segmento=ctx.segmento_codigo,
            override_tamanho=ctx.tamanho_codigo,
        )

        # 2. Resolver ficha técnica
        ficha = FichaTecnicaService.resolver(
            servico_id=servico_canonico_id,
            tipo_pintura_codigo=ctx.tipo_pintura_codigo,
        )

        # 3. Aplicar multiplicadores
        servico = ServicoCanonico.objects.get(id=servico_canonico_id)
        ficha_aj = FichaTecnicaService.aplicar_multiplicadores(
            ficha,
            aplica_multiplicador_tamanho=(
                ctx.aplica_multiplicador_tamanho
                and servico.aplica_multiplicador_tamanho
            ),
            tamanho=enq.tamanho,
        )

        # 4. Custo mão de obra
        mo_detalhes = []
        custo_mo = D0
        horas_totais = D0
        for m in ficha_aj.maos_obra:
            ch = CustoHoraService.custo_hora(m["categoria_codigo"])
            subtotal = (m["horas"] * ch.valor).quantize(D2, ROUND_HALF_UP)
            custo_mo += subtotal
            horas_totais += m["horas"]
            mo_detalhes.append({
                "categoria": m["categoria_codigo"],
                "horas": str(m["horas"]),
                "custo_hora": str(ch.valor),
                "fonte_custo": ch.origem,
                "subtotal": str(subtotal),
            })

        # 5. Custo insumos
        ins_detalhes = []
        custo_ins = D0
        for i in ficha_aj.insumos:
            mat = MaterialCanonico.objects.get(codigo=i["material_codigo"])
            cu = CustoInsumoService.custo_base(mat.id)
            subtotal = (i["quantidade"] * cu).quantize(D2, ROUND_HALF_UP)
            custo_ins += subtotal
            ins_detalhes.append({
                "material": i["material_codigo"],
                "quantidade_base": str(i["quantidade"]),
                "custo_unit_base": str(cu),
                "subtotal": str(subtotal),
            })

        # 6. Rateio
        rateio_valor_hora = RateioService.por_hora(empresa_id=ctx.empresa_id)
        rateio = (rateio_valor_hora * horas_totais).quantize(D2, ROUND_HALF_UP)

        # 7. Custo total base
        custo_total_base = custo_mo + custo_ins + rateio

        # 8. Margem
        margem_base = MargemResolver.para_servico(
            empresa_id=ctx.empresa_id,
            segmento_id=enq.segmento.id,
        )
        margem_ajustada = margem_base * (Decimal("1") + enq.fator_responsabilidade)

        # 9. Preço calculado
        preco_calc = (custo_total_base * (Decimal("1") + margem_ajustada)).quantize(D2, ROUND_HALF_UP)

        # 10. Teto de benchmark (A7 — benchmark é TETO, não alvo)
        teto = BenchmarkService.p90_servico(
            empresa_id=ctx.empresa_id,
            servico_id=servico_canonico_id,
            segmento_id=enq.segmento.id,
            tamanho_id=enq.tamanho.id,
        )  # retorna None se sem amostras suficientes

        preco_final = min(preco_calc, teto) if teto else preco_calc
        teto_aplicado = bool(teto and teto < preco_calc)

        # 11. Persistir snapshot
        decomposicao = {
            "ficha_id": ficha_aj.ficha_id,
            "ficha_versao": ficha_aj.versao,
            "mao_obra": mo_detalhes,
            "insumos": ins_detalhes,
            "rateio": {
                "valor_hora": str(rateio_valor_hora),
                "horas_servico": str(horas_totais),
                "total": str(rateio),
            },
            "benchmark": (
                {"p90": str(teto), "aplicado": teto_aplicado}
                if teto is not None else None
            ),
        }
        contexto_json = {
            "veiculo": {
                "marca": ctx.veiculo_marca,
                "modelo": ctx.veiculo_modelo,
                "ano": ctx.veiculo_ano,
                "versao": ctx.veiculo_versao,
            },
            "segmento_codigo": enq.segmento.codigo,
            "tamanho_codigo": enq.tamanho.codigo,
            "tipo_pintura_codigo": ctx.tipo_pintura_codigo,
            "quem_paga": ctx.quem_paga,
            "aplica_multiplicador_tamanho": (
                ctx.aplica_multiplicador_tamanho
                and servico.aplica_multiplicador_tamanho
            ),
        }

        snap = CalculoCustoSnapshot.objects.create(
            empresa_id=ctx.empresa_id,
            servico_canonico_id=servico_canonico_id,
            peca_canonica=None,
            origem="orcamento_linha",  # ajustado pelo chamador se for OS
            contexto=contexto_json,
            custo_mo=custo_mo,
            custo_insumos=custo_ins,
            rateio=rateio,
            custo_peca_base=D0,
            custo_total_base=custo_total_base,
            fator_responsabilidade=enq.fator_responsabilidade,
            margem_base=margem_base,
            margem_ajustada=margem_ajustada,
            preco_calculado=preco_calc,
            preco_teto_benchmark=teto,
            preco_final=preco_final,
            decomposicao=decomposicao,
            calculado_por_id=user_id,
        )

        return ResultadoServico(
            snapshot_id=str(snap.id),
            preco_final=preco_final,
            custo_total_base=custo_total_base,
            margem_ajustada=margem_ajustada,
            teto_aplicado=teto_aplicado,
            decomposicao=decomposicao,
        )

    @staticmethod
    def calcular_peca(
        ctx: ContextoCalculo,
        peca_canonica_id: int,
        quantidade: int = 1,
        user_id: str | None = None,
    ) -> ResultadoPeca:
        enq = EnquadramentoService.resolver(
            marca=ctx.veiculo_marca,
            modelo=ctx.veiculo_modelo,
            ano=ctx.veiculo_ano,
            versao=ctx.veiculo_versao,
            override_segmento=ctx.segmento_codigo,
            override_tamanho=ctx.tamanho_codigo,
        )

        custo_base = CustoPecaService.custo_base(peca_canonica_id)

        margem_base = MargemResolver.para_peca(
            empresa_id=ctx.empresa_id,
            segmento_id=enq.segmento.id,
            peca_canonica_id=peca_canonica_id,
            custo_base=custo_base,
        )
        margem_ajustada = margem_base * (Decimal("1") + enq.fator_responsabilidade)

        preco_unit = (custo_base * (Decimal("1") + margem_ajustada)).quantize(D2, ROUND_HALF_UP)

        # Benchmark pode existir para peças também (p90 valor_nf mercado)
        teto_peca = BenchmarkService.p90_peca(
            empresa_id=ctx.empresa_id,
            peca_id=peca_canonica_id,
        )
        preco_final_unit = min(preco_unit, teto_peca) if teto_peca else preco_unit

        decomposicao = {
            "peca_id": peca_canonica_id,
            "custo_base": str(custo_base),
            "margem_base": str(margem_base),
            "margem_ajustada": str(margem_ajustada),
            "preco_calculado_unit": str(preco_unit),
            "teto_benchmark": str(teto_peca) if teto_peca else None,
            "preco_final_unit": str(preco_final_unit),
            "quantidade": quantidade,
        }

        snap = CalculoCustoSnapshot.objects.create(
            empresa_id=ctx.empresa_id,
            servico_canonico=None,
            peca_canonica_id=peca_canonica_id,
            origem="orcamento_linha",
            contexto={"veiculo": {**ctx.__dict__}, "segmento_codigo": enq.segmento.codigo},
            custo_mo=D0,
            custo_insumos=D0,
            rateio=D0,
            custo_peca_base=custo_base * quantidade,
            custo_total_base=custo_base * quantidade,
            fator_responsabilidade=enq.fator_responsabilidade,
            margem_base=margem_base,
            margem_ajustada=margem_ajustada,
            preco_calculado=preco_unit * quantidade,
            preco_teto_benchmark=(teto_peca * quantidade) if teto_peca else None,
            preco_final=preco_final_unit * quantidade,
            decomposicao=decomposicao,
            calculado_por_id=user_id,
        )
        return ResultadoPeca(
            snapshot_id=str(snap.id),
            preco_final=preco_final_unit * quantidade,
            custo_base=custo_base,
            margem_ajustada=margem_ajustada,
            decomposicao=decomposicao,
        )
```

---

### 3. Auxiliares: `MargemResolver`, `BenchmarkService` (stub)

```python
# apps/pricing_engine/services/margem.py

class MargemResolver:
    @staticmethod
    def para_servico(empresa_id: int, segmento_id: int) -> Decimal:
        hoje = date.today()
        m = MargemOperacao.objects.filter(
            empresa_id=empresa_id,
            segmento_id=segmento_id,
            tipo_operacao="servico_mao_obra",
            vigente_desde__lte=hoje,
        ).filter(
            Q(vigente_ate__gte=hoje) | Q(vigente_ate__isnull=True)
        ).order_by("-vigente_desde").first()
        if not m:
            raise MargemNaoDefinida(
                f"Sem margem vigente empresa={empresa_id} segmento={segmento_id}"
            )
        return m.margem_percentual

    @staticmethod
    def para_peca(
        empresa_id: int,
        segmento_id: int,
        peca_canonica_id: int,
        custo_base: Decimal,
    ) -> Decimal:
        """Hierarquia: peça específica > faixa > default segmento."""
        hoje = date.today()
        qs = MarkupPeca.objects.filter(
            empresa_id=empresa_id,
            vigente_desde__lte=hoje,
        ).filter(
            Q(vigente_ate__gte=hoje) | Q(vigente_ate__isnull=True)
        )

        # 1. Peça específica
        pec = qs.filter(peca_canonica_id=peca_canonica_id).order_by("-vigente_desde").first()
        if pec:
            return pec.margem_percentual

        # 2. Faixa
        faixa = qs.filter(
            peca_canonica__isnull=True,
            faixa_custo_min__lte=custo_base,
            faixa_custo_max__gte=custo_base,
        ).order_by("-vigente_desde").first()
        if faixa:
            return faixa.margem_percentual

        # 3. Default segmento
        return MargemResolver.para_servico_fallback_peca(empresa_id, segmento_id)
```

```python
# apps/pricing_engine/services/benchmark.py
# STUB — implementação real vem em MO-8

class BenchmarkService:
    @staticmethod
    def p90_servico(empresa_id, servico_id, segmento_id, tamanho_id) -> Decimal | None:
        return None  # será implementado em MO-8

    @staticmethod
    def p90_peca(empresa_id, peca_id) -> Decimal | None:
        return None
```

---

### 4. Endpoints

```
# Motor (uso interno + debug)
POST  /api/v1/pricing/calcular-servico/       body: {contexto, servico_canonico_id}
POST  /api/v1/pricing/calcular-peca/          body: {contexto, peca_canonica_id, quantidade}
POST  /api/v1/pricing/simular/                body: {contexto, itens:[{tipo:"servico"|"peca", id, qty?}]}

GET   /api/v1/pricing/snapshots/{id}/         (MANAGER+)
GET   /api/v1/pricing/snapshots/              ?origem=&servico=&peca=&desde=

# Margem
GET   /api/v1/pricing/margens/                (MANAGER+)
POST  /api/v1/pricing/margens/                (ADMIN+)
GET   /api/v1/pricing/markup-peca/            (MANAGER+)
POST  /api/v1/pricing/markup-peca/            (ADMIN+)
```

**RBAC no snapshot:**
- `IsConsultantOrAbove`: campos `preco_final`, `preco_teto_benchmark`, `contexto`.
- `IsManagerOrAbove`: acima + `decomposicao`, `custo_total_base`, `margem_ajustada`.
- `IsAdminOrAbove` (sócios): acima + `custo_mo`, `custo_insumos`, `rateio`, `custo_peca_base`, `margem_base`.

Implementar via **serializers distintos** — `SnapshotMinSerializer`, `SnapshotMgrSerializer`, `SnapshotFullSerializer` — selecionados em `get_serializer_class()` por `_get_role(request)`.

---

### 5. Frontend

#### Página: `/configuracao-motor/margens`

- Tab "Por segmento × operação" — tabela editável com `MargemOperacao`.
- Tab "Markup específico por peça" — tabela com `MarkupPeca`, aba "Por peça" e aba "Por faixa".
- Edição cria nova linha com `vigente_desde=hoje` e fecha anterior (`vigente_ate=hoje-1`).

#### Página: `/configuracao-motor/simulador`

Formulário grande tipo "calculadora do motor":

```
Veículo: [Marca ▼] [Modelo ▼] [Ano ▼] [Versão ▼]
Segmento: [auto-resolvido] · override: [ ▼ ]
Tamanho: [auto-resolvido] · override: [ ▼ ]
Tipo de pintura: [ ▼ ]
Quem paga: (•) Cliente  ( ) Seguradora
Aplicar multiplicador de tamanho: ☑

Item a calcular:
(•) Serviço: [autocomplete ServicoCanonico ▼]
( ) Peça:    [autocomplete PecaCanonica ▼] qty [1]

[Calcular]

─── Resultado ──────────────────────────────────
Preço final: R$ 1.487,20     (teto aplicado ✓)
Preço calculado: R$ 1.612,30
Custo total base: R$ 987,54
Margem ajustada: 50,60%

▾ Decomposição (visível só para MANAGER+)
   Mão de obra                 R$ 342,00
     Pintor · 3h · R$ 85,50      R$ 256,50
     Auxiliar · 1h · R$ 85,50    R$ 85,50
   Insumos                     R$ 144,34
     Primer · 0.20L × R$ 120     R$ 24,00
     Tinta  · 0.48L × R$ 180     R$ 86,40
     Verniz · 0.36L × R$ 93      R$ 33,94
   Rateio                      R$ 101,20
     R$ 25,30/h × 4.0h
   ...
[Ver JSON bruto]

Snapshot ID: uuid-abcd-1234
```

#### Página: `/configuracao-motor/snapshots`

- Lista paginada com filtros (origem, data, serviço/peça).
- Drill-down abre painel lateral com JSON completo (para MANAGER+).
- Botão "Recalcular" para auditoria → gera NOVO snapshot com mesmo contexto e compara.

---

### 6. Hooks frontend

```typescript
// apps/dscar-web/src/hooks/usePricingEngine.ts

export function useCalcularServico() {
  return useMutation({
    mutationFn: async (payload: {
      contexto: ContextoCalculoInput
      servico_canonico_id: number
    }) => {
      const res = await fetch("/api/proxy/pricing/calcular-servico/", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("Erro no cálculo")
      return (await res.json()) as ResultadoServicoDTO
    },
  })
}

export function useSnapshot(id: string) {
  return useQuery({
    queryKey: ["pricing", "snapshot", id],
    queryFn: async () => {
      const res = await fetch(`/api/proxy/pricing/snapshots/${id}/`)
      if (!res.ok) throw new Error()
      return (await res.json()) as SnapshotDTO
    },
    staleTime: Infinity,  // imutável — cache eterno
  })
}
```

---

## Testes

### Backend (pytest) — mínimo 35 testes

```
tests/pricing_engine/
├── test_motor_calcular_servico.py
│   ├── test_fluxo_completo_pinta_parachoque_popular_medio
│   ├── test_servico_aplica_multiplicador_tamanho
│   ├── test_servico_sem_multiplicador_ignora_fator
│   ├── test_fator_responsabilidade_altera_margem
│   ├── test_teto_benchmark_limita_preco           # A7
│   ├── test_teto_benchmark_none_nao_aplica
│   ├── test_categoria_mo_nao_casa_tabela_raise
│   ├── test_material_sem_lote_raise_custo_indisponivel
│   └── test_grava_snapshot_com_contexto_completo
├── test_motor_calcular_peca.py
│   ├── test_usa_max_valor_nf_como_custo_base    # integra A2
│   ├── test_markup_peca_especifica_sobrescreve
│   ├── test_markup_por_faixa_aplicado
│   └── test_fallback_margem_segmento
├── test_margem_resolver.py
│   ├── test_vigencia_corrente_escolhida
│   ├── test_sem_margem_vigente_raise
│   └── test_faixa_com_custo_dentro_do_range
├── test_snapshot_imutabilidade.py               # A4
│   ├── test_save_em_snapshot_existente_raise
│   ├── test_update_direto_no_bd_detectado_em_teste
│   └── test_campos_read_only_na_api
├── test_rbac_snapshot_serializer.py
│   ├── test_consultant_nao_ve_custo
│   ├── test_manager_ve_custo_total_sem_breakdown
│   └── test_admin_ve_tudo
└── test_motor_decimal_precision.py
    ├── test_round_half_up_em_subtotais
    └── test_sem_erros_de_float_com_multiplas_linhas
```

### Playwright

```
e2e/pricing-simulator.spec.ts
  ├── Admin acessa /configuracao-motor/simulador
  ├── Preenche Veículo VW Gol 2018
  ├── Seleciona serviço "Pintar para-choque"
  ├── Clica Calcular
  ├── Verifica preço_final > 0
  ├── Expande decomposição e valida linhas de mão de obra
  └── Copia snapshot_id e acessa /configuracao-motor/snapshots/{id} — igual
```

---

## Critérios de aceite

- [ ] `MotorPrecificacaoService.calcular_servico()` gera snapshot completo em < 300ms (p95).
- [ ] Mesmo contexto chamado 2x gera 2 snapshots com mesmo `preco_final` (determinismo).
- [ ] Se custo_hora ou custo_peca indisponível, retorna erro estruturado (não 500).
- [ ] Snapshot.preco_final respeita `min(calculado, teto)` quando teto existe.
- [ ] Tentativa de `save()` com mudança em campos de decomposição raise `ValueError`.
- [ ] Simulador renderiza decomposição em < 1s.
- [ ] RBAC: consultant vê `preco_final`; manager vê + decomposicao; admin vê + margem_base.
- [ ] Todos os valores monetários em Decimal(18,2) ou (18,4) — nenhum `float` no motor.
- [ ] Contexto snapshot contém TODOS os inputs necessários para re-calcular (debug).

---

## Armadilhas específicas

### P1 — Snapshot é imutável (A4)
Nunca faça `snap.preco_final = X; snap.save()`. Para correção, gere
**novo snapshot** com contexto atualizado. A linha de orçamento/OS
aponta para o snapshot corrente via FK — basta trocar a FK. O antigo
fica como histórico de auditoria.

### P2 — `aplica_multiplicador_tamanho` tem DOIS nós (A3)
Só aplica se **ServicoCanonico.aplica_multiplicador_tamanho=True
E** ContextoCalculo.aplica_multiplicador_tamanho=True. A flag do
serviço é estrutural (elétrica nunca aplica). A flag do contexto é
operacional (operador pode desligar para promoção). Ambos precisam
ser True.

### P3 — Benchmark é TETO, não alvo (A7)
```python
# ERRADO — define preço pelo benchmark direto
preco_final = teto_benchmark

# CORRETO
preco_final = min(preco_calculado, teto_benchmark) if teto else preco_calculado
```
Se o cálculo de custo + margem dá R$ 800 e o p90 do mercado é R$ 1.200,
o preço final é R$ 800. Caso contrário perde-se competitividade.

### P4 — Claude NUNCA sugere preço (A10)
O motor é **determinístico**. Claude aparece em MO-8 apenas para sugerir
*composição de serviço* (quais `ServicoCanonico` usar para um texto livre
do cliente). Depois que a composição é escolhida, o motor calcula.
**Jamais** chame a Claude API dentro de `MotorPrecificacaoService`.

### P5 — Decimal em toda conta, ROUND_HALF_UP no quantize
```python
# ERRADO
custo_mo = float(m.horas) * float(ch.valor)

# CORRETO
custo_mo = (m["horas"] * ch.valor).quantize(D2, ROUND_HALF_UP)
```
Sem quantize consistente, acúmulo de centavos de diferença aparece em
totais de OS com muitas linhas.

### P6 — `contexto` JSON deve recuperar o cálculo
Teste explícito: pegar contexto de um snapshot antigo, rodar
`MotorPrecificacaoService.calcular_servico()` com mesmo input, comparar
apenas os campos que devem ser idênticos (margens podem ter mudado
entre execuções). Se não recupera, contexto está incompleto.

### P7 — `vigente_desde/ate` exige índice
`MargemOperacao.objects.filter(vigente_desde__lte=hoje).filter(...)` em
produção com milhares de linhas precisa de índice composto
`(empresa, segmento, tipo_operacao, vigente_desde)`. Adicionar em
migration separada se perf for problema.

### P8 — Nunca retornar 0 silenciosamente
Se `CustoHoraService.custo_hora()` ou qualquer custo falhar, o motor
deve raise. **Zero não é default seguro** — orçamento sairia a preço
R$ 0 e operador aprovaria sem perceber. `try/except` em ViewSet:
retornar HTTP 422 com detalhamento de qual recurso está faltando.

### P9 — `calcular_peca` sem empresa_id no contexto
`Empresa` é necessária para resolver margem. `ContextoCalculo.empresa_id`
é **obrigatório**. Se o frontend esquecer de passar, o serializer precisa
falhar em validação, não no motor.

### P10 — Serializer distinto por role, não filtro no frontend
```python
# ERRADO — devolve tudo e esconde no React
class SnapshotViewSet:
    serializer_class = SnapshotFullSerializer  # sempre

# CORRETO — get_serializer_class() por role no backend
def get_serializer_class(self):
    role = _get_role(self.request)
    if role in ("OWNER", "ADMIN"):
        return SnapshotFullSerializer
    if role == "MANAGER":
        return SnapshotMgrSerializer
    return SnapshotMinSerializer
```
Dados sensíveis (custo, margem) **nunca** trafegam pela rede para quem
não deve ver.

---

## Handoff para MO-7 (Orçamento/OS)

Entregar:

1. `MotorPrecificacaoService.calcular_servico()` e `.calcular_peca()` **estáveis** e testados.
2. API endpoint `POST /pricing/simular/` recebe lista de itens e devolve lista de snapshots (para orçamento multi-linha).
3. Contrato TypeScript em `packages/types/src/pricing.types.ts` com:
   - `ContextoCalculoInput`
   - `SnapshotFull | SnapshotMgr | SnapshotMin` (union discriminada por role visto)
   - `ResultadoServicoDTO` e `ResultadoPecaDTO`
4. Documentação em `docs/mo-contrato-motor-precificacao.md`:
   - Assinatura dos services.
   - JSON shape do snapshot.
   - Erros estruturados possíveis.
   - Como vincular snapshot a linha de orçamento (FK `snapshot = FK(CalculoCustoSnapshot, on_delete=PROTECT)`).
5. Fixture `tests/fixtures/cenarios_motor.json` — 10 cenários de cálculo esperados (input → preço_final), regressão permanente.

---

## Checklist pós-sprint

- [ ] `make migrate` aplicou migrations de MargemOperacao + MarkupPeca + CalculoCustoSnapshot.
- [ ] `make test-backend` verde — 35+ testes.
- [ ] `make test-web` verde — simulador E2E passando.
- [ ] `docs/mo-contrato-motor-precificacao.md` escrito.
- [ ] `packages/types/src/pricing.types.ts` publicado e importado.
- [ ] Performance: benchmark `MotorPrecificacaoService.calcular_servico()` < 300ms p95 em dev local.
- [ ] CLAUDE.md atualizado com nova seção "Motor de Precificação" + armadilhas.
- [ ] `make sprint-close SPRINT=MO-06` executado.
- [ ] Rito de retrospectiva: total de snapshots gerados em QA, distribuição de preços.
