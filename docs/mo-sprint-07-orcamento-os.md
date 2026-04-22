# MO-Sprint 07 — Orçamento + OS Integrada ao Motor (modelo Cilia)

**Duração:** 2 semanas | **Equipe:** Solo + Claude Code | **Prioridade:** P0
**Pré-requisitos:** MO-5 (estoque), MO-6 (motor) · **Desbloqueia:** MO-8, MO-9
**Baseado em:** [ADR-001 — Modelo de linha de OS (Peça × Ação + Áreas de Impacto)](./adr-001-modelo-linha-os-cilia.md)

---

## Objetivo

Ligar o motor de precificação ao fluxo real de atendimento, adotando o
**modelo (Peça × Ação) + Áreas de Impacto** decidido no ADR-001:

1. Criar o app `apps.quotes` para **Orçamento** (documento pré-OS, versionado,
   aprovado pelo cliente/seguradora) com duas naturezas de linha:
   - **Intervenção em Peça** — par (`PecaCanonica`, `Acao`) com ficha e snapshot.
   - **Item Adicional** — serviço sem peça (alinhamento, polimento, lavagem), vindo do `ServiceCatalog`.
2. Introduzir `AreaImpacto` como camada de agrupamento de intervenções — unidade
   de negociação com seguradora (aprovação / negação por região do veículo).
3. Estender `apps.service_orders` com as entidades espelhadas de execução.
4. Implementar picking (bipagem de peças reservadas) e apontamento (horas gastas
   por técnico, vinculado à intervenção).
5. Fechar o loop: orçamento → OS → peças reservadas → apontamento → encerramento.

Após esta sprint, o cliente comum da DS Car já pode ser atendido **inteiramente**
com o motor ligado, e orçamentos seguem o vocabulário Cilia — preparando MO-8
(ingestão de PDF) para ser 1:1.

---

## Vocabulário adotado (ver ADR-001)

```
Ação             (enum): TROCAR, REPARAR, PINTAR, REMOCAO_INSTALACAO
Status do item   (enum): ORCADO, APROVADO, SEM_COBERTURA, SOB_ANALISE, EXECUTADO, CANCELADO
Qualificador    (enum): PPO, PRO, PR, PREC
Fornecimento    (enum): OFICINA, SEGURADORA, CLIENTE
Flags            (bool): abaixo_padrao, acima_padrao, inclusao_manual, codigo_diferente
```

Todo o vocabulário é espelhado em `packages/types/src/os.types.ts`.

---

## Referências obrigatórias

1. [ADR-001](./adr-001-modelo-linha-os-cilia.md) — decisão e trade-offs do modelo.
2. `docs/mo-roadmap.md` — **armadilhas A4 (snapshot imutável), A8 (empresa_id obrigatório)**.
3. Spec v3.0 — §18 (orçamento), §19 (aprovação), §20 (apontamento), §21 (encerramento).
4. `MotorPrecificacaoService` e `CalculoCustoSnapshot` (MO-6).
5. `ReservaUnidadeService` e `BaixaInsumoService` (MO-5).
6. [`docs/cilia-vocabulary.md`](./cilia-vocabulary.md) — vocabulário Cilia consolidado (ações, qualificadores, status, áreas, totalizadores).
7. CLAUDE.md — fluxo de OS, `VALID_TRANSITIONS`, padrões Kanban.

---

## Escopo

### 1. Novo app: `apps.quotes` (TENANT_APP)

#### 1.1 Constantes e enums

```python
# apps/quotes/constants.py

class Acao(models.TextChoices):
    TROCAR             = "trocar",             "Trocar"
    REPARAR            = "reparar",            "Reparar"
    PINTAR             = "pintar",             "Pintar"
    REMOCAO_INSTALACAO = "remocao_instalacao", "Remoção e instalação"


class StatusItem(models.TextChoices):
    """Status Cilia — aplica-se tanto a Intervenção quanto a Item Adicional."""
    ORCADO        = "orcado",        "Orçado"
    APROVADO      = "aprovado",      "Aprovado"
    SEM_COBERTURA = "sem_cobertura", "Sem cobertura"
    SOB_ANALISE   = "sob_analise",   "Sob análise"
    EXECUTADO     = "executado",     "Executado"
    CANCELADO     = "cancelado",     "Cancelado"


class QualificadorPeca(models.TextChoices):
    PPO  = "PPO",  "Peça Original (PPO)"
    PRO  = "PRO",  "Peça Recondicionada Original (PRO)"
    PR   = "PR",   "Peça de Reposição (PR)"
    PREC = "PREC", "Peça Recondicionada (PREC)"


class Fornecimento(models.TextChoices):
    OFICINA     = "oficina",     "Oficina"
    SEGURADORA  = "seguradora",  "Seguradora"
    CLIENTE     = "cliente",     "Cliente"


class StatusArea(models.TextChoices):
    ABERTA              = "aberta",              "Aberta"
    APROVADA            = "aprovada",            "Aprovada"
    NEGADA_PRE_EXIST    = "negada_pre_exist",    "Negada — pré-existência"
    PARCIAL             = "parcial",             "Parcial"
    CANCELADA           = "cancelada",           "Cancelada"
```

#### 1.2 Mapeamento Ação → ServiçoCanonico

Cada Ação resolve para um `ServicoCanonico` do catálogo. O mapeamento é
documento vivo em `apps.pricing_catalog.constants`:

```python
# apps/pricing_catalog/constants.py (adicionar; similar a MAPEAMENTO_CATEGORIA_POSITION)

MAPEAMENTO_ACAO_SERVICO: dict[str, str] = {
    # Ação → código canônico do serviço (buscado em ServicoCanonico.codigo)
    "trocar":             "INST_PECA",        # Instalação de peça (mão de obra)
    "reparar":            "FUNILARIA",        # Funilaria / desamassamento
    "pintar":             "PINTURA",          # Pintura (usa TipoPintura do veículo)
    "remocao_instalacao": "REMOCAO_INSTAL",   # R&I (desmontar + remontar sem trocar)
}
```

`setup_catalogo_base` (MO-2) garante que os quatro serviços existem. Ação sem
canônico correspondente → `MapeamentoAcaoAusente` levantado no `OrcamentoService`.

#### 1.3 Models

