# MO-Sprint 09 — Capacidade + Feedback Loop + Auditoria + Hardening

**Duração:** 2 semanas | **Equipe:** Solo + Claude Code | **Prioridade:** P1
**Pré-requisitos:** MO-7 (OS com apontamento), MO-8 (benchmark + IA)
**Desbloqueia:** produção pronta para escalar além da DS Car

---

## Objetivo

Fechar o ciclo do motor em produção estável:

1. **Capacidade**: visão de ocupação da oficina por técnico, categoria e data —
   evita aceitar OS sem conseguir executar no prazo.
2. **Feedback loop**: comparar `FichaTecnicaServico` prevista com apontamento
   real; gerar **análise de variância** e recomendações de ajuste de ficha.
3. **Auditoria completa**: log imutável de toda decisão sensível do motor
   (cálculo, aprovação, override, ajuste de margem, aceite de IA).
4. **Hardening**: observabilidade (Sentry + metrics), performance, carga,
   onboarding de segundo tenant (primeiro cliente Paddock além DS Car).

Ao final desta sprint, o motor pode ser oferecido como produto SaaS para
outras oficinas.

---

## Referências obrigatórias

1. `docs/mo-roadmap.md` — todas as armadilhas A1-A10 viram checklist de auditoria.
2. Spec v3.0 — §26 (capacidade), §27 (feedback), §28 (auditoria), §29 (observability).
3. `ApontamentoHoras` (MO-7) e `FichaTecnicaServico` (MO-4) — base da análise.
4. `CalculoCustoSnapshot` (MO-6) — histórico para auditoria.
5. CLAUDE.md — Sentry + RBAC + multitenancy já configurados.

---

## Escopo

### 1. Capacidade operacional

#### Models

```python
# apps/service_orders/models_capacity.py

class CapacidadeTecnico(PaddockBaseModel):
    """Disponibilidade semanal de cada técnico por categoria."""

    tecnico = models.ForeignKey("hr.Employee", on_delete=models.CASCADE, related_name="capacidades")
    categoria_mao_obra = models.ForeignKey(
        "pricing_catalog.CategoriaMaoObra", on_delete=models.PROTECT,
    )
    horas_dia_util = models.DecimalField(
        max_digits=4, decimal_places=2, default=Decimal("8.00"),
    )
    dias_semana = models.JSONField(default=list)
    # ["seg", "ter", "qua", "qui", "sex", "sab"]

    vigente_desde = models.DateField()
    vigente_ate = models.DateField(null=True, blank=True)

    class Meta:
        unique_together = [("tecnico", "categoria_mao_obra", "vigente_desde")]


class BloqueioCapacidade(PaddockBaseModel):
    """Férias, ausência, manutenção de equipamento — qualquer coisa que
    reduz a capacidade planejada."""

    TIPOS = [
        ("ferias",     "Férias"),
        ("ausencia",   "Ausência"),
        ("treinamento","Treinamento"),
        ("equip_manut","Manutenção de equipamento"),
        ("outro",      "Outro"),
    ]
    tecnico = models.ForeignKey("hr.Employee", null=True, blank=True, on_delete=models.CASCADE)
    categoria_mao_obra = models.ForeignKey(
        "pricing_catalog.CategoriaMaoObra", null=True, blank=True,
        on_delete=models.PROTECT,
    )
    # Um dos dois deve estar preenchido: bloqueio por técnico OU por categoria.

    tipo = models.CharField(max_length=20, choices=TIPOS)
    inicia_em = models.DateField()
    termina_em = models.DateField()
    motivo = models.CharField(max_length=200, blank=True)

    criado_por = models.ForeignKey("authentication.GlobalUser", null=True, on_delete=models.SET_NULL)

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=(Q(tecnico__isnull=False) | Q(categoria_mao_obra__isnull=False)),
                name="bloqueio_tecnico_ou_categoria",
            )
        ]
```

#### Service

