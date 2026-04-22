# MO-Sprint 03 — Adapters de Custo

**Duração:** 2 semanas | **Equipe:** Solo + Claude Code | **Prioridade:** P0
**Pré-requisitos:** MO-1 + MO-2 (`CategoriaMaoObra` existe) · **Desbloqueia:** MO-6

---

## Objetivo

Isolar o motor do acoplamento direto com os módulos de RH, Financeiro e
Estoque. Criar services adapter que entregam: custo real por hora por
categoria, despesa fixa rateada por hora produtiva. Cada service aceita
fallback local para destravar desenvolvimento enquanto os módulos-fonte
não retornam dado completo. Esta sprint materializa o princípio
"motor não duplica dado — consome via service".

---

## Referências obrigatórias

1. `/CLAUDE.md` — seção "Módulo RH" (padrão Employee/Payslip), "Módulo Financeiro".
2. `docs/mo-roadmap.md` — "Apps existentes que serão estendidos", armadilha A8 (empresa).
3. Spec v3.0 — §4 (integrações), §7 (custos via adapters), §7.3 (rateio).
4. `apps.hr.models.Payslip` + `apps.hr.services.PayslipService` — entrada do
   `CustoHoraService`.
5. `apps.accounting` — aqui criamos `DespesaRecorrente`.

---

## Escopo

### 1. Extensão de `apps.accounting` — `DespesaRecorrente`

Decisão tomada na spec v3.0 (§7.2 caminho A): entidade mora no módulo
Financeiro. `DespesaRecorrenteService` do motor consulta ela.

#### Models

```python
# apps/accounting/models.py — ADICIONAR

class DespesaRecorrente(PaddockBaseModel):
    empresa = models.ForeignKey(
        "pricing_profile.Empresa",
        on_delete=models.PROTECT,
        related_name="despesas_recorrentes",
    )
    tipo = models.CharField(max_length=40, choices=[
        ("aluguel", "Aluguel"),
        ("energia", "Energia elétrica"),
        ("agua", "Água"),
        ("internet", "Internet / Telefonia"),
        ("software", "Softwares / Licenças"),
        ("folha_admin", "Folha administrativa"),
        ("contabilidade", "Contabilidade"),
        ("marketing", "Marketing"),
        ("depreciacao", "Depreciação de equipamentos"),
        ("seguro", "Seguros"),
        ("limpeza", "Limpeza / Insumos administrativos"),
        ("outros", "Outros"),
    ])
    descricao = models.CharField(max_length=200)
    valor_mensal = models.DecimalField(max_digits=12, decimal_places=2)
    vigente_desde = models.DateField()
    vigente_ate = models.DateField(null=True, blank=True)
    # conta_contabil opcional — liga com ChartOfAccount (já existe em apps.accounting)
    conta_contabil = models.ForeignKey(
        "accounting.ChartOfAccount",
        null=True, blank=True, on_delete=models.SET_NULL,
    )
    observacoes = models.TextField(blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["empresa", "vigente_desde", "vigente_ate"]),
        ]
```

Migration `apps/accounting/migrations/00XX_despesa_recorrente.py`.

### 2. `ParametroRateio` e `ParametroCustoHora` — novo app `apps.pricing_engine` (stub)

Apesar de o app `pricing_engine` só ser plenamente construído em MO-6,
**criamos já o skeleton** aqui para ancorar os parâmetros de adapter.

```python
# apps/pricing_engine/models/parametros.py

class ParametroRateio(PaddockBaseModel):
    empresa = models.ForeignKey("pricing_profile.Empresa", on_delete=models.PROTECT)
    vigente_desde = models.DateField()
    vigente_ate = models.DateField(null=True, blank=True)
    horas_produtivas_mes = models.DecimalField(max_digits=7, decimal_places=2)
    metodo = models.CharField(max_length=20, choices=[
        ("por_hora", "Por hora produtiva"),
        ("por_os", "Por OS concluída"),
    ], default="por_hora")
    observacoes = models.TextField(blank=True)

    class Meta:
        indexes = [models.Index(fields=["empresa", "vigente_desde", "vigente_ate"])]


class ParametroCustoHora(PaddockBaseModel):
    """Fatores complementares para compor custo real da hora.
    Enquanto RH não retorna total completo, esses fatores somam ao salário base."""
    empresa = models.ForeignKey("pricing_profile.Empresa", on_delete=models.PROTECT)
    vigente_desde = models.DateField()
    vigente_ate = models.DateField(null=True, blank=True)
    provisao_13_ferias = models.DecimalField(
        max_digits=5, decimal_places=4, default=Decimal("0.1389")
    )  # 8.33% × (1 + FGTS) aproximado; ajustável
    multa_fgts_rescisao = models.DecimalField(
        max_digits=5, decimal_places=4, default=Decimal("0.0320")
    )
    beneficios_por_funcionario = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal("0.00")
    )  # VT, VA, plano de saúde etc por mês
    horas_produtivas_mes = models.DecimalField(
        max_digits=6, decimal_places=2, default=Decimal("168.00")
    )  # 8h × 21 dias aprox
    observacoes = models.TextField(blank=True)


class CustoHoraFallback(PaddockBaseModel):
    """Enquanto RH não tem dados completos, admin cadastra valor direto."""
    empresa = models.ForeignKey("pricing_profile.Empresa", on_delete=models.PROTECT)
    categoria = models.ForeignKey("pricing_catalog.CategoriaMaoObra", on_delete=models.CASCADE)
    vigente_desde = models.DateField()
    vigente_ate = models.DateField(null=True, blank=True)
    valor_hora = models.DecimalField(max_digits=8, decimal_places=2)
    motivo = models.CharField(max_length=200, blank=True)

    class Meta:
        indexes = [models.Index(fields=["empresa", "categoria", "vigente_desde"])]
```