```python
# apps/quotes/models.py

class Orcamento(PaddockBaseModel):
    """Documento comercial pré-OS. Pode ter múltiplas versões.
    Aprovação do cliente/seguradora converte para OS."""

    STATUS = [
        ("rascunho",       "Rascunho"),
        ("enviado",        "Enviado ao cliente"),
        ("aprovado",       "Aprovado"),
        ("aprovado_parc",  "Aprovação parcial"),
        ("recusado",       "Recusado"),
        ("expirado",       "Expirado"),
        ("convertido_os",  "Convertido em OS"),
    ]

    empresa = models.ForeignKey(
        "pricing_profile.Empresa", on_delete=models.PROTECT,
    )
    numero = models.CharField(max_length=20)           # "ORC-2026-000123"
    versao = models.PositiveIntegerField(default=1)

    customer = models.ForeignKey(
        "customers.UnifiedCustomer",
        on_delete=models.PROTECT,
        related_name="orcamentos",
    )
    insurer = models.ForeignKey(
        "insurers.Insurer", null=True, blank=True,
        on_delete=models.PROTECT,
    )
    tipo_responsabilidade = models.CharField(
        max_length=20,
        choices=[
            ("cliente",    "Cliente"),
            ("seguradora", "Seguradora"),
            ("rcf",        "RCF — responsabilidade de terceiros"),
        ],
        default="cliente",
    )
    sinistro_numero = models.CharField(max_length=40, blank=True)
    # Número do sinistro informado pela seguradora (Cilia preenche)

    veiculo_marca   = models.CharField(max_length=60)
    veiculo_modelo  = models.CharField(max_length=100)
    veiculo_ano     = models.PositiveIntegerField()
    veiculo_versao  = models.CharField(max_length=60, blank=True)
    veiculo_placa   = models.CharField(max_length=10, blank=True)
    enquadramento_snapshot = models.JSONField()
    # {segmento, tamanho, fator_resp, tipo_pintura} congelado na criação

    status = models.CharField(max_length=20, choices=STATUS, default="rascunho")
    validade = models.DateField()                      # default: hoje + 15 dias
    enviado_em  = models.DateTimeField(null=True, blank=True)
    aprovado_em = models.DateTimeField(null=True, blank=True)

    service_order = models.ForeignKey(
        "service_orders.ServiceOrder", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="orcamentos",
    )  # preenchido quando status ∈ {aprovado, aprovado_parc, convertido_os}

    subtotal = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    desconto = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    total    = models.DecimalField(max_digits=18, decimal_places=2, default=0)

    criado_por  = models.ForeignKey(
        "authentication.GlobalUser", null=True, on_delete=models.SET_NULL,
    )
    criado_em   = models.DateTimeField(auto_now_add=True)
    observacoes = models.TextField(blank=True)

    class Meta:
        unique_together = [("empresa", "numero", "versao")]
        indexes = [
            models.Index(fields=["empresa", "status", "-criado_em"]),
            models.Index(fields=["customer", "-criado_em"]),
        ]


class AreaImpacto(PaddockBaseModel):
    """Região do veículo negociada em bloco com seguradora.

    Toda OS/Orçamento nasce com 1 área chamada "Geral". Em sinistros,
    consultor renomeia (ex: "Lateral Esquerda", "Traseira") e pode
    criar áreas adicionais. Serviços adicionais NÃO pertencem a área."""

    orcamento = models.ForeignKey(
        Orcamento, on_delete=models.CASCADE, related_name="areas",
    )
    titulo = models.CharField(max_length=120)          # "Lateral Esquerda", "Geral"
    ordem = models.PositiveIntegerField(default=0)

    status = models.CharField(
        max_length=20,
        choices=StatusArea.choices,
        default=StatusArea.ABERTA,
    )
    observacao_regulador = models.TextField(blank=True)
    # "avarias pré-existentes da porta traseira para trás"

    class Meta:
        ordering = ["ordem"]
        unique_together = [("orcamento", "titulo")]


class OrcamentoIntervencao(PaddockBaseModel):
    """Intervenção em peça específica = (Peça × Ação) + qualificadores.

    Unidade de negociação com seguradora. Uma mesma peça pode ter
    múltiplas intervenções (ex: porta = TROCAR + PINTAR) — cada uma com
    status e snapshot próprios."""

    orcamento = models.ForeignKey(
        Orcamento, on_delete=models.CASCADE, related_name="intervencoes",
    )
    area_impacto = models.ForeignKey(
        AreaImpacto, on_delete=models.PROTECT, related_name="intervencoes",
    )

    peca_canonica = models.ForeignKey(
        "pricing_catalog.PecaCanonica", on_delete=models.PROTECT,
    )
    acao = models.CharField(max_length=20, choices=Acao.choices)

    # Resolvido via MAPEAMENTO_ACAO_SERVICO no momento do cálculo;
    # persistido para estabilidade de relatórios.
    servico_canonico = models.ForeignKey(
        "pricing_catalog.ServicoCanonico", on_delete=models.PROTECT,
    )
    ficha_tecnica = models.ForeignKey(
        "pricing_tech.FichaTecnicaServico", null=True, blank=True,
        on_delete=models.PROTECT,
    )
    # NULL se ação tem preço fixo sem ficha (raro — apenas R&I simples).

    # Qualificadores Cilia
    qualificador_peca = models.CharField(
        max_length=10, choices=QualificadorPeca.choices, blank=True,
    )  # vazio quando ação ∈ {PINTAR, REPARAR, REMOCAO_INSTALACAO} sem peça nova
    fornecimento = models.CharField(
        max_length=20, choices=Fornecimento.choices, default=Fornecimento.OFICINA,
    )
    codigo_peca = models.CharField(max_length=60, blank=True)
    # Código de fabricante / montadora — aceita divergência entre seguradoras

    # Valores (decompostos ao estilo Cilia)
    horas_mao_obra    = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    valor_peca        = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    valor_mao_obra    = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    valor_insumos     = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    preco_total       = models.DecimalField(max_digits=18, decimal_places=2, default=0)

    snapshot = models.ForeignKey(
        "pricing_engine.CalculoCustoSnapshot",
        on_delete=models.PROTECT, related_name="intervencoes",
    )
    # FK PROTECT — granularidade do snapshot é por (peça × ação)

    status = models.CharField(
        max_length=20, choices=StatusItem.choices, default=StatusItem.ORCADO,
    )

    # Flags Cilia
    abaixo_padrao     = models.BooleanField(default=False)  # valor abaixo do mercado
    acima_padrao      = models.BooleanField(default=False)  # valor acima do mercado
    inclusao_manual   = models.BooleanField(default=False)  # adicionada fora do import
    codigo_diferente  = models.BooleanField(default=False)  # código diverge da referência

    quantidade = models.PositiveIntegerField(default=1)
    ordem = models.PositiveIntegerField(default=0)
    descricao_visivel = models.CharField(max_length=300, blank=True)
    observacao = models.TextField(blank=True)

    class Meta:
        ordering = ["area_impacto__ordem", "ordem"]
        indexes = [
            models.Index(fields=["orcamento", "status"]),
            models.Index(fields=["area_impacto", "status"]),
        ]
        # Regra: uma mesma (orçamento, peça, ação) não se repete dentro da mesma
        # área. Duas portas da mesma referência usam quantidade=2, não linhas
        # duplicadas. Se realmente forem peças distintas (ex: DE e DD), são peças
        # canônicas diferentes no catálogo.
        constraints = [
            models.UniqueConstraint(
                fields=["orcamento", "area_impacto", "peca_canonica", "acao"],
                name="orcamento_intervencao_unica_por_area",
            )
        ]


class OrcamentoItemAdicional(PaddockBaseModel):
    """Serviço sem peça específica (alinhamento, polimento, lavagem técnica).

    Consome `ServiceCatalog` (catálogo simples da Sprint 16).
    NÃO pertence a área de impacto — é lista plana na OS."""

    orcamento = models.ForeignKey(
        Orcamento, on_delete=models.CASCADE, related_name="itens_adicionais",
    )
    service_catalog = models.ForeignKey(
        "service_orders.ServiceCatalog", on_delete=models.PROTECT,
    )

    quantidade     = models.PositiveIntegerField(default=1)
    preco_unitario = models.DecimalField(max_digits=18, decimal_places=2)
    preco_total    = models.DecimalField(max_digits=18, decimal_places=2)

    snapshot = models.ForeignKey(
        "pricing_engine.CalculoCustoSnapshot",
        on_delete=models.PROTECT, related_name="itens_adicionais",
    )

    status = models.CharField(
        max_length=20, choices=StatusItem.choices, default=StatusItem.ORCADO,
    )
    fornecimento = models.CharField(
        max_length=20, choices=Fornecimento.choices, default=Fornecimento.OFICINA,
    )

    inclusao_manual = models.BooleanField(default=False)
    abaixo_padrao   = models.BooleanField(default=False)
    acima_padrao    = models.BooleanField(default=False)

    ordem = models.PositiveIntegerField(default=0)
    descricao_visivel = models.CharField(max_length=300, blank=True)
    observacao = models.TextField(blank=True)

    class Meta:
        ordering = ["ordem"]
        indexes = [models.Index(fields=["orcamento", "status"])]
```

---

### 2. Extensão de `apps.service_orders`

Não reinventar. A `ServiceOrder` existente já tem fluxo de status, fotos, kanban.
Adicionar as entidades de execução espelhadas do orçamento.