```python
# apps/service_orders/services/capacity.py

from datetime import date, timedelta

DIAS_SEMANA_MAP = {0:"seg",1:"ter",2:"qua",3:"qui",4:"sex",5:"sab",6:"dom"}

class CapacidadeService:
    @staticmethod
    def horas_disponiveis_categoria(
        categoria_id: int, dia: date,
    ) -> Decimal:
        """Total de horas que a categoria tem disponível no dia."""
        dia_semana = DIAS_SEMANA_MAP[dia.weekday()]
        total = Decimal("0")

        caps = CapacidadeTecnico.objects.filter(
            categoria_mao_obra_id=categoria_id,
            vigente_desde__lte=dia,
        ).filter(Q(vigente_ate__gte=dia) | Q(vigente_ate__isnull=True))

        for c in caps:
            if dia_semana in c.dias_semana:
                # Checa bloqueio
                if not BloqueioCapacidade.objects.filter(
                    Q(tecnico=c.tecnico) | Q(categoria_mao_obra=c.categoria_mao_obra),
                    inicia_em__lte=dia, termina_em__gte=dia,
                ).exists():
                    total += c.horas_dia_util
        return total

    @staticmethod
    def horas_comprometidas_categoria(
        categoria_id: int, dia: date,
    ) -> Decimal:
        """Horas já alocadas em OS ativas (authorized/repair/final_inspection/ready)
        com data de entrega programada neste dia."""
        horas = ApontamentoHoras.objects.filter(
            categoria_mao_obra_id=categoria_id,
            os_linha__service_order__status__in=[
                "authorized", "repair", "final_inspection", "ready",
            ],
            os_linha__service_order__estimated_delivery_date__date=dia,
        ).aggregate(total=Sum("horas"))["total"] or Decimal("0")
        return horas

    @staticmethod
    def utilizacao(categoria_id: int, dia: date) -> dict:
        dispo = CapacidadeService.horas_disponiveis_categoria(categoria_id, dia)
        comp = CapacidadeService.horas_comprometidas_categoria(categoria_id, dia)
        pct = (comp / dispo * 100) if dispo > 0 else Decimal("0")
        return {
            "data": dia.isoformat(),
            "categoria_id": categoria_id,
            "disponivel": str(dispo),
            "comprometida": str(comp),
            "percentual": float(pct.quantize(Decimal("0.01"))),
            "saturada": pct >= 90,
        }

    @staticmethod
    def proxima_data_disponivel(
        categoria_id: int,
        horas_necessarias: Decimal,
        a_partir_de: date | None = None,
    ) -> date:
        """Retorna a primeira data em que `horas_necessarias` cabem."""
        data = a_partir_de or date.today()
        for _ in range(60):  # limite 60 dias
            util = CapacidadeService.utilizacao(categoria_id, data)
            folga = Decimal(util["disponivel"]) - Decimal(util["comprometida"])
            if folga >= horas_necessarias:
                return data
            data += timedelta(days=1)
        raise ValueError("Capacidade esgotada por mais de 60 dias.")
```

#### Frontend

- **Widget no dashboard** `/dashboard` (gerente): heat map semanal por categoria — verde/amarelo/vermelho por utilização.
- **Página `/capacidade`**:
  - Filtro por categoria e semana.
  - Timeline por técnico com OSs alocadas.
  - Botão "Adicionar bloqueio".
  - Drag-and-drop leve para realocar OS entre técnicos (opcional — pode ficar para sprint extra).
- **Integração com orçamento**: ao enviar orçamento, se `CapacidadeService.proxima_data_disponivel()` > 3 dias da validade, aviso amarelo "Prazo apertado — revisar entrega".

---

### 2. Feedback loop — variância de ficha

#### Model