### 3. Adapters — services do motor

#### `CustoHoraService` — integração com RH + fallback

```python
# apps/pricing_engine/services/custo_hora.py
from dataclasses import dataclass
from decimal import Decimal
from datetime import date

@dataclass
class CustoHora:
    valor: Decimal
    origem: str          # "rh" | "fallback"
    decomposicao: dict   # para auditoria
    calculado_em: date


class CustoNaoDefinido(Exception):
    pass


class CustoHoraService:
    @staticmethod
    def obter(
        categoria_codigo: str,
        data: date,
        empresa_id: str,
    ) -> CustoHora:
        """Retorna custo real por hora produtiva.
        Ordem:
        1. RH (Employee + Payslip do mês de referência)
        2. Fallback cadastrado
        3. Raise CustoNaoDefinido
        """
        # 1. busca no RH
        total_folha = RHAdapter.total_mensal_categoria(
            categoria_codigo=categoria_codigo,
            data=data,
            empresa_id=empresa_id,
        )

        if total_folha is not None:
            params = ParametroCustoHora.objects.filter(
                empresa_id=empresa_id,
                vigente_desde__lte=data,
            ).filter(
                Q(vigente_ate__isnull=True) | Q(vigente_ate__gte=data)
            ).order_by("-vigente_desde").first()

            if not params:
                # default hardcoded se nunca cadastrado
                params = _default_parametros()

            # aplica complementos
            bruto = total_folha
            com_13_ferias = bruto * (1 + params.provisao_13_ferias)
            com_fgts = com_13_ferias * (1 + params.multa_fgts_rescisao)
            qtd = RHAdapter.qtd_funcionarios_categoria(categoria_codigo, data, empresa_id)
            com_beneficios = com_fgts + (params.beneficios_por_funcionario * qtd)

            horas_totais = params.horas_produtivas_mes * qtd
            if horas_totais == 0:
                raise CustoNaoDefinido(f"qtd funcionários = 0 em {categoria_codigo}")

            valor = (com_beneficios / horas_totais).quantize(Decimal("0.01"))
            return CustoHora(
                valor=valor,
                origem="rh",
                decomposicao={
                    "bruto_folha": str(bruto),
                    "com_13_ferias": str(com_13_ferias),
                    "com_fgts": str(com_fgts),
                    "com_beneficios": str(com_beneficios),
                    "horas_totais": str(horas_totais),
                    "qtd": qtd,
                    "params_id": params.id,
                },
                calculado_em=date.today(),
            )

        # 2. fallback
        fb = CustoHoraFallback.objects.filter(
            empresa_id=empresa_id,
            categoria__codigo=categoria_codigo,
            vigente_desde__lte=data,
        ).filter(
            Q(vigente_ate__isnull=True) | Q(vigente_ate__gte=data)
        ).order_by("-vigente_desde").first()

        if fb:
            return CustoHora(
                valor=fb.valor_hora,
                origem="fallback",
                decomposicao={"fallback_id": fb.id, "motivo": fb.motivo},
                calculado_em=date.today(),
            )

        raise CustoNaoDefinido(
            f"Categoria {categoria_codigo} não tem dado RH nem fallback em {data}"
        )
```

#### `RHAdapter` — wrapper sobre `apps.hr`