```python
# apps/service_orders/models.py (adição)

class OSAreaImpacto(PaddockBaseModel):
    """Espelho de quotes.AreaImpacto após aprovação."""
    service_order = models.ForeignKey(
        ServiceOrder, on_delete=models.CASCADE, related_name="areas_motor",
    )
    area_impacto_origem = models.ForeignKey(
        "quotes.AreaImpacto", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="areas_os",
    )
    titulo = models.CharField(max_length=120)
    ordem = models.PositiveIntegerField(default=0)
    status = models.CharField(
        max_length=20, choices=StatusArea.choices, default=StatusArea.APROVADA,
    )

    class Meta:
        ordering = ["ordem"]


class OSIntervencao(PaddockBaseModel):
    """Intervenção aprovada — espelho de OrcamentoIntervencao em execução."""

    service_order = models.ForeignKey(
        ServiceOrder, on_delete=models.CASCADE, related_name="intervencoes_motor",
    )
    area = models.ForeignKey(
        OSAreaImpacto, on_delete=models.PROTECT, related_name="intervencoes",
    )
    orcamento_intervencao = models.ForeignKey(
        "quotes.OrcamentoIntervencao", null=True, blank=True,
        on_delete=models.SET_NULL,
    )

    peca_canonica     = models.ForeignKey("pricing_catalog.PecaCanonica",    on_delete=models.PROTECT)
    acao              = models.CharField(max_length=20, choices=Acao.choices)
    servico_canonico  = models.ForeignKey("pricing_catalog.ServicoCanonico", on_delete=models.PROTECT)
    ficha_tecnica     = models.ForeignKey(
        "pricing_tech.FichaTecnicaServico", null=True, blank=True, on_delete=models.PROTECT,
    )

    qualificador_peca = models.CharField(max_length=10, choices=QualificadorPeca.choices, blank=True)
    fornecimento      = models.CharField(max_length=20, choices=Fornecimento.choices, default=Fornecimento.OFICINA)
    codigo_peca       = models.CharField(max_length=60, blank=True)

    quantidade     = models.PositiveIntegerField(default=1)
    horas_mao_obra = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    valor_peca     = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    valor_mao_obra = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    valor_insumos  = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    preco_total    = models.DecimalField(max_digits=18, decimal_places=2, default=0)

    snapshot = models.ForeignKey(
        "pricing_engine.CalculoCustoSnapshot", on_delete=models.PROTECT,
    )

    status_execucao = models.CharField(
        max_length=20,
        choices=[
            ("pendente",    "Pendente"),
            ("em_execucao", "Em execução"),
            ("concluida",   "Concluída"),
            ("cancelada",   "Cancelada"),
        ],
        default="pendente",
    )
    status = models.CharField(
        max_length=20, choices=StatusItem.choices, default=StatusItem.APROVADO,
    )  # "EXECUTADO" ao concluir

    ordem = models.PositiveIntegerField(default=0)
    descricao_visivel = models.CharField(max_length=300, blank=True)
    observacao = models.TextField(blank=True)

    class Meta:
        ordering = ["area__ordem", "ordem"]


class OSItemAdicional(PaddockBaseModel):
    """Item adicional aprovado — espelho de OrcamentoItemAdicional em execução."""

    service_order = models.ForeignKey(
        ServiceOrder, on_delete=models.CASCADE, related_name="itens_adicionais_motor",
    )
    orcamento_item_adicional = models.ForeignKey(
        "quotes.OrcamentoItemAdicional", null=True, blank=True,
        on_delete=models.SET_NULL,
    )
    service_catalog = models.ForeignKey(
        "service_orders.ServiceCatalog", on_delete=models.PROTECT,
    )

    quantidade     = models.PositiveIntegerField(default=1)
    preco_unitario = models.DecimalField(max_digits=18, decimal_places=2)
    preco_total    = models.DecimalField(max_digits=18, decimal_places=2)

    snapshot = models.ForeignKey(
        "pricing_engine.CalculoCustoSnapshot", on_delete=models.PROTECT,
    )

    status_execucao = models.CharField(
        max_length=20,
        choices=[
            ("pendente",    "Pendente"),
            ("em_execucao", "Em execução"),
            ("concluida",   "Concluída"),
            ("cancelada",   "Cancelada"),
        ],
        default="pendente",
    )
    status = models.CharField(
        max_length=20, choices=StatusItem.choices, default=StatusItem.APROVADO,
    )

    fornecimento = models.CharField(
        max_length=20, choices=Fornecimento.choices, default=Fornecimento.OFICINA,
    )

    ordem = models.PositiveIntegerField(default=0)
    descricao_visivel = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ["ordem"]


class ApontamentoHoras(PaddockBaseModel):
    """Registro de horas gastas em uma intervenção ou item adicional.

    Aponta em UMA das duas entidades — GenericFK simplifica.
    Em dev: dois FKs nullable + XOR constraint."""

    service_order = models.ForeignKey(
        ServiceOrder, on_delete=models.CASCADE, related_name="apontamentos",
    )
    intervencao = models.ForeignKey(
        OSIntervencao, null=True, blank=True,
        on_delete=models.CASCADE, related_name="apontamentos",
    )
    item_adicional = models.ForeignKey(
        OSItemAdicional, null=True, blank=True,
        on_delete=models.CASCADE, related_name="apontamentos",
    )

    tecnico = models.ForeignKey(
        "hr.Employee", on_delete=models.PROTECT, related_name="apontamentos",
    )
    categoria_mao_obra = models.ForeignKey(
        "pricing_catalog.CategoriaMaoObra", on_delete=models.PROTECT,
    )
    horas = models.DecimalField(
        max_digits=5, decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    iniciado_em = models.DateTimeField()
    encerrado_em = models.DateTimeField(null=True, blank=True)
    observacao = models.CharField(max_length=200, blank=True)

    criado_por = models.ForeignKey(
        "authentication.GlobalUser", null=True, on_delete=models.SET_NULL,
    )
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=(
                    (Q(intervencao__isnull=False) & Q(item_adicional__isnull=True))
                    | (Q(intervencao__isnull=True) & Q(item_adicional__isnull=False))
                ),
                name="apontamento_aponta_em_um",
            )
        ]
```

---

### 3. Services de fluxo

#### 3.1 `OrcamentoService`