```python
# apps/pricing_tech/models_variance.py

class VarianciaFicha(PaddockBaseModel):
    """Análise agregada comparando ficha prevista vs. apontamento real.
    Gerada periodicamente (Celery beat) — uma linha por (servico, ficha_versao, período)."""

    servico_canonico = models.ForeignKey(
        "pricing_catalog.ServicoCanonico", on_delete=models.CASCADE,
    )
    ficha_versao = models.PositiveIntegerField()
    periodo_inicio = models.DateField()
    periodo_fim = models.DateField()

    amostras = models.PositiveIntegerField()
    # Quantidade de OSLinha concluídas nesse período para esse serviço

    horas_previstas_media = models.DecimalField(max_digits=6, decimal_places=2)
    horas_reais_media = models.DecimalField(max_digits=6, decimal_places=2)
    variancia_horas_pct = models.DecimalField(max_digits=6, decimal_places=2)
    # ((reais - previstas) / previstas) × 100

    categorias_detalhe = models.JSONField()
    # [{"categoria": "pintor", "prev": 3.0, "real": 3.4, "var_pct": 13.3}]

    recomendacao = models.CharField(
        max_length=30,
        choices=[
            ("dentro_margem", "Dentro da margem esperada"),
            ("revisar_ficha", "Revisar ficha — variância alta"),
            ("amostra_insuficiente", "Amostra insuficiente"),
        ],
    )

    criado_em = models.DateTimeField(auto_now_add=True)


class VarianciaPecaCusto(PaddockBaseModel):
    """Compara custo previsto de peça (no snapshot) vs custo real consumido."""

    peca_canonica = models.ForeignKey(
        "pricing_catalog.PecaCanonica", on_delete=models.CASCADE,
    )
    periodo_inicio = models.DateField()
    periodo_fim = models.DateField()
    amostras = models.PositiveIntegerField()
    custo_previsto_media = models.DecimalField(max_digits=12, decimal_places=2)
    custo_real_media = models.DecimalField(max_digits=12, decimal_places=2)
    variancia_pct = models.DecimalField(max_digits=6, decimal_places=2)
    criado_em = models.DateTimeField(auto_now_add=True)
```

#### Service + Celery beat

```python
# apps/pricing_tech/services/variance.py

LIMITE_VARIANCIA_OK = Decimal("10")      # ±10% = dentro
LIMITE_VARIANCIA_ALERTA = Decimal("25")  # > 25% = revisar
MINIMO_AMOSTRAS = 5

class VarianciaService:
    @staticmethod
    def gerar_variancia_periodo(
        servico_id: int,
        inicio: date,
        fim: date,
    ) -> VarianciaFicha:
        os_linhas = OSLinha.objects.filter(
            servico_canonico_id=servico_id,
            status_execucao="concluida",
            service_order__delivered_at__date__gte=inicio,
            service_order__delivered_at__date__lte=fim,
        )

        amostras = os_linhas.count()
        if amostras < MINIMO_AMOSTRAS:
            return VarianciaFicha.objects.create(
                servico_canonico_id=servico_id,
                ficha_versao=0,
                periodo_inicio=inicio,
                periodo_fim=fim,
                amostras=amostras,
                horas_previstas_media=Decimal("0"),
                horas_reais_media=Decimal("0"),
                variancia_horas_pct=Decimal("0"),
                categorias_detalhe=[],
                recomendacao="amostra_insuficiente",
            )

        # Agregar por categoria
        detalhe: dict[str, dict] = {}
        for osl in os_linhas.select_related("snapshot").prefetch_related("apontamentos"):
            ficha_decomp = osl.snapshot.decomposicao.get("mao_obra", [])
            for item in ficha_decomp:
                cat = item["categoria"]
                detalhe.setdefault(cat, {"prev": Decimal("0"), "real": Decimal("0"), "n": 0})
                detalhe[cat]["prev"] += Decimal(item["horas"])
                detalhe[cat]["n"] += 1
            for ap in osl.apontamentos.filter(encerrado_em__isnull=False):
                cat = ap.categoria_mao_obra.codigo
                detalhe.setdefault(cat, {"prev": Decimal("0"), "real": Decimal("0"), "n": 0})
                detalhe[cat]["real"] += ap.horas

        detalhe_json = []
        prev_tot = real_tot = Decimal("0")
        for cat, d in detalhe.items():
            prev_med = d["prev"] / amostras
            real_med = d["real"] / amostras
            var_pct = ((real_med - prev_med) / prev_med * 100) if prev_med > 0 else Decimal("0")
            detalhe_json.append({
                "categoria": cat,
                "prev": str(prev_med.quantize(Decimal("0.01"))),
                "real": str(real_med.quantize(Decimal("0.01"))),
                "var_pct": float(var_pct.quantize(Decimal("0.01"))),
            })
            prev_tot += prev_med
            real_tot += real_med

        var_global = ((real_tot - prev_tot) / prev_tot * 100) if prev_tot > 0 else Decimal("0")

        if abs(var_global) <= LIMITE_VARIANCIA_OK:
            recom = "dentro_margem"
        elif abs(var_global) >= LIMITE_VARIANCIA_ALERTA:
            recom = "revisar_ficha"
        else:
            recom = "dentro_margem"

        servico = ServicoCanonico.objects.get(id=servico_id)
        ficha_ativa = FichaTecnicaServico.objects.filter(
            servico=servico, is_active=True,
        ).first()

        return VarianciaFicha.objects.create(
            servico_canonico_id=servico_id,
            ficha_versao=ficha_ativa.versao if ficha_ativa else 0,
            periodo_inicio=inicio,
            periodo_fim=fim,
            amostras=amostras,
            horas_previstas_media=prev_tot,
            horas_reais_media=real_tot,
            variancia_horas_pct=var_global,
            categorias_detalhe=detalhe_json,
            recomendacao=recom,
        )


@shared_task
def task_gerar_variancias_mensais(tenant_schema: str) -> dict:
    """Celery beat: dia 1 de cada mês, gera variâncias do mês anterior para
    TODOS os serviços que tiveram movimento."""
    with schema_context(tenant_schema):
        hoje = date.today()
        mes_passado_fim = date(hoje.year, hoje.month, 1) - timedelta(days=1)
        mes_passado_ini = date(mes_passado_fim.year, mes_passado_fim.month, 1)

        servicos = ServicoCanonico.objects.filter(
            oslinha__status_execucao="concluida",
            oslinha__service_order__delivered_at__date__range=(
                mes_passado_ini, mes_passado_fim,
            ),
        ).distinct()

        criadas = 0
        for s in servicos:
            VarianciaService.gerar_variancia_periodo(
                s.id, mes_passado_ini, mes_passado_fim,
            )
            criadas += 1
        return {"variancias_criadas": criadas}
```