```python
# apps/pricing_engine/services/rh_adapter.py

class RHAdapter:
    @staticmethod
    def total_mensal_categoria(
        categoria_codigo: str, data: date, empresa_id: str
    ) -> Decimal | None:
        """Soma de gross_salary + encargos dos colaboradores ativos
        dessa categoria no mês de `data`.
        Retorna None se não houver nenhum colaborador ativo.
        """
        # mapeia categoria_codigo → position do Employee (ver apps.hr)
        positions = MAPEAMENTO_CATEGORIA_POSITION.get(categoria_codigo, [])
        if not positions:
            return None

        from apps.hr.models import Employee, Payslip
        ref = data.replace(day=1)

        employees = Employee.objects.filter(
            position__in=positions,
            status="active",
            hire_date__lte=data,
        )

        payslips = Payslip.objects.filter(
            employee__in=employees,
            reference_month=ref,
            status="closed",
        ).aggregate(total=Sum("gross_salary") + Sum("employer_charges"))

        if not employees.exists():
            return None

        return payslips["total"] or Decimal("0")

    @staticmethod
    def qtd_funcionarios_categoria(
        categoria_codigo: str, data: date, empresa_id: str
    ) -> int:
        positions = MAPEAMENTO_CATEGORIA_POSITION.get(categoria_codigo, [])
        if not positions:
            return 0
        return Employee.objects.filter(
            position__in=positions,
            status="active",
            hire_date__lte=data,
        ).count()
```

Mapeamento `categoria_codigo → hr.position` é um dicionário em
`apps/pricing_engine/constants.py`. Documento vivo.

#### `DespesaRecorrenteService`

```python
# apps/pricing_engine/services/despesa_recorrente.py

class DespesaRecorrenteService:
    @staticmethod
    def total_vigente(data: date, empresa_id: str) -> Decimal:
        """Soma de valor_mensal das despesas vigentes."""
        return DespesaRecorrente.objects.filter(
            empresa_id=empresa_id,
            vigente_desde__lte=data,
        ).filter(
            Q(vigente_ate__isnull=True) | Q(vigente_ate__gte=data)
        ).aggregate(total=Sum("valor_mensal"))["total"] or Decimal("0")

    @staticmethod
    def decomposicao_vigente(data: date, empresa_id: str) -> list[dict]:
        """Lista itens para auditoria/debug."""
        ...
```

#### `RateioService`

```python
# apps/pricing_engine/services/rateio.py

class RateioService:
    @staticmethod
    def por_hora(data: date, empresa_id: str) -> Decimal:
        """Rateio = total despesa vigente / horas produtivas."""
        total = DespesaRecorrenteService.total_vigente(data, empresa_id)

        param = ParametroRateio.objects.filter(
            empresa_id=empresa_id,
            vigente_desde__lte=data,
        ).filter(
            Q(vigente_ate__isnull=True) | Q(vigente_ate__gte=data)
        ).order_by("-vigente_desde").first()

        if not param:
            raise ParametroRateioNaoDefinido(f"empresa={empresa_id} data={data}")

        if param.horas_produtivas_mes == 0:
            raise ValueError("horas_produtivas_mes = 0")

        return (total / param.horas_produtivas_mes).quantize(Decimal("0.0001"))
```

### 4. Endpoints

Expor para admin/debug/simulação:

```
GET  /api/v1/pricing/parametros/rateio/                    (ADMIN+)
POST /api/v1/pricing/parametros/rateio/
GET  /api/v1/pricing/parametros/custo-hora/
POST /api/v1/pricing/parametros/custo-hora/
GET  /api/v1/pricing/parametros/custo-hora-fallback/
POST /api/v1/pricing/parametros/custo-hora-fallback/

GET  /api/v1/accounting/despesas-recorrentes/              (MANAGER+)
POST /api/v1/accounting/despesas-recorrentes/              (ADMIN+)

POST /api/v1/pricing/debug/custo-hora/
     body: {categoria_codigo, data, empresa_id}
     response: {valor, origem, decomposicao}
     → endpoint de debug, só para ADMIN, nunca usado em prod

POST /api/v1/pricing/debug/rateio/
     body: {data, empresa_id}
     response: {valor_hora, total_despesa, horas_produtivas, detalhes}
```

### 5. Frontend

#### Página nova: `/configuracao-motor/custos`

Sidebar grupo "Configuração do motor" (criado em MO-1).

Sub-abas:
- **Custo/hora por categoria** — tabela mostrando `CustoHoraService.obter()`
  para cada `CategoriaMaoObra`. Origem (`rh` | `fallback`) em badge.
  Botão "Cadastrar fallback" → Sheet com form.
- **Parâmetros** — edição de `ParametroCustoHora` e `ParametroRateio` com
  histórico de vigências. Banner: "Mudanças aqui **só afetam orçamentos
  novos**."
- **Despesas recorrentes** — lista + Sheet para criar/editar. Total vigente
  em destaque no topo.
- **Simulação** — form com categoria + data + empresa → retorna JSON
  completo de decomposição. Só visível para ADMIN.

#### Types + Hooks