```python
# apps/quotes/services.py

class OrcamentoService:
    @staticmethod
    @transaction.atomic
    def criar(
        empresa_id: int,
        customer_id: str,
        insurer_id: int | None,
        tipo_responsabilidade: str,
        sinistro_numero: str,
        veiculo: dict,
        user_id: str,
        observacoes: str = "",
    ) -> Orcamento:
        """Cria orçamento vazio com área 'Geral' pré-criada.

        Itens são adicionados separadamente via `adicionar_intervencao` /
        `adicionar_item_adicional`, para permitir UX de construção iterativa."""
        empresa = Empresa.objects.get(id=empresa_id)
        enq = EnquadramentoService.resolver(
            marca=veiculo["marca"], modelo=veiculo["modelo"],
            ano=veiculo["ano"], versao=veiculo.get("versao"),
        )

        orc = Orcamento.objects.create(
            empresa=empresa,
            numero=NumberingService.next("orcamento", empresa.id),
            customer_id=customer_id,
            insurer_id=insurer_id,
            tipo_responsabilidade=tipo_responsabilidade,
            sinistro_numero=sinistro_numero,
            veiculo_marca=veiculo["marca"],
            veiculo_modelo=veiculo["modelo"],
            veiculo_ano=veiculo["ano"],
            veiculo_versao=veiculo.get("versao", ""),
            veiculo_placa=veiculo.get("placa", ""),
            enquadramento_snapshot={
                "segmento_codigo":        enq.segmento.codigo,
                "tamanho_codigo":         enq.tamanho.codigo,
                "fator_responsabilidade": str(enq.fator_responsabilidade),
                "tipo_pintura_codigo":    veiculo.get("tipo_pintura_codigo"),
            },
            status="rascunho",
            validade=date.today() + timedelta(days=15),
            criado_por_id=user_id,
            observacoes=observacoes,
        )

        # Toda OS nasce com 1 área "Geral" (ADR-001 Action Item #7)
        AreaImpacto.objects.create(
            orcamento=orc, titulo="Geral", ordem=0,
            status=StatusArea.ABERTA,
        )
        return orc

    @staticmethod
    @transaction.atomic
    def adicionar_intervencao(
        orcamento_id: str,
        area_impacto_id: str,
        peca_canonica_id: str,
        acao: str,
        qualificador_peca: str,
        fornecimento: str,
        quantidade: int,
        user_id: str,
        codigo_peca: str = "",
        inclusao_manual: bool = False,
        descricao: str = "",
    ) -> OrcamentoIntervencao:
        """Adiciona intervenção calculando snapshot via motor.

        Ação resolve ServiçoCanonico via MAPEAMENTO_ACAO_SERVICO; ficha é
        resolvida via `FichaTecnicaService.resolver()` (MO-4)."""
        orc = Orcamento.objects.select_for_update().get(id=orcamento_id)
        if orc.status != "rascunho":
            raise ValueError(f"Orçamento em status {orc.status} — não aceita edição.")

        servico_codigo = MAPEAMENTO_ACAO_SERVICO.get(acao)
        if servico_codigo is None:
            raise MapeamentoAcaoAusente(f"Ação {acao} sem mapeamento de serviço.")
        servico = ServicoCanonico.objects.get(codigo=servico_codigo)

        enq = orc.enquadramento_snapshot
        ctx = ContextoCalculo(
            empresa_id=orc.empresa_id,
            veiculo_marca=orc.veiculo_marca,
            veiculo_modelo=orc.veiculo_modelo,
            veiculo_ano=orc.veiculo_ano,
            veiculo_versao=orc.veiculo_versao,
            segmento_codigo=enq["segmento_codigo"],
            tamanho_codigo=enq["tamanho_codigo"],
            tipo_pintura_codigo=enq.get("tipo_pintura_codigo"),
            quem_paga=("seguradora" if orc.insurer_id else "cliente"),
            aplica_multiplicador_tamanho=servico.aplica_multiplicador_tamanho,
        )

        ficha = FichaTecnicaService.resolver(
            servico_id=servico.id,
            tipo_pintura=ctx.tipo_pintura_codigo,
        )

        res = MotorPrecificacaoService.calcular_intervencao(
            ctx=ctx,
            peca_canonica_id=peca_canonica_id,
            servico_canonico_id=servico.id,
            ficha_id=ficha.id if ficha else None,
            quantidade=quantidade,
            user_id=user_id,
        )

        intervencao = OrcamentoIntervencao.objects.create(
            orcamento=orc,
            area_impacto_id=area_impacto_id,
            peca_canonica_id=peca_canonica_id,
            acao=acao,
            servico_canonico=servico,
            ficha_tecnica=ficha,
            qualificador_peca=qualificador_peca,
            fornecimento=fornecimento,
            codigo_peca=codigo_peca,
            quantidade=quantidade,
            horas_mao_obra=res.horas,
            valor_peca=res.valor_peca,
            valor_mao_obra=res.valor_mao_obra,
            valor_insumos=res.valor_insumos,
            preco_total=res.preco_final,
            snapshot_id=res.snapshot_id,
            status=StatusItem.ORCADO,
            inclusao_manual=inclusao_manual,
            ordem=orc.intervencoes.count(),
            descricao_visivel=descricao,
        )
        OrcamentoService._recalcular_totais(orc)
        return intervencao

    @staticmethod
    @transaction.atomic
    def adicionar_item_adicional(
        orcamento_id: str,
        service_catalog_id: str,
        quantidade: int,
        fornecimento: str,
        user_id: str,
        descricao: str = "",
    ) -> OrcamentoItemAdicional:
        """Adiciona serviço adicional (sem peça) — alinhamento, polimento, lavagem."""
        orc = Orcamento.objects.select_for_update().get(id=orcamento_id)
        if orc.status != "rascunho":
            raise ValueError(f"Orçamento em status {orc.status} — não aceita edição.")

        catalog = ServiceCatalog.objects.get(id=service_catalog_id)

        enq = orc.enquadramento_snapshot
        ctx = ContextoCalculo(
            empresa_id=orc.empresa_id,
            veiculo_marca=orc.veiculo_marca,
            veiculo_modelo=orc.veiculo_modelo,
            veiculo_ano=orc.veiculo_ano,
            veiculo_versao=orc.veiculo_versao,
            segmento_codigo=enq["segmento_codigo"],
            tamanho_codigo=enq["tamanho_codigo"],
            tipo_pintura_codigo=enq.get("tipo_pintura_codigo"),
            quem_paga=("seguradora" if orc.insurer_id else "cliente"),
            aplica_multiplicador_tamanho=False,
            # item adicional nunca varia por tamanho — armadilha A3
        )

        res = MotorPrecificacaoService.calcular_service_catalog(
            ctx=ctx, service_catalog_id=service_catalog_id,
            quantidade=quantidade, user_id=user_id,
        )

        item = OrcamentoItemAdicional.objects.create(
            orcamento=orc,
            service_catalog=catalog,
            quantidade=quantidade,
            preco_unitario=res.preco_final / quantidade,
            preco_total=res.preco_final,
            snapshot_id=res.snapshot_id,
            fornecimento=fornecimento,
            status=StatusItem.ORCADO,
            ordem=orc.itens_adicionais.count(),
            descricao_visivel=descricao,
        )
        OrcamentoService._recalcular_totais(orc)
        return item

    @staticmethod
    def _recalcular_totais(orc: Orcamento) -> None:
        subtotal = (
            sum((i.preco_total for i in orc.intervencoes.all()), Decimal("0"))
            + sum((i.preco_total for i in orc.itens_adicionais.all()), Decimal("0"))
        )
        orc.subtotal = subtotal
        orc.total = subtotal - orc.desconto
        orc.save(update_fields=["subtotal", "total"])

    @staticmethod
    @transaction.atomic
    def aprovar(
        orcamento_id: str,
        intervencoes_ids: list[str] | None,
        itens_adicionais_ids: list[str] | None,
        areas_negadas: list[dict] | None,
        user_id: str,
    ) -> ServiceOrder:
        """Aprovação gera OS com itens espelhados.

        `intervencoes_ids=None` e `itens_adicionais_ids=None` → aprova tudo.
        Listas parciais → aprovação parcial.
        `areas_negadas=[{area_id, motivo}]` → marca áreas inteiras como negadas.
        """
        orc = Orcamento.objects.select_for_update().get(id=orcamento_id)
        if orc.status in ("convertido_os", "expirado", "recusado"):
            raise ValueError(f"Orçamento em status {orc.status} não aprovável.")

        # Status de negação por área
        if areas_negadas:
            for a in areas_negadas:
                area = AreaImpacto.objects.get(id=a["area_id"], orcamento=orc)
                area.status = StatusArea.NEGADA_PRE_EXIST
                area.observacao_regulador = a.get("motivo", "")
                area.save(update_fields=["status", "observacao_regulador"])
                # Intervenções da área ficam SEM_COBERTURA
                area.intervencoes.update(status=StatusItem.SEM_COBERTURA)

        intervencoes_aprovadas = orc.intervencoes.exclude(status=StatusItem.SEM_COBERTURA)
        if intervencoes_ids is not None:
            intervencoes_aprovadas = intervencoes_aprovadas.filter(id__in=intervencoes_ids)

        itens_aprovados = orc.itens_adicionais.all()
        if itens_adicionais_ids is not None:
            itens_aprovados = itens_aprovados.filter(id__in=itens_adicionais_ids)

        if not intervencoes_aprovadas.exists() and not itens_aprovados.exists():
            raise ValueError("Nenhum item aprovado.")

        os_ = ServiceOrder.objects.create(
            number=ServiceOrder.next_number(),
            customer_id=orc.customer_id,
            customer_uuid=orc.customer_id,
            customer_name=orc.customer.name,
            vehicle_make=orc.veiculo_marca,
            vehicle_model=orc.veiculo_modelo,
            vehicle_year=orc.veiculo_ano,
            vehicle_version=orc.veiculo_versao,
            vehicle_plate=orc.veiculo_placa,
            insurer_id=orc.insurer_id,
            insured_type=("insured" if orc.insurer_id else "particular"),
            status="authorized",
        )

        # Espelhar áreas aprovadas
        area_map: dict[str, OSAreaImpacto] = {}
        for area in orc.areas.exclude(status=StatusArea.NEGADA_PRE_EXIST):
            os_area = OSAreaImpacto.objects.create(
                service_order=os_,
                area_impacto_origem=area,
                titulo=area.titulo,
                ordem=area.ordem,
                status=StatusArea.APROVADA,
            )
            area_map[str(area.id)] = os_area

        # Espelhar intervenções
        for iv in intervencoes_aprovadas:
            OSIntervencao.objects.create(
                service_order=os_,
                area=area_map[str(iv.area_impacto_id)],
                orcamento_intervencao=iv,
                peca_canonica=iv.peca_canonica,
                acao=iv.acao,
                servico_canonico=iv.servico_canonico,
                ficha_tecnica=iv.ficha_tecnica,
                qualificador_peca=iv.qualificador_peca,
                fornecimento=iv.fornecimento,
                codigo_peca=iv.codigo_peca,
                quantidade=iv.quantidade,
                horas_mao_obra=iv.horas_mao_obra,
                valor_peca=iv.valor_peca,
                valor_mao_obra=iv.valor_mao_obra,
                valor_insumos=iv.valor_insumos,
                preco_total=iv.preco_total,
                snapshot=iv.snapshot,
                status=StatusItem.APROVADO,
                ordem=iv.ordem,
                descricao_visivel=iv.descricao_visivel,
                observacao=iv.observacao,
            )
            iv.status = StatusItem.APROVADO
            iv.save(update_fields=["status"])

        # Intervenções não aprovadas (parcial sem área negada)
        if intervencoes_ids is not None:
            orc.intervencoes.exclude(
                id__in=intervencoes_ids
            ).exclude(
                status=StatusItem.SEM_COBERTURA
            ).update(status=StatusItem.SEM_COBERTURA)

        # Espelhar itens adicionais
        for it in itens_aprovados:
            OSItemAdicional.objects.create(
                service_order=os_,
                orcamento_item_adicional=it,
                service_catalog=it.service_catalog,
                quantidade=it.quantidade,
                preco_unitario=it.preco_unitario,
                preco_total=it.preco_total,
                snapshot=it.snapshot,
                fornecimento=it.fornecimento,
                status=StatusItem.APROVADO,
                ordem=it.ordem,
                descricao_visivel=it.descricao_visivel,
            )
            it.status = StatusItem.APROVADO
            it.save(update_fields=["status"])

        if itens_adicionais_ids is not None:
            orc.itens_adicionais.exclude(
                id__in=itens_adicionais_ids
            ).update(status=StatusItem.SEM_COBERTURA)

        orc.service_order = os_
        parcial = (intervencoes_ids is not None) or (itens_adicionais_ids is not None) or bool(areas_negadas)
        orc.status = "aprovado_parc" if parcial else "aprovado"
        orc.aprovado_em = timezone.now()
        orc.save(update_fields=["service_order", "status", "aprovado_em"])

        # Reserva automática de peças (apenas intervenções com fornecimento=OFICINA e ação=TROCAR)
        for osi in os_.intervencoes_motor.filter(
            fornecimento=Fornecimento.OFICINA, acao=Acao.TROCAR,
        ):
            try:
                ReservaUnidadeService.reservar(
                    peca_canonica_id=osi.peca_canonica_id,
                    quantidade=osi.quantidade,
                    ordem_servico_id=str(os_.id),
                )
            except ReservaIndisponivel:
                logger.warning(
                    f"OS {os_.number}: reserva parcial/impossível peça {osi.peca_canonica_id}"
                )
                # Não bloqueia — operador pode comprar depois (armadilha P6)

        return os_

    @staticmethod
    @transaction.atomic
    def nova_versao(orcamento_id: str, user_id: str) -> Orcamento:
        """Clona orçamento incrementando versão. Recalcula todos os snapshots
        com custos correntes. Mantém `numero`, incrementa `versao`."""
        orig = Orcamento.objects.select_for_update().get(id=orcamento_id)
        nova = Orcamento.objects.create(
            empresa=orig.empresa,
            numero=orig.numero,
            versao=orig.versao + 1,
            customer=orig.customer,
            insurer=orig.insurer,
            tipo_responsabilidade=orig.tipo_responsabilidade,
            sinistro_numero=orig.sinistro_numero,
            veiculo_marca=orig.veiculo_marca,
            veiculo_modelo=orig.veiculo_modelo,
            veiculo_ano=orig.veiculo_ano,
            veiculo_versao=orig.veiculo_versao,
            veiculo_placa=orig.veiculo_placa,
            enquadramento_snapshot=orig.enquadramento_snapshot,
            status="rascunho",
            validade=date.today() + timedelta(days=15),
            criado_por_id=user_id,
            observacoes=orig.observacoes,
        )
        # Clonar áreas
        area_map = {}
        for area in orig.areas.all():
            nova_area = AreaImpacto.objects.create(
                orcamento=nova, titulo=area.titulo, ordem=area.ordem,
            )
            area_map[str(area.id)] = nova_area
        # Recalcular intervenções
        for iv in orig.intervencoes.all():
            OrcamentoService.adicionar_intervencao(
                orcamento_id=str(nova.id),
                area_impacto_id=str(area_map[str(iv.area_impacto_id)].id),
                peca_canonica_id=str(iv.peca_canonica_id),
                acao=iv.acao,
                qualificador_peca=iv.qualificador_peca,
                fornecimento=iv.fornecimento,
                quantidade=iv.quantidade,
                user_id=user_id,
                codigo_peca=iv.codigo_peca,
                descricao=iv.descricao_visivel,
            )
        for it in orig.itens_adicionais.all():
            OrcamentoService.adicionar_item_adicional(
                orcamento_id=str(nova.id),
                service_catalog_id=str(it.service_catalog_id),
                quantidade=it.quantidade,
                fornecimento=it.fornecimento,
                user_id=user_id,
                descricao=it.descricao_visivel,
            )
        return nova
```