#### Frontend

- **Página `/pricing/variancia`** (ADMIN+):
  - Tabela de variâncias: serviço · período · amostras · %variância · recomendação.
  - Filtro por recomendação (revisar_ficha em destaque).
  - Clique abre drill-down: tabela de categorias com prev × real.
  - Botão "Criar nova versão da ficha baseada no real" → pré-preenche formulário de ficha com médias reais.

---

### 3. Auditoria completa

#### Model

```python
# apps/pricing_engine/models_audit.py

class AuditoriaMotor(PaddockBaseModel):
    """Log imutável de decisões sensíveis do motor."""

    TIPOS = [
        ("calculo_servico",    "Cálculo de serviço"),
        ("calculo_peca",       "Cálculo de peça"),
        ("override_margem",    "Override de margem"),
        ("override_tamanho",   "Override de tamanho"),
        ("reserva_forcada",    "Reserva forçada (mais caro primeiro)"),
        ("orcamento_aprovado", "Orçamento aprovado"),
        ("os_criada",          "OS criada do orçamento"),
        ("ia_sugerida",        "Sugestão IA aceita"),
        ("alias_criado",       "Alias criado manualmente"),
        ("ficha_nova_versao",  "Nova versão de ficha"),
        ("margem_alterada",    "Margem base alterada"),
        ("custo_hora_alterado","Custo hora fallback alterado"),
    ]

    tipo = models.CharField(max_length=30, choices=TIPOS)
    usuario = models.ForeignKey("authentication.GlobalUser", null=True, on_delete=models.SET_NULL)
    empresa = models.ForeignKey("pricing_profile.Empresa", null=True, on_delete=models.SET_NULL)
    objeto_afetado_tipo = models.CharField(max_length=60, blank=True)
    # "CalculoCustoSnapshot", "Orcamento", "MargemOperacao", etc.
    objeto_afetado_id = models.CharField(max_length=50, blank=True)
    payload_antes = models.JSONField(null=True, blank=True)
    payload_depois = models.JSONField(null=True, blank=True)
    justificativa = models.TextField(blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=300, blank=True)
    criado_em = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=["tipo", "-criado_em"]),
            models.Index(fields=["usuario", "-criado_em"]),
            models.Index(fields=["empresa", "tipo", "-criado_em"]),
        ]
        # Read-only — nenhum update/delete permitido pela aplicação.
```

#### Service wrapper

```python
# apps/pricing_engine/services/audit.py

class AuditoriaService:
    @staticmethod
    def log(
        tipo: str,
        usuario_id: str | None,
        empresa_id: int | None,
        objeto_tipo: str = "",
        objeto_id: str = "",
        payload_antes: dict | None = None,
        payload_depois: dict | None = None,
        justificativa: str = "",
        request=None,
    ) -> None:
        ip = request.META.get("REMOTE_ADDR") if request else None
        ua = request.META.get("HTTP_USER_AGENT", "")[:300] if request else ""
        AuditoriaMotor.objects.create(
            tipo=tipo,
            usuario_id=usuario_id,
            empresa_id=empresa_id,
            objeto_afetado_tipo=objeto_tipo,
            objeto_afetado_id=str(objeto_id),
            payload_antes=payload_antes,
            payload_depois=payload_depois,
            justificativa=justificativa[:2000],
            ip=ip,
            user_agent=ua,
        )
```