```typescript
// packages/types/src/pricing-cost.types.ts
export interface CustoHoraResult {
  valor: number
  origem: 'rh' | 'fallback'
  decomposicao: Record<string, unknown>
  calculado_em: string
}

// apps/dscar-web/src/hooks/usePricingCost.ts
useDespesasRecorrentes(empresaId?: string)
useCustoHora(categoriaCodigo: string, data?: string, empresaId?: string)
useParametrosRateio(empresaId: string)
```

---

## Testes

```
apps/pricing_engine/tests/
  test_custo_hora_service.py      — cenários: só RH, só fallback, ambos, zero funcionários
  test_despesa_recorrente.py      — soma vigente com tipos misturados
  test_rateio_service.py          — reproduz planilha manual (fixture Excel)
  test_rh_adapter.py              — mock apps.hr, mapeamento categoria→position
  test_views_parametros.py        — RBAC ADMIN-only
  test_endpoints_debug.py         — /debug/ retorna decomposicao corretamente
```

Golden fixture `tests/fixtures/rateio_mes_referencia.json` — calculado à mão
com dados reais de abril 2026 para validar o motor.

---

## Critérios de aceite

- [ ] `CustoHoraService.obter()` retorna valor em ≤ 50ms para categorias
      com RH preenchido.
- [ ] `CustoHoraService.obter()` cai para `fallback` se RH vazio e fallback
      existe. Raise `CustoNaoDefinido` se nenhum dos dois.
- [ ] `DespesaRecorrenteService.total_vigente()` reproduz planilha de abril
      com erro < R$ 1.
- [ ] `RateioService.por_hora()` idem.
- [ ] `/pricing/debug/custo-hora/` e `/debug/rateio/` retornam JSON completo
      com decomposição (útil para depurar em produção).
- [ ] UI de parâmetros exibe vigência atual + histórico.
- [ ] `make lint`, `make typecheck`, `make test-backend` passam.
- [ ] CLAUDE.md atualizado.

---

## Armadilhas específicas desta sprint

### P1 · RH retorna dado parcial hoje
A spec v3.0 diz: "RH hoje retorna sal+INSS/FGTS" ≈ 70% do custo real.
`ParametroCustoHora` completa os 30% faltantes. Quando RH amadurecer para
retornar total completo, basta zerar `provisao_13_ferias`, `multa_fgts_rescisao`,
`beneficios_por_funcionario` na vigência nova — service continua funcionando
sem mudar código.

### P2 · `horas_produtivas_mes` é estimativa
168h é default conservador. Em MO-9 `DesvioProdutividade` recalibra
trimestralmente. Não travar com "número exato" no início — usar conservador.

### P3 · `vigente_ate` pode ser NULL
Significa "vigente até nova versão". Query sempre com
`Q(vigente_ate__isnull=True) | Q(vigente_ate__gte=data)`. Se esquecer, valor
expira silenciosamente.

### P4 · Consulta por `empresa_id` em todo lugar
Mesmo que hoje as 2 empresas compartilhem, service **já filtra por empresa_id**.
Se a consulta não especifica empresa, retorna erro — nunca agregar "todas".

### P5 · `Payslip.status=closed` para entrar no cálculo
`RHAdapter.total_mensal_categoria` só considera contracheques fechados.
Mês em aberto (folha em edição) não conta. Isso evita recálculo mudando
durante edição da folha.

### P6 · N+1 no `RHAdapter`
`qtd_funcionarios_categoria` e `total_mensal_categoria` fazem queries
separadas. Aceitável neste v1 (poucas categorias). Se virar problema,
consolidar em uma query com annotate.

### P7 · Depreciação como `DespesaRecorrente.tipo="depreciacao"`
Spec §7.2 decide: não cria módulo de imobilizado. Valor mensal calculado
externamente (equipamento ÷ meses vida útil) e lançado como despesa.
Documentar no help_text do campo `observacoes`.

### P8 · `make migrate` em paralelo com MO-4 e MO-5
MO-3/4/5 rodam em paralelo após MO-2. Ao fazer merge, usar
`makemigrations --merge` (CLAUDE.md "Migrações com número duplicado").

---

## Handoff para MO-6

MO-6 (Motor de Precificação) assume:

- `CustoHoraService.obter(categoria_codigo, data, empresa_id)` retorna `CustoHora`.
- `RateioService.por_hora(data, empresa_id)` retorna Decimal.
- `ParametroRateio` e `ParametroCustoHora` existem e têm vigência temporal.
- App `pricing_engine` criado (skeleton); MO-6 expande com mais models.

---

## Checklist pós-sprint

CLAUDE.md ganha:

- Novo app `apps.pricing_engine` (skeleton).
- Extensão `apps.accounting.DespesaRecorrente`.
- Padrão "adapter-based": `Service.obter()` retorna tupla valor + origem.
- Mapeamento `categoria_mao_obra → hr.position` documentado.
- Padrão de vigência temporal (vigente_desde/ate + query Q()).