#### 3.2 `ApontamentoService`

```python
# apps/service_orders/services/apontamento.py

class ApontamentoService:
    @staticmethod
    @transaction.atomic
    def iniciar(
        os_item_id: str,
        tipo: Literal["intervencao", "item_adicional"],
        tecnico_id: str,
        categoria_mao_obra_codigo: str,
        user_id: str,
    ) -> ApontamentoHoras:
        """Inicia apontamento em intervenção ou item adicional."""
        if tipo == "intervencao":
            item = OSIntervencao.objects.get(id=os_item_id)
            kwargs = {"intervencao": item}
        else:
            item = OSItemAdicional.objects.get(id=os_item_id)
            kwargs = {"item_adicional": item}

        if item.status_execucao == "concluida":
            raise ValueError("Item concluído — não aceita apontamento.")

        if item.status_execucao == "pendente":
            item.status_execucao = "em_execucao"
            item.save(update_fields=["status_execucao"])

        return ApontamentoHoras.objects.create(
            service_order=item.service_order,
            tecnico_id=tecnico_id,
            categoria_mao_obra_codigo=categoria_mao_obra_codigo,
            horas=Decimal("0"),
            iniciado_em=timezone.now(),
            criado_por_id=user_id,
            **kwargs,
        )

    @staticmethod
    def encerrar(
        apontamento_id: str,
        horas_manual: Decimal | None = None,
        observacao: str = "",
    ) -> ApontamentoHoras:
        ap = ApontamentoHoras.objects.get(id=apontamento_id)
        ap.encerrado_em = timezone.now()
        if horas_manual is not None:
            ap.horas = horas_manual
        else:
            delta = ap.encerrado_em - ap.iniciado_em
            ap.horas = Decimal(delta.total_seconds() / 3600).quantize(Decimal("0.01"))
        ap.observacao = observacao
        ap.save(update_fields=["encerrado_em", "horas", "observacao"])
        return ap

    @staticmethod
    def concluir_item(os_item_id: str, tipo: str, user_id: str) -> OSIntervencao | OSItemAdicional:
        """Finaliza execução, força encerramento de apontamentos abertos,
        seta status Cilia = EXECUTADO."""
        model = OSIntervencao if tipo == "intervencao" else OSItemAdicional
        item = model.objects.get(id=os_item_id)
        for ap in item.apontamentos.filter(encerrado_em__isnull=True):
            ApontamentoService.encerrar(ap.id, observacao="auto-encerrado na conclusão")
        item.status_execucao = "concluida"
        item.status = StatusItem.EXECUTADO
        item.save(update_fields=["status_execucao", "status"])
        return item
```