**Pontos de chamada** (instrumentar):
- `MotorPrecificacaoService.calcular_servico` e `.calcular_peca` → `calculo_servico`/`calculo_peca` (sem payload_antes).
- `ReservaUnidadeService.reservar(forcar_mais_caro=True)` → `reserva_forcada` com justificativa obrigatória.
- `OrcamentoService.aprovar` → `orcamento_aprovado` + `os_criada`.
- `FichaTecnicaService.criar_nova_versao` → `ficha_nova_versao` com motivo.
- `MargemOperacao`/`MarkupPeca` save override → `margem_alterada`.
- `AliasFeedbackService.aceitar_match` → `alias_criado`.
- Aceite de sugestão IA → `ia_sugerida`.

#### Frontend

- **Página `/auditoria/motor`** (ADMIN+):
  - Timeline com filtros (tipo, usuário, empresa, período).
  - Export CSV.
  - Drill-down mostra `payload_antes` × `payload_depois` em diff visual.
- **Menu na sidebar** sob "Admin" — apenas para ADMIN+.

---

### 4. Observabilidade

#### Sentry

Configurar `apps.pricing_engine`, `apps.pricing_tech`, `apps.pricing_benchmark`,
`apps.quotes`, `apps.inventory` com breadcrumbs customizados:

```python
# apps/pricing_engine/services/motor.py — extensão
import sentry_sdk

class MotorPrecificacaoService:
    @staticmethod
    def calcular_servico(ctx, servico_id, user_id=None):
        with sentry_sdk.start_transaction(op="pricing.calcular_servico"):
            sentry_sdk.set_tag("empresa_id", ctx.empresa_id)
            sentry_sdk.set_tag("servico_id", servico_id)
            sentry_sdk.set_context("contexto_motor", {
                "marca": ctx.veiculo_marca,
                "modelo": ctx.veiculo_modelo,
                "segmento": ctx.segmento_codigo,
            })
            ...
```

#### Métricas de performance

Instrumentar com timing decorator:

```python
# packages/python/paddock_metrics.py  (util compartilhada)

def timing(label: str):
    def deco(fn):
        def wrapped(*a, **kw):
            t0 = time.perf_counter()
            try:
                return fn(*a, **kw)
            finally:
                elapsed_ms = (time.perf_counter() - t0) * 1000
                logger.info(f"[timing] {label} elapsed_ms={elapsed_ms:.2f}")
                # Export para Prometheus/Grafana ou StatsD depois
        return wrapped
    return deco
```

Aplicar em:
- `MotorPrecificacaoService.calcular_servico` — meta < 300ms p95.
- `AliasMatcher.match_servico` — meta < 100ms p95.
- `PDFIngestionService.processar` — log total + por página.
- `IAComposicaoService.sugerir` — meta < 8s p95.

#### Healthcheck

Endpoint `/api/v1/pricing/healthcheck/` verifica:
- DB conectividade.
- Celery worker respondendo (ping task com timeout 2s).
- pgvector extension instalada.
- `CustoHoraService.custo_hora("pintor")` retorna valor.
- `CustoPecaService` ou fallback para pelo menos 1 peça cadastrada.

Usado em deploy Coolify — falha = rollback.

---

### 5. Hardening + testes de carga

#### Teste de carga com Locust

```python
# load_tests/pricing.py

from locust import HttpUser, task, between

class OrcamentoUser(HttpUser):
    wait_time = between(1, 3)

    def on_start(self):
        # Login dev
        resp = self.client.post("/api/v1/auth/dev-login", json={
            "email": "admin@paddock.solutions",
            "password": "paddock123",
        })
        self.client.headers["Authorization"] = f"Bearer {resp.json()['token']}"
        self.client.headers["X-Tenant-Domain"] = "dscar.localhost"

    @task(3)
    def simular_servico(self):
        self.client.post("/api/v1/pricing/calcular-servico/", json={
            "contexto": {
                "empresa_id": 1,
                "veiculo_marca": "VW",
                "veiculo_modelo": "Gol",
                "veiculo_ano": 2018,
                "quem_paga": "cliente",
                "aplica_multiplicador_tamanho": True,
            },
            "servico_canonico_id": 42,
        })

    @task(1)
    def listar_orcamentos(self):
        self.client.get("/api/v1/quotes/orcamentos/?page=1")
```