#### 3.3 `PickingService`

Reaproveita MO-5 integralmente. Única mudança: match da OS considera
`OSIntervencao.peca_canonica_id` em vez da linha antiga.

```python
# apps/service_orders/services/picking.py

class PickingService:
    @staticmethod
    @transaction.atomic
    def bipar(codigo_barras: str, ordem_servico_id: str, user_id: str) -> dict:
        """Identifica o que foi bipado e executa a ação certa.

        - UnidadeFisica reservada para a OS → status=consumed.
        - UnidadeFisica available → reserva (conveniência) + log.
        - LoteInsumo → NÃO consome automaticamente (quantidade precisa ser explícita).
        """
        uni = UnidadeFisica.objects.filter(codigo_barras=codigo_barras).first()
        if uni:
            if uni.status == "reserved" and str(uni.ordem_servico_id) == ordem_servico_id:
                uni.status = "consumed"
                uni.consumida_em = timezone.now()
                uni.save(update_fields=["status", "consumida_em"])
                return {"tipo": "peca_consumida", "unidade_id": str(uni.id)}
            if uni.status == "reserved":
                raise ValueError(
                    f"Peça reservada para OS-{uni.ordem_servico_id} — bipe a correta."
                )
            if uni.status == "available":
                uni.status = "reserved"
                uni.ordem_servico_id = ordem_servico_id
                uni.save(update_fields=["status", "ordem_servico"])
                return {"tipo": "peca_reservada", "unidade_id": str(uni.id)}
            raise ValueError(f"Peça em status {uni.status} — fluxo ambíguo.")

        lote = LoteInsumo.objects.filter(codigo_barras=codigo_barras).first()
        if lote:
            return {
                "tipo": "lote_identificado",
                "lote_id": str(lote.id),
                "material": lote.material_canonico.nome,
                "saldo": str(lote.saldo),
                "mensagem": "Informe quantidade para baixa.",
            }

        raise ValueError(f"Código {codigo_barras} não encontrado.")
```

---

### 4. Endpoints

```
# Orçamento — header
GET    /api/v1/quotes/orcamentos/                               (CONSULTANT+)
POST   /api/v1/quotes/orcamentos/                               cria vazio com área "Geral"
GET    /api/v1/quotes/orcamentos/{id}/
PATCH  /api/v1/quotes/orcamentos/{id}/                          edita header em rascunho
POST   /api/v1/quotes/orcamentos/{id}/enviar/                   status → enviado
POST   /api/v1/quotes/orcamentos/{id}/aprovar/                  body: {intervencoes_ids?, itens_adicionais_ids?, areas_negadas?}
POST   /api/v1/quotes/orcamentos/{id}/recusar/                  status → recusado
POST   /api/v1/quotes/orcamentos/{id}/nova-versao/              clona + incrementa
GET    /api/v1/quotes/orcamentos/{id}/pdf/                      binary

# Orçamento — áreas
POST   /api/v1/quotes/orcamentos/{id}/areas/                    body: {titulo}
PATCH  /api/v1/quotes/areas/{id}/                               renomear, reordenar, mudar status
DELETE /api/v1/quotes/areas/{id}/                               bloqueado se tem intervenções

# Orçamento — intervenções (Peça × Ação)
GET    /api/v1/quotes/orcamentos/{id}/intervencoes/
POST   /api/v1/quotes/orcamentos/{id}/intervencoes/             body: {area_id, peca_canonica_id, acao, ...}
PATCH  /api/v1/quotes/intervencoes/{id}/                        editar qty, qualificador, descrição
DELETE /api/v1/quotes/intervencoes/{id}/                        só em rascunho

# Orçamento — itens adicionais (sem peça)
GET    /api/v1/quotes/orcamentos/{id}/itens-adicionais/
POST   /api/v1/quotes/orcamentos/{id}/itens-adicionais/         body: {service_catalog_id, quantidade}
PATCH  /api/v1/quotes/itens-adicionais/{id}/
DELETE /api/v1/quotes/itens-adicionais/{id}/

# OS — intervenções e itens do motor
GET    /api/v1/service-orders/{id}/intervencoes/
POST   /api/v1/service-orders/{id}/intervencoes/                adicionar intervenção avulsa (pós-aprovação)
PATCH  /api/v1/service-orders/intervencoes/{id}/                editar qty, descrição
POST   /api/v1/service-orders/intervencoes/{id}/concluir/

GET    /api/v1/service-orders/{id}/itens-adicionais/
POST   /api/v1/service-orders/{id}/itens-adicionais/
PATCH  /api/v1/service-orders/itens-adicionais/{id}/
POST   /api/v1/service-orders/itens-adicionais/{id}/concluir/

# Picking
POST   /api/v1/service-orders/{id}/picking/bipar/               body: {codigo_barras}
POST   /api/v1/service-orders/{id}/picking/baixar-insumo/       body: {material_id, quantidade_base}

# Apontamento
POST   /api/v1/service-orders/{id}/apontamentos/iniciar/        body: {os_item_id, tipo: "intervencao"|"item_adicional", tecnico_id, categoria_codigo}
POST   /api/v1/apontamentos/{id}/encerrar/                      body: {horas?, observacao?}
GET    /api/v1/service-orders/{id}/apontamentos/
```

**RBAC:**
- Criar orçamento, adicionar intervenção/item, editar áreas, aprovar total: `IsConsultantOrAbove`.
- Aprovação parcial (com `intervencoes_ids` ou `areas_negadas`): `IsManagerOrAbove` (exige observação).
- Apontamento iniciar/encerrar: `IsConsultantOrAbove`.
- Conclusão manual de item: `IsManagerOrAbove`.
- Visualizar decomposição de custo (`valor_peca`, `valor_mao_obra`, `valor_insumos`): `IsManagerOrAbove`.

---

### 5. Frontend

#### Página: `/orcamentos`

Lista de orçamentos com filtros (status, cliente, data, seguradora, sinistro).
KPIs: rascunho, enviados, aprovados hoje, expirando em 3 dias.

#### Página: `/orcamentos/novo`

Wizard inspirado em `CreateOSDialog`:

```
Step 1 — Cliente (busca UnifiedCustomer, inline create permitido)
Step 2 — Veículo (autocomplete FIPE marca/modelo/ano/versão + placa)
Step 3 — Responsabilidade
         [ Cliente ]  [ Seguradora ]  [ RCF ]
         Se seguradora/RCF: select de insurer + campo sinistro_numero
         Se sinistro: prompt para renomear "Geral" e criar demais áreas
Step 4 — Itens (tabs)
         Tab "Intervenções": agrupadas por Área → botão [+] por área
                 Dialog: [Peça canônica autocomplete] × [Ação select] + qualificadores
                 Preview do preço vindo do motor
         Tab "Adicionais": lista plana
                 Dialog: [ServiceCatalog autocomplete] + qty
Step 5 — Revisão (totais, validade, botão "Salvar como rascunho" | "Enviar")
```

Toda intervenção / item adicional mostra **preço preview** vindo do motor.
Decomposição (`valor_peca`, `valor_mao_obra`, `valor_insumos`) só para MANAGER+
em drawer recolhido.

#### Página: `/orcamentos/[id]`

- Header: número + versão + status + cliente + veículo + sinistro_numero.
- Bloco "Áreas de Impacto": cada área é um card accordion com suas intervenções,
  status da área, botão "Marcar como negada" (MANAGER+).
- Bloco "Itens Adicionais": lista plana fora das áreas.
- Tabela por área: checkbox por intervenção (para aprovação parcial).
- Botões: Enviar, Aprovar tudo, Aprovar selecionadas, Recusar, Nova versão, PDF.
- Drawer "Decomposição" por item (RBAC).

Ao clicar **Aprovar tudo** ou **Aprovar selecionadas** → redireciona para
a OS recém-criada `/os/{number}`.

#### Página: `/os/[id]` (existente — extensão)

Nova tab **"Itens do motor"**:
- Accordion por `OSAreaImpacto` → tabela de `OSIntervencao` com status_execucao.
- Bloco separado de `OSItemAdicional` (sem área).
- Botão "Iniciar apontamento" por item → modal seleciona técnico + categoria.
- Botão "Concluir item" com confirmação → seta status Cilia = EXECUTADO.
- Widget lateral "Peças reservadas" listando `UnidadeFisica` com status.

Tab **"Apontamentos"**:
- Timeline por técnico · horas · categoria · item (intervenção ou adicional).
- Export CSV para folha (MO-3 adapter mais tarde consome isso).

Tab **"Picking"**:
- Input de bipagem (reusa `BipagemInput` do MO-5).
- Lista das últimas 20 leituras com resultado (peça consumida, lote identificado, etc.).

#### Componente: `IntervencaoCard`

Renderiza cada intervenção como card expansível:

```
┌─────────────────────────────────────────────────────────┐
│ Porta Dianteira Esquerda          PPO · Oficina · ORÇADO│
│ [T 1.0h] [P 6.0h]                        R$ 2.450,00 ⚠  │
│ Código: 51755142 (diferente)                            │
└─────────────────────────────────────────────────────────┘
```

Ícone ⚠ aparece quando qualquer flag (abaixo_padrao, acima_padrao,
codigo_diferente) está ativa. Tooltip explica qual.

#### Componente: `ItemAdicionalCard`

Renderização simples, sem ações múltiplas (só tem 1 ação implícita = o próprio serviço).

---

### 6. PDF do orçamento

Usar **ReportLab** (já instalado nos contracheques do HR) ou gerar HTML via
template Django e converter com **WeasyPrint**.

Estrutura (espelhando layout Cilia — ver [`docs/cilia-vocabulary.md`](./cilia-vocabulary.md) §8 "Totalizadores da impressão"):

```
Cabeçalho:       logo empresa · CNPJ · dados contato · número orçamento + versão
Dados do sinistro: seguradora · número sinistro · tipo_responsabilidade
Cliente + Veículo: nome · placa · FIPE · enquadramento
Blocos de intervenções por Área de Impacto:
  ┌─ Área: Lateral Esquerda ─────────────────────────────┐
  │ Peça                  Ação  Qual  Forn  Hrs   Valor │
  │ Porta DE              T+P   PPO   OF    7.0   2.450 │
  │ Retrovisor ext DE     T     PPO   OF    0.5     680 │
  └──────────────────────────────────────────── Subt: 3.130│
Bloco Serviços Adicionais (sem área):
  Alinhamento 3D         1x   R$ 180,00
  Higienização AC        1x   R$ 120,00
Rodapé: subtotal · desconto · total · validade · assinatura
Legal:  este orçamento não exibe decomposição de custo
```

**Nunca exibir decomposição de custo no PDF** — apenas preços finais por item (P9).

---

## Testes

### Backend (pytest) — mínimo 55 testes

```
tests/quotes/
├── test_orcamento_criacao.py
│   ├── test_cria_vazio_com_area_geral
│   ├── test_numero_sequencial_por_empresa
│   ├── test_cliente_obrigatorio
│   ├── test_enquadramento_congelado_no_header
│   └── test_sinistro_numero_opcional_se_nao_seguradora
├── test_area_impacto.py
│   ├── test_cria_area_adicional
│   ├── test_nao_deleta_area_com_intervencoes
│   ├── test_titulo_unico_por_orcamento
│   └── test_negar_area_marca_intervencoes_sem_cobertura
├── test_intervencao.py
│   ├── test_adicionar_calcula_snapshot
│   ├── test_acao_sem_mapeamento_raise
│   ├── test_ficha_resolvida_por_contexto
│   ├── test_multiplicador_tamanho_respeitado
│   ├── test_unique_orcamento_area_peca_acao
│   ├── test_duas_acoes_mesma_peca_ok (TROCAR + PINTAR)
│   └── test_qualificador_vazio_para_acao_sem_peca
├── test_item_adicional.py
│   ├── test_adicionar_do_catalog
│   ├── test_nao_aplica_multiplicador_tamanho
│   └── test_snapshot_gerado
├── test_orcamento_aprovacao.py
│   ├── test_aprovacao_total_gera_os_com_areas
│   ├── test_aprovacao_parcial_por_intervencao
│   ├── test_aprovacao_parcial_por_itens_adicionais
│   ├── test_aprovar_com_area_negada
│   ├── test_intervencoes_area_negada_ficam_sem_cobertura
│   ├── test_aprovacao_reserva_unidades_apenas_trocar_oficina
│   ├── test_reserva_falha_nao_bloqueia_os
│   ├── test_orcamento_expirado_nao_aprovavel
│   ├── test_reaprovar_raise
│   └── test_fornecimento_cliente_nao_reserva
├── test_nova_versao.py
│   ├── test_incrementa_versao
│   ├── test_mantem_numero_base
│   ├── test_recalcula_snapshots_com_custos_correntes
│   └── test_clona_areas_e_intervencoes

tests/service_orders/
├── test_os_intervencao.py
│   ├── test_snapshot_fk_protect
│   ├── test_delete_os_mantem_snapshot
│   ├── test_status_cilia_aprovado_na_criacao
│   └── test_concluir_seta_executado
├── test_apontamento.py
│   ├── test_iniciar_em_intervencao
│   ├── test_iniciar_em_item_adicional
│   ├── test_xor_intervencao_xor_item_adicional
│   ├── test_encerrar_calcula_horas_do_delta
│   ├── test_encerrar_com_horas_manual_override
│   ├── test_concluir_fecha_apontamentos_abertos
│   └── test_tecnico_multi_apontamento_mesmo_item
├── test_picking.py
│   ├── test_bipar_unidade_reservada_consome
│   ├── test_bipar_unidade_available_reserva
│   ├── test_bipar_unidade_de_outra_os_raise
│   ├── test_bipar_lote_retorna_metadata
│   └── test_bipar_codigo_inexistente_raise
└── test_pdf.py
    ├── test_pdf_nao_expoe_custo
    ├── test_pdf_agrupa_por_area
    ├── test_pdf_bloco_separado_adicionais
    └── test_pdf_flags_renderizadas
```

### Playwright (cenário ponta a ponta)

```
e2e/quote-to-os.spec.ts
  Admin abre /orcamentos/novo
  ├── Busca cliente "Maria Silva"
  ├── Preenche veículo VW Gol 2018 1.0 MPI
  ├── Responsabilidade "Seguradora" + escolhe Porto Seguro + sinistro
  ├── Renomeia área "Geral" → "Lateral Esquerda"
  ├── Cria área adicional "Traseira"
  ├── Adiciona intervenção (Porta DE, TROCAR, PPO, OFICINA) na Lateral Esquerda
  ├── Adiciona intervenção (Porta DE, PINTAR) na Lateral Esquerda
  ├── Adiciona intervenção (Para-choque traseiro, REPARAR) na Traseira
  ├── Adiciona item adicional "Alinhamento 3D"
  ├── Confere preços calculados + totais por área
  ├── Salva como rascunho
  ├── Abre orçamento → status rascunho
  ├── Clica "Enviar" → status enviado
  ├── Marca área "Traseira" como negada (MANAGER role)
  ├── Clica "Aprovar selecionadas" → redireciona para /os/{number}
  ├── Verifica intervenções da Lateral Esquerda + item adicional na tab motor
  ├── Verifica peça Porta DE reservada no widget lateral (só TROCAR gera reserva)
  ├── Inicia apontamento na intervenção "Pintar Porta DE"
  ├── Encerra apontamento manual com 3.5 horas
  └── Conclui intervenção → status Cilia = EXECUTADO
```

---

## Critérios de aceite