Meta: **50 req/s** de `calcular-servico` sem erros e latência p95 < 500ms em dev.

#### Migração multi-tenant

Validar que toda a stack funciona para um **segundo tenant** novo (criar
`tenant_oficina2`):
- `make migrate` cria todos os schemas.
- `setup_catalogo_base` importa catálogo base.
- `setup_chart_of_accounts` importa plano de contas.
- Seed de `ParametroRateio`, `CustoHoraFallback`, `MargemOperacao` para o novo tenant.
- Criar management command `setup_motor_precificacao --tenant=oficina2` que orquestra tudo.

---

### 6. Endpoints

```
# Capacidade
GET    /api/v1/capacidade/utilizacao/?categoria=&dia=           (MANAGER+)
GET    /api/v1/capacidade/heatmap-semana/?semana=YYYY-WW        (MANAGER+)
POST   /api/v1/capacidade/bloqueios/                            (MANAGER+)
GET    /api/v1/capacidade/proxima-data/?categoria=&horas=       (CONSULTANT+)

# Variância
GET    /api/v1/pricing/variancias/                              (ADMIN+)
POST   /api/v1/pricing/variancias/gerar/                        body: {servico_id, inicio, fim}
GET    /api/v1/pricing/variancias/{id}/                         drill-down detalhe

# Auditoria
GET    /api/v1/auditoria/motor/                                 (ADMIN+)
GET    /api/v1/auditoria/motor/{id}/                            (ADMIN+)
GET    /api/v1/auditoria/motor/export.csv                       (ADMIN+)

# Healthcheck
GET    /api/v1/pricing/healthcheck/                             (público — sem auth)
```

---

### 7. Frontend

#### `/dashboard` — widget de capacidade

Grid 3×7 (3 categorias principais × 7 dias da semana), cores verde/amarelo/vermelho por utilização. Clique abre `/capacidade`.

#### `/capacidade`

- Select semana.
- Heatmap por categoria e dia.
- Tabela de bloqueios ativos.
- Botão "Adicionar bloqueio".

#### `/pricing/variancia`

Tabela com recomendação como badge destacado:
- verde: dentro_margem.
- âmbar: amostra_insuficiente.
- vermelho: revisar_ficha.

Drill-down mostra comparativo categoria a categoria.

#### `/auditoria/motor`

Timeline com filtros avançados + export. Drill-down renderiza diff visual (antes/depois) como JSON formatado lado a lado.

---

## Testes

### Backend (pytest) — 40+ testes

```
tests/capacity/
├── test_disponibilidade.py
│   ├── test_conta_horas_de_tecnicos_ativos
│   ├── test_ignora_tecnico_fora_dias_semana
│   ├── test_aplica_bloqueio_tecnico_individual
│   ├── test_aplica_bloqueio_categoria_geral
│   └── test_vigencia_capacidade_respeitada
├── test_utilizacao.py
│   ├── test_apenas_os_ativas_contabilizadas
│   ├── test_percentual_calculado_corretamente
│   └── test_saturada_90_pct
└── test_proxima_data.py
    ├── test_retorna_hoje_quando_cabe
    ├── test_avanca_dias_quando_cheio
    └── test_60_dias_limite_raise

tests/variance/
├── test_gerar_variancia.py
│   ├── test_amostra_insuficiente
│   ├── test_dentro_margem_10
│   ├── test_revisar_ficha_acima_25
│   ├── test_detalhe_por_categoria
│   └── test_ficha_versao_atual_capturada
├── test_variance_peca.py
│   └── test_compara_custo_previsto_real

tests/auditoria/
├── test_auditoria_service.py
│   ├── test_log_calculo_servico
│   ├── test_log_reserva_forcada_exige_justificativa
│   ├── test_log_ip_e_ua_capturados
│   └── test_audit_imutavel_model_level
├── test_auditoria_cobertura.py     # integração: dispara cada endpoint e verifica log
│   ├── test_aprovar_orcamento_gera_2_logs
│   ├── test_override_margem_gera_log
│   └── test_aceite_sugestao_ia_gera_log

tests/observability/
├── test_healthcheck.py
│   ├── test_retorna_200_com_tudo_ok
│   ├── test_retorna_503_se_celery_down
│   └── test_retorna_503_se_custo_hora_fallback_vazio
└── test_timing_decorator.py
    └── test_loga_elapsed_ms
```