- [ ] Criar orçamento vazio com área "Geral" em < 300ms.
- [ ] Adicionar 10 intervenções + 3 itens adicionais em < 2s total.
- [ ] Todos os preços de orçamento vêm de `CalculoCustoSnapshot` (jamais ad-hoc).
- [ ] Mesma peça aceita múltiplas ações (TROCAR + PINTAR) sem violar constraint.
- [ ] Aprovação total gera OS com mesmas intervenções e itens (quantidade e snapshots).
- [ ] Aprovação parcial cria OS só com itens selecionados.
- [ ] Marcar área como negada → intervenções da área ficam SEM_COBERTURA automaticamente.
- [ ] Recusa de orçamento marca status sem gerar OS.
- [ ] Bipagem de peça reservada com match de OS transita para `consumed`.
- [ ] Apontamento soma corretamente horas (delta iniciado→encerrado ou manual).
- [ ] Apontamento funciona tanto em Intervenção quanto em Item Adicional.
- [ ] Concluir item seta status Cilia = EXECUTADO.
- [ ] PDF de orçamento gera com layout legível, agrupado por área, sem dados de custo.
- [ ] PDF renderizado em < 3s para orçamento com até 20 itens.
- [ ] Flags (abaixo_padrao, código_diferente) renderizam ícone no card e no PDF.

---

## Armadilhas específicas

### P1 — `snapshot` FK PROTECT, não CASCADE (A4)
Se o orçamento for deletado (não deveria — mas), o snapshot precisa permanecer
para histórico. Sempre PROTECT em todas as FKs de snapshot (`OrcamentoIntervencao`,
`OrcamentoItemAdicional`, `OSIntervencao`, `OSItemAdicional`). Granularidade:
**um snapshot por par (peça × ação)** — não por peça.

### P2 — Enquadramento congelado no header do orçamento
`enquadramento_snapshot` é JSON copiado na criação. Se o cliente/seguradora
mudar a segmentação depois, o orçamento antigo **não muda**. Reprodutibilidade
da proposta é sagrada.

### P3 — Aprovação parcial não pode recalcular preço
Se o cliente aprova 5 de 8 intervenções, a OS usa **os snapshots originais**
dessas 5, sem recálculo. Preços já foram combinados. Recalcular seria surpresa.

### P4 — Nova versão do orçamento gera novos snapshots
Clonar orçamento (pedido de ajuste) roda o motor de novo para cada intervenção
e item adicional — custos podem ter mudado. Frontend mostra divergência v1 vs v2.

### P5 — `customer_uuid` vs `customer` na OS
`ServiceOrder` existente usa `customer_uuid` (UUIDField sem FK por razão
cross-schema). `Orcamento` usa `customer` (FK direto dentro do tenant).
Converter corretamente na aprovação:
```python
os_.customer_id   = orc.customer_id
os_.customer_uuid = orc.customer_id
os_.customer_name = orc.customer.name
```

### P6 — `ReservaIndisponivel` na aprovação = warn, não erro
Se não há peças suficientes no momento da aprovação, **não bloquear**. A OS é
criada mesmo assim — loja compra e bipa depois. Frontend destaca com ícone
amarelo. Reserva só ocorre para intervenções com `acao=TROCAR` e
`fornecimento=OFICINA` — REPARAR/PINTAR não consomem peça nova; CLIENTE/SEGURADORA
trazem a peça.

### P7 — Apontamento de horas vs snapshot de ficha
A ficha prevê 3h de pintor. Técnico gasta 3.5h. **Não recalcula preço** —
preço já foi congelado. A diferença vira **análise de variância** (MO-9 feedback).

### P8 — Picking de peça de OUTRA OS
`UnidadeFisica` reservada para OS-XXX não pode ser consumida em OS-YYY. Erro
claro "peça reservada para OS-XXX — bipe a correta." Não deixar silencioso.

### P9 — PDF não expõe custo
Revisar template: nem `custo_total_base`, nem `margem_*`, nem `valor_peca /
valor_mao_obra / valor_insumos` decompostos aparecem no PDF. Só `descricao_visivel`,
`quantidade`, `preco_total`, `horas_mao_obra` (visível a seguradora — é consenso
de mercado) e somatórios.

### P10 — Conversão orçamento → OS é transacional
```python
# ERRADO — cria OS, depois tenta copiar itens, depois reserva peças
os_ = ServiceOrder.objects.create(...)  # commit imediato
# erro aqui deixa OS órfã

# CORRETO — transaction.atomic() cobre tudo: áreas, intervenções, itens, reservas
@transaction.atomic
def aprovar(...):
    os_ = ServiceOrder.objects.create(...)
    for area in orc.areas.all(): ...
    for iv in intervencoes_aprovadas: ...
    for uni in unidades_reservadas: uni.save(...)
```

### P11 — Número de orçamento por empresa (A8)
`numero` é sequencial **por empresa** (`NumberingService.next("orcamento",
empresa.id)`). Nunca global — empresas diferentes podem repetir ORC-2026-000001.

### P12 — Unique constraint (orçamento, área, peça, ação)
Evita duplicar intervenção idêntica dentro da mesma área. Se a peça aparece
duas vezes (ex: dois retrovisores, DE e DD), cada uma é peça canônica
distinta no catálogo — `PecaCanonica.codigo` diferente.

### P13 — Ação sem mapeamento → MapeamentoAcaoAusente
Adicionar ação nova ao enum `Acao` sem atualizar `MAPEAMENTO_ACAO_SERVICO`
quebra a criação de intervenção. Teste dedicado garante cobertura do mapa.

### P14 — XOR em `ApontamentoHoras` (intervencao vs item_adicional)
Constraint de banco bloqueia registro com as duas FKs nulas ou as duas
preenchidas. Serializer valida antes para retornar 400 amigável em vez de
IntegrityError 500.

### P15 — Área "Geral" não pode ser deletada enquanto houver intervenção
Mesmo que o consultor renomeie, não permitir delete se tem intervenção.
Reenquadrar intervenção para outra área é sempre uma edição, nunca delete.

### P16 — Item adicional NÃO pertence a área
Não forçar `area_impacto_id` em `OrcamentoItemAdicional`. Alinhamento não é da
"Lateral Esquerda" — é do veículo todo. PDF renderiza em bloco separado.

---

## Handoff para MO-8 (Benchmark + IA)

Entregar:

1. Orçamentos gerados no modelo Cilia-aligned — base de treino de benchmark e IA.
2. `OrcamentoIntervencao` e `OrcamentoItemAdicional` têm `snapshot_id` com contexto
   + preço — pronto para análise retrospectiva (MO-9).
3. Endpoint de leitura `GET /quotes/orcamentos/stats/` (quantidade por mês, taxa
   aprovação, % sem cobertura por área) — base para dashboard MO-9.
4. Fixture `tests/fixtures/orcamentos_historicos.json` — 20 orçamentos amostrais
   (15 seguradora + 5 particular) para teste de benchmark e IA em MO-8.
5. **Nota crítica ao autor do MO-8:** modelo de linha alinhado ao Cilia. Parser
   de PDF mapeia 1:1 (T→TROCAR, R→REPARAR, P→PINTAR, R&I→REMOCAO_INSTALACAO;
   PPO/PRO/PR/PREC direto; áreas por grupo visual do PDF). Sem tradução lossy.

---

## Checklist pós-sprint

- [ ] `make migrate` aplicou 3 migrations (quotes_initial, service_orders_motor_v2, apontamento).
- [ ] `make test-backend` verde — 55+ testes.
- [ ] Playwright e2e quote-to-os passando (com áreas negadas e aprovação parcial).
- [ ] PDF renderiza com logo DS Car, agrupamento por área, sem custo.
- [ ] Sidebar web: item "Orçamentos" (ícone FileText) adicionado.
- [ ] CLAUDE.md atualizado com seção "Módulo Orçamento/OS Motor" referenciando ADR-001.
- [ ] `docs/mo-contrato-orcamento-os.md` escrito (contrato para MO-8).
- [ ] `MAPEAMENTO_ACAO_SERVICO` documentado em `apps/pricing_catalog/constants.py`.
- [ ] Seeds de `ServicoCanonico` revisados (4 serviços mapeados pelas ações).
- [ ] `make sprint-close SPRINT=MO-07` executado.
- [ ] Rito retrospectiva: comparar tempo de orçamento (antes vs pós motor) + satisfação do consultor com o agrupamento por área.