### Teste de carga (Locust)

```
cd load_tests && locust -f pricing.py --users 50 --spawn-rate 5 --run-time 2m
```

Relatório gerado em `reports/load-test-motor.html`.

### Playwright

```
e2e/variance-flow.spec.ts
  ├── Admin acessa /pricing/variancia
  ├── Seleciona serviço com variância > 25%
  ├── Abre drill-down
  ├── Clica "Criar nova versão da ficha"
  └── Verifica formulário pré-preenchido com médias reais

e2e/auditoria-flow.spec.ts
  ├── Admin filtra por tipo "calculo_servico"
  ├── Verifica ordem decrescente por data
  ├── Abre drill-down
  └── Exporta CSV
```

---

## Critérios de aceite

- [ ] Heatmap de capacidade renderiza semana completa em < 1s.
- [ ] `CapacidadeService.proxima_data_disponivel()` respeita bloqueios.
- [ ] Variância mensal gerada automaticamente pelo Celery beat no dia 1.
- [ ] Aba "Revisar ficha" destaca variâncias > 25% em vermelho.
- [ ] 100% das ações sensíveis têm log em `AuditoriaMotor` (checar via teste de cobertura).
- [ ] Export CSV de auditoria funciona para até 10k registros.
- [ ] Healthcheck retorna 200 em dev e sobe 503 se Celery offline.
- [ ] Teste de carga: 50 req/s de `calcular-servico`, p95 < 500ms, 0 erros.
- [ ] Segundo tenant (`tenant_oficina2`) provisionado com `setup_motor_precificacao` em < 5 minutos.
- [ ] Todos os testes unitários, e2e e de carga passando.

---

## Armadilhas específicas

### P1 — AuditoriaMotor é append-only, sem update ou delete
```python
# ERRADO — deixar manager padrão
AuditoriaMotor.objects.update(...)  # pode acontecer

# CORRETO — override save/update/delete no model
class AuditoriaMotor(models.Model):
    ...
    def save(self, *args, **kwargs):
        if self.pk:
            raise ValueError("AuditoriaMotor é append-only.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError("AuditoriaMotor não suporta delete.")
```
Também, permissão no admin Django apenas view + add. Nunca delete/update.

### P2 — `payload_antes` e `payload_depois` sem dados pessoais
Log pode conter payload de Orcamento que tem customer_id, etc.
**Nunca** logar CPF/email/telefone em claro. Aplicar `_redact()` antes:
```python
def _redact(data: dict) -> dict:
    SENS = ("cpf", "email", "phone", "telefone", "pix")
    return {k: ("***" if k.lower() in SENS else v) for k, v in data.items()}
```

### P3 — Variância mensal precisa de MINIMO_AMOSTRAS
Serviços de baixo volume (ex: repintura completa) podem não ter 5
execuções/mês. Retornar `recomendacao=amostra_insuficiente` e exibir
na UI com badge âmbar — sem quebrar.

### P4 — Feedback loop NÃO altera ficha automaticamente
Variância detecta desvio. Recomendação mostra na UI. Operador humano
decide e cria nova versão via fluxo normal do MO-4. **Jamais** alterar
ficha via task automática — ficha é decisão humana.

### P5 — Capacidade calculada bate com realidade após recalcular
Se técnico muda de categoria a meio do período, ou entra/sai, a janela
de `vigente_desde/ate` deve cobrir. Teste de transição obrigatório.

### P6 — Bloqueio por categoria afeta TODOS os técnicos da categoria
Ex: "equipamento de solda quebrado" bloqueia todos os soldadores. Fluxo
de UI deve permitir bloquear por categoria sem ter que marcar um a um.

### P7 — Healthcheck não pode fazer auth completa (deadlock)
Se healthcheck tenta JWT, e JWT tem problema, healthcheck falha,
Coolify mata container, container não responde mais ao healthcheck →
loop. Endpoint público mesmo, com rate limit do Cloudflare.

### P8 — Locust e pool do DB
Teste de carga com 50 usuários pode saturar pool PG. `MAX_CONNS` padrão
100; `CONN_MAX_AGE` por worker. Documentar limites de carga no README
do deploy.

### P9 — `setup_motor_precificacao` é idempotente
Rodar 2x não deve duplicar dados. Usar `get_or_create` em todos os seeds.
Testar explicitamente.

### P10 — Sentry breadcrumbs NUNCA carregam custo interno
```python
# ERRADO — vaza custo em Sentry
sentry_sdk.set_extra("custo_total_base", str(custo_total_base))

# CORRETO — apenas IDs e contexto não sensível
sentry_sdk.set_tag("servico_id", servico_id)
sentry_sdk.set_context("resolve", {"via": "fuzzy", "confianca": 0.87})
```
Sentry é externo. Custos e margens ficam só no DB.

### P11 — Variância de peça usa `ConsumoInsumo.valor_unitario_na_baixa`
NUNCA `LoteInsumo.valor_unitario_base` atual — esse muda, sr. Snapshot
do consumo que é a fonte da verdade retroativa.

---

## Handoff para produção SaaS

Entregar:

1. `docs/mo-runbook-producao.md` — checklist de onboarding de novo tenant:
   - Criar schema + migrate.
   - Seed catálogo base.
   - Seed plano de contas.
   - Seed `ParametroRateio`, `CustoHoraFallback`, `MargemOperacao`.
   - Importar catálogo de peças do cliente (CSV template).
   - Primeiro usuário ADMIN.
   - Teste smoke: criar orçamento + aprovar + bipar peça.
2. `docs/mo-playbook-pricing.md` — guia ao cliente (não-técnico) sobre:
   - Como configurar margens.
   - Como criar e editar ficha técnica.
   - Como interpretar variância.
   - Como aprovar sugestão IA.
3. Dashboard executivo `/dashboard/pricing-exec` (só OWNER):
   - Taxa de aprovação de orçamentos.
   - Tempo médio orçamento → OS.
   - Variância média por categoria.
   - Top 10 serviços por volume e variância.
   - Utilização média por categoria na última semana.
4. Alerts:
   - Celery beat: variância > 25% em serviço de alto volume → notificação interna.
   - Saturação > 95% em alguma categoria por 3 dias seguidos → alerta.
   - Falha de ingestão PDF → alerta no Slack/WhatsApp interno.

---

## Checklist pós-sprint

- [ ] `make migrate` aplicou capacity + variance + audit migrations.
- [ ] `make test-backend` verde — 40+ testes, cobertura >= 85% no motor.
- [ ] Celery beat configurado com `task_gerar_variancias_mensais`.
- [ ] Sentry DSN configurado em Coolify para prod.
- [ ] Load test executado com relatório anexo ao PR.
- [ ] Segundo tenant provisionado e funcionando em ambiente de homolog.
- [ ] `docs/mo-runbook-producao.md` e `docs/mo-playbook-pricing.md` escritos.
- [ ] CLAUDE.md: atualizar seção "Motor de Precificação" com status "Produção".
- [ ] Atualizar `mo-roadmap.md` marcando MO-9 como concluído e migrar o motor do backlog para "Produção".
- [ ] `make sprint-close SPRINT=MO-09` executado.
- [ ] Retrospectiva final do motor: o que cortar, o que ampliar, próximos módulos derivados (ex: motor para Paddock Agências).

---

## Fim do roadmap MO

Após MO-9, o Motor de Orçamentos está:
- Funcional ponta a ponta (orçamento → OS → apontamento → feedback).
- Auditável (AuditoriaMotor + Sentry + healthcheck).
- Determinístico (snapshots imutáveis).
- Escalável (multi-tenant, testes de carga aprovados).
- Com IA como assistente (composição) — nunca como oráculo de preço.

Próximas evoluções (fora do escopo):
- Portal do cliente/seguradora para aprovar orçamento online.
- Integração com AudaPad/Cilia para cotação cruzada automática.
- Machine learning para fine-tuning de ficha técnica baseado em histórico real.
- Motor adaptado para **Paddock Agências** (serviços de marketing ao invés de automotivo).
- Portal SaaS multi-marketplace para oficinas.
