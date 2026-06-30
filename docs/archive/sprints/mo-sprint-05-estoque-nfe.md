# MO-Sprint 05 — Estoque Físico + NFe Entrada + Etiquetagem

**Duração:** 2 semanas | **Equipe:** Solo + Claude Code | **Prioridade:** P0
**Pré-requisitos:** MO-2 (catálogo canônico) · **Desbloqueia:** MO-6, MO-7

---

## Objetivo

Substituir o estoque genérico por um estoque **por unidade física** para peças
(cada peça tem identidade própria com NF-e, número de série e valor de
aquisição) e **por lote** para insumos (material fungível com FIFO).

Integrar o módulo fiscal: ao dar entrada de uma NFe, o sistema cria
automaticamente `UnidadeFisica` (peças) e `LoteInsumo` (materiais),
armazena `valor_nf` e `valor_unitario_base` (com tributação embutida) e
imprime etiquetas ZPL com código de barras.

Expor services de **custo base**:
- `CustoPecaService.custo_base(peca_canonica_id)` → `max(valor_nf)` das unidades disponíveis, incluindo reservadas.
- `CustoInsumoService.custo_base(material_canonico_id)` → `max(valor_unitario_base)` dos lotes com saldo positivo.

Esses services alimentam o motor de precificação (MO-6).

---

## Referências obrigatórias

1. `docs/mo-roadmap.md` — **armadilhas A2 (max incluindo reserva), A5 (unidade_base vs unidade_compra), A6 (escape hatch reserva forçada)**.
2. Spec v3.0 — §10 (estoque), §11 (NFe entrada), §12 (etiquetagem), §13 (custo base).
3. `apps.fiscal` — parsing nfelib existente; não reescrever.
4. `apps.inventory` — estrutura genérica atual; será **extendida**, não substituída.
5. CLAUDE.md — "Estoque — nunca negativo" (constraint + `select_for_update`).

---

## Escopo

### 1. Extensão de `apps.inventory`

Novos models dentro do app existente para **não duplicar** a infra de
movimentação já disponível (`StockMovement`, `StockLocation`).

#### Models novos

```python
# apps/inventory/models_physical.py

class UnidadeFisica(PaddockBaseModel):
    """Uma peça fisicamente identificável — um item único no estoque.
    Se chegaram 10 para-choques na NFe, criamos 10 UnidadeFisica."""

    STATUS = [
        ("available", "Disponível"),
        ("reserved",  "Reservada para OS"),
        ("consumed",  "Consumida em OS"),
        ("returned",  "Devolvida ao fornecedor"),
        ("lost",      "Perdida/Avariada"),
    ]

    peca_canonica = models.ForeignKey(
        "pricing_catalog.PecaCanonica",
        on_delete=models.PROTECT,
        related_name="unidades",
    )
    codigo_fornecedor = models.ForeignKey(
        "pricing_catalog.CodigoFornecedorPeca",
        null=True, blank=True,
        on_delete=models.PROTECT,
        help_text="Variante específica do fornecedor (se aplicável).",
    )
    nfe_entrada = models.ForeignKey(
        "fiscal.NFeEntrada",
        null=True, blank=True,
        on_delete=models.PROTECT,
        related_name="unidades_fisicas",
    )
    numero_serie = models.CharField(max_length=80, blank=True)
    codigo_barras = models.CharField(max_length=40, unique=True)
    # Formato: "P-{peca_id}-{sequencial}" — gerado no save()

    valor_nf = models.DecimalField(
        max_digits=12, decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
        help_text="Valor unitário na NFe COM tributação embutida.",
    )
    # CRÍTICO: valor_nf inclui ICMS/IPI/PIS/COFINS aplicáveis.
    # Quem calcula é apps.fiscal.tributacao_service (sprint já entregue).

    localizacao = models.ForeignKey(
        "inventory.StockLocation",
        null=True, blank=True,
        on_delete=models.SET_NULL,
    )
    ordem_servico = models.ForeignKey(
        "service_orders.ServiceOrder",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="unidades_fisicas",
        help_text="Preenchido quando status=reserved/consumed.",
    )
    status = models.CharField(max_length=20, choices=STATUS, default="available")

    criada_em = models.DateTimeField(auto_now_add=True)
    consumida_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["peca_canonica", "status"]),
            models.Index(fields=["codigo_barras"]),
            models.Index(fields=["ordem_servico", "status"]),
        ]


class LoteInsumo(PaddockBaseModel):
    """Compra fungível de um insumo — ex: galão de 5L de tinta, caixa de
    100 parafusos. Baixas vão consumindo `saldo` via FIFO."""

    material_canonico = models.ForeignKey(
        "pricing_catalog.MaterialCanonico",
        on_delete=models.PROTECT,
        related_name="lotes",
    )
    nfe_entrada = models.ForeignKey(
        "fiscal.NFeEntrada",
        null=True, blank=True,
        on_delete=models.PROTECT,
        related_name="lotes_insumo",
    )
    codigo_barras = models.CharField(max_length=40, unique=True)
    # Formato: "L-{material_id}-{sequencial}"

    unidade_compra = models.CharField(max_length=20)
    # Como veio na NF: "GL", "CX-100", "L", "KG"
    quantidade_compra = models.DecimalField(max_digits=10, decimal_places=3)
    # Quantidade na unidade_compra: 5 (galões), 1 (caixa), 20 (litros)
    fator_conversao = models.DecimalField(
        max_digits=10, decimal_places=4,
        help_text="Quantos unidade_base cabem em 1 unidade_compra. "
                  "Ex: galão de 5L → fator=5 se unidade_base=L.",
    )

    quantidade_base = models.DecimalField(
        max_digits=10, decimal_places=3,
        help_text="Saldo inicial em unidade_base = quantidade_compra × fator_conversao.",
    )
    saldo = models.DecimalField(
        max_digits=10, decimal_places=3,
        help_text="Saldo restante em unidade_base.",
    )

    valor_total_nf = models.DecimalField(max_digits=12, decimal_places=2)
    # Valor total do item na NFe COM tributação embutida.

    valor_unitario_base = models.DecimalField(max_digits=12, decimal_places=4)
    # valor_total_nf / quantidade_base — custo unitário em unidade_base.
    # Calculado no save(); é esse valor que vai para o motor de preços.

    validade = models.DateField(null=True, blank=True)
    localizacao = models.ForeignKey(
        "inventory.StockLocation",
        null=True, blank=True, on_delete=models.SET_NULL,
    )

    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(check=Q(saldo__gte=0), name="lote_saldo_nao_negativo"),
            models.CheckConstraint(check=Q(saldo__lte=F("quantidade_base")), name="lote_saldo_menor_que_inicial"),
        ]
        indexes = [
            models.Index(fields=["material_canonico", "saldo"]),
            models.Index(fields=["codigo_barras"]),
            models.Index(fields=["criado_em"]),  # FIFO
        ]


class ConsumoInsumo(PaddockBaseModel):
    """Registro de baixa de um insumo em uma OS. FIFO por criado_em."""

    lote = models.ForeignKey(LoteInsumo, on_delete=models.PROTECT, related_name="consumos")
    ordem_servico = models.ForeignKey(
        "service_orders.ServiceOrder",
        on_delete=models.PROTECT,
        related_name="consumos_insumo",
    )
    quantidade_base = models.DecimalField(max_digits=10, decimal_places=3)
    valor_unitario_na_baixa = models.DecimalField(max_digits=12, decimal_places=4)
    # Snapshot: captura lote.valor_unitario_base no momento.

    criado_em = models.DateTimeField(auto_now_add=True)
    criado_por = models.ForeignKey(
        "authentication.GlobalUser",
        null=True, on_delete=models.SET_NULL,
    )

    class Meta:
        indexes = [
            models.Index(fields=["ordem_servico", "criado_em"]),
        ]
```

#### Extensão de `apps.fiscal.NFeEntrada`

Garantir que ao finalizar o parsing da NFe, o pipeline crie `UnidadeFisica`
ou `LoteInsumo` para cada item conforme a classificação do produto.

```python
# apps/fiscal/services/ingestao.py  (extensão)

class NFeIngestaoService:
    @staticmethod
    def criar_registros_estoque(nfe: NFeEntrada) -> dict:
        """Pós-parsing: cria UnidadeFisica/LoteInsumo por item.

        Requer que cada NFeItem tenha:
        - peca_canonica_id (se for peça), OU
        - material_canonico_id (se for insumo), OU
        - status='sem_match' (requer reconciliação manual)
        """
        unidades = []
        lotes = []
        pendentes = []

        with transaction.atomic():
            for item in nfe.itens.all():
                if item.peca_canonica_id:
                    for _ in range(int(item.quantidade)):
                        u = UnidadeFisica.objects.create(
                            peca_canonica_id=item.peca_canonica_id,
                            codigo_fornecedor_id=item.codigo_fornecedor_id,
                            nfe_entrada=nfe,
                            valor_nf=item.valor_unitario_com_tributos,
                            status="available",
                        )
                        unidades.append(u)
                elif item.material_canonico_id:
                    l = LoteInsumo.objects.create(
                        material_canonico_id=item.material_canonico_id,
                        nfe_entrada=nfe,
                        unidade_compra=item.unidade_compra,
                        quantidade_compra=item.quantidade,
                        fator_conversao=item.fator_conversao,
                        quantidade_base=item.quantidade * item.fator_conversao,
                        saldo=item.quantidade * item.fator_conversao,
                        valor_total_nf=item.valor_total_com_tributos,
                        valor_unitario_base=(
                            item.valor_total_com_tributos /
                            (item.quantidade * item.fator_conversao)
                        ),
                    )
                    lotes.append(l)
                else:
                    pendentes.append(item.id)

        return {
            "unidades_criadas": len(unidades),
            "lotes_criados": len(lotes),
            "pendentes_reconciliacao": pendentes,
        }
```

Hook em signal (`post_save` de `NFeEntrada` com `status='validada'`) ou chamada explícita no viewset de validação.

---

### 2. Services de custo base

```python
# apps/pricing_engine/services/custo_base.py
from decimal import Decimal
from django.db.models import Max, F, Sum

class CustoBaseIndisponivel(Exception):
    pass


class CustoPecaService:
    @staticmethod
    def custo_base(peca_canonica_id: int) -> Decimal:
        """Maior valor_nf entre unidades disponíveis OU reservadas.

        ARMADILHA A2: incluir reserved é intencional — garante que se todas as
        unidades baratas já foram reservadas, o preço da próxima OS reflita o
        custo real de reposição.
        """
        agg = UnidadeFisica.objects.filter(
            peca_canonica_id=peca_canonica_id,
            status__in=["available", "reserved"],
        ).aggregate(maior=Max("valor_nf"))

        if agg["maior"] is None:
            raise CustoBaseIndisponivel(
                f"Peça {peca_canonica_id} sem unidades disponíveis ou reservadas."
            )
        return agg["maior"]

    @staticmethod
    def unidades_disponiveis(peca_canonica_id: int) -> int:
        return UnidadeFisica.objects.filter(
            peca_canonica_id=peca_canonica_id,
            status="available",
        ).count()


class CustoInsumoService:
    @staticmethod
    def custo_base(material_canonico_id: int) -> Decimal:
        """Maior valor_unitario_base entre lotes com saldo > 0."""
        agg = LoteInsumo.objects.filter(
            material_canonico_id=material_canonico_id,
            saldo__gt=0,
        ).aggregate(maior=Max("valor_unitario_base"))

        if agg["maior"] is None:
            raise CustoBaseIndisponivel(
                f"Material {material_canonico_id} sem lotes com saldo."
            )
        return agg["maior"]

    @staticmethod
    def saldo_disponivel(material_canonico_id: int) -> Decimal:
        agg = LoteInsumo.objects.filter(
            material_canonico_id=material_canonico_id,
            saldo__gt=0,
        ).aggregate(total=Sum("saldo"))
        return agg["total"] or Decimal("0")
```

---

### 3. Services de reserva e baixa

```python
# apps/inventory/services/reserva.py

class ReservaIndisponivel(Exception):
    pass


class ReservaUnidadeService:
    @staticmethod
    def reservar(
        peca_canonica_id: int,
        quantidade: int,
        ordem_servico_id: str,
        forcar_mais_caro: bool = False,
    ) -> list[UnidadeFisica]:
        """Reserva N unidades de uma peça canônica.

        Por padrão: ordena por valor_nf ASC (consome as mais baratas primeiro).
        forcar_mais_caro=True → DESC (quando há diferença crítica entre lotes).

        ARMADILHA A6: flag `forcar_mais_caro` é o escape hatch para
        situações raras onde a unidade cara deve sair antes (ex: validade
        vencendo, ou unidade que já estava no chão de oficina).
        """
        ordem = "-valor_nf" if forcar_mais_caro else "valor_nf"
        with transaction.atomic():
            disponiveis = (
                UnidadeFisica.objects
                .select_for_update(skip_locked=True)
                .filter(peca_canonica_id=peca_canonica_id, status="available")
                .order_by(ordem)[:quantidade]
            )
            lista = list(disponiveis)
            if len(lista) < quantidade:
                raise ReservaIndisponivel(
                    f"Pedidas {quantidade}, disponíveis {len(lista)}."
                )
            for u in lista:
                u.status = "reserved"
                u.ordem_servico_id = ordem_servico_id
                u.save(update_fields=["status", "ordem_servico"])
            return lista


class BaixaInsumoService:
    @staticmethod
    def baixar(
        material_canonico_id: int,
        quantidade_base: Decimal,
        ordem_servico_id: str,
        user_id: str | None = None,
    ) -> list[ConsumoInsumo]:
        """FIFO: consome lotes por criado_em ASC até zerar quantidade_base.

        Retorna lista de ConsumoInsumo criados.
        """
        restante = quantidade_base
        consumos = []

        with transaction.atomic():
            lotes = (
                LoteInsumo.objects
                .select_for_update(skip_locked=True)
                .filter(material_canonico_id=material_canonico_id, saldo__gt=0)
                .order_by("criado_em")
            )
            for lote in lotes:
                if restante <= 0:
                    break
                consome = min(lote.saldo, restante)
                c = ConsumoInsumo.objects.create(
                    lote=lote,
                    ordem_servico_id=ordem_servico_id,
                    quantidade_base=consome,
                    valor_unitario_na_baixa=lote.valor_unitario_base,
                    criado_por_id=user_id,
                )
                lote.saldo -= consome
                lote.save(update_fields=["saldo"])
                consumos.append(c)
                restante -= consome

            if restante > 0:
                raise ReservaIndisponivel(
                    f"Material {material_canonico_id}: pedido {quantidade_base}, "
                    f"insuficiente em {restante}."
                )

        return consumos
```

---

### 4. Etiquetagem ZPL

#### Model

```python
# apps/inventory/models_label.py

class ImpressoraEtiqueta(PaddockBaseModel):
    nome = models.CharField(max_length=50)
    modelo = models.CharField(max_length=50)  # Zebra GK420t, Argox OS-214, Elgin L42
    endpoint = models.CharField(max_length=200)
    # Ex: "http://10.0.0.15:9100" (Zebra direct print), ou nome de fila CUPS
    largura_mm = models.PositiveIntegerField(default=50)
    altura_mm = models.PositiveIntegerField(default=30)
    is_active = models.BooleanField(default=True)


class EtiquetaImpressa(PaddockBaseModel):
    unidade_fisica = models.ForeignKey(
        UnidadeFisica, null=True, blank=True,
        on_delete=models.CASCADE,
    )
    lote_insumo = models.ForeignKey(
        LoteInsumo, null=True, blank=True,
        on_delete=models.CASCADE,
    )
    impressora = models.ForeignKey(ImpressoraEtiqueta, on_delete=models.PROTECT)
    zpl_payload = models.TextField()
    impressa_em = models.DateTimeField(auto_now_add=True)
    impressa_por = models.ForeignKey(
        "authentication.GlobalUser", null=True, on_delete=models.SET_NULL,
    )

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=(Q(unidade_fisica__isnull=False) ^ Q(lote_insumo__isnull=False)),
                name="etiqueta_xor_unidade_lote",
            )
        ]
```

#### Service de geração ZPL

```python
# apps/inventory/services/etiqueta.py

ZPL_TEMPLATE_PECA = """^XA
^FO20,20^A0N,24,24^FD{nome_peca}^FS
^FO20,60^A0N,20,20^FDCod: {codigo_barras}^FS
^FO20,90^BY2^BCN,60,Y,N,N^FD{codigo_barras}^FS
^FO20,170^A0N,18,18^FDNF {nfe_numero} · R$ {valor_nf}^FS
^XZ"""

ZPL_TEMPLATE_LOTE = """^XA
^FO20,20^A0N,24,24^FD{nome_material}^FS
^FO20,60^A0N,20,20^FDLote: {codigo_barras}^FS
^FO20,90^BY2^BCN,60,Y,N,N^FD{codigo_barras}^FS
^FO20,170^A0N,18,18^FD{quantidade_compra} {unidade_compra} · Val {validade}^FS
^XZ"""


class ZPLService:
    @staticmethod
    def gerar_zpl_peca(unidade: UnidadeFisica) -> str:
        return ZPL_TEMPLATE_PECA.format(
            nome_peca=unidade.peca_canonica.nome[:40],
            codigo_barras=unidade.codigo_barras,
            nfe_numero=unidade.nfe_entrada.numero if unidade.nfe_entrada else "—",
            valor_nf=f"{unidade.valor_nf:.2f}",
        )

    @staticmethod
    def gerar_zpl_lote(lote: LoteInsumo) -> str:
        return ZPL_TEMPLATE_LOTE.format(
            nome_material=lote.material_canonico.nome[:40],
            codigo_barras=lote.codigo_barras,
            quantidade_compra=lote.quantidade_compra,
            unidade_compra=lote.unidade_compra,
            validade=(lote.validade.strftime("%d/%m/%Y") if lote.validade else "—"),
        )

    @staticmethod
    def imprimir(zpl: str, impressora: ImpressoraEtiqueta) -> None:
        """HTTP POST direto (Zebra default) ou TCP raw 9100."""
        import httpx
        with httpx.Client(timeout=5) as client:
            resp = client.post(impressora.endpoint, content=zpl.encode("utf-8"))
            resp.raise_for_status()
```

#### Task de impressão automática

```python
# apps/inventory/tasks.py

@shared_task
def task_imprimir_etiquetas_nfe(nfe_id: int, tenant_schema: str) -> dict:
    """Gera e imprime etiquetas para todas as unidades/lotes criadas pela NFe."""
    with schema_context(tenant_schema):
        nfe = NFeEntrada.objects.get(id=nfe_id)
        impressora = ImpressoraEtiqueta.objects.filter(is_active=True).first()
        if not impressora:
            logger.warning(f"Sem impressora ativa para NFe {nfe_id}")
            return {"impressas": 0, "motivo": "sem_impressora"}

        count = 0
        for u in nfe.unidades_fisicas.all():
            zpl = ZPLService.gerar_zpl_peca(u)
            ZPLService.imprimir(zpl, impressora)
            EtiquetaImpressa.objects.create(
                unidade_fisica=u, impressora=impressora, zpl_payload=zpl,
            )
            count += 1
        for l in nfe.lotes_insumo.all():
            zpl = ZPLService.gerar_zpl_lote(l)
            ZPLService.imprimir(zpl, impressora)
            EtiquetaImpressa.objects.create(
                lote_insumo=l, impressora=impressora, zpl_payload=zpl,
            )
            count += 1
        return {"impressas": count}
```

---

### 5. Endpoints

```
# Unidades físicas
GET    /api/v1/inventory/unidades/?peca={id}&status=available     (CONSULTANT+)
GET    /api/v1/inventory/unidades/{id}/
POST   /api/v1/inventory/unidades/{id}/reservar/                  body: {ordem_servico_id, forcar_mais_caro?}
POST   /api/v1/inventory/unidades/{id}/baixar/                    (MANAGER+ — uso manual)
POST   /api/v1/inventory/unidades/bipagem/                        body: {codigo_barras, ordem_servico_id}

# Lotes insumo
GET    /api/v1/inventory/lotes/?material={id}&saldo_gt=0          (CONSULTANT+)
GET    /api/v1/inventory/lotes/{id}/
POST   /api/v1/inventory/baixar-insumo/                           body: {material_canonico_id, quantidade_base, ordem_servico_id}

# Custo base (debug / admin)
GET    /api/v1/pricing/debug/custo-peca/?peca_id={id}             (MANAGER+)
GET    /api/v1/pricing/debug/custo-insumo/?material_id={id}       (MANAGER+)

# Etiquetagem
GET    /api/v1/inventory/impressoras/                             (MANAGER+)
POST   /api/v1/inventory/unidades/{id}/imprimir-etiqueta/         (STOREKEEPER+)
POST   /api/v1/inventory/lotes/{id}/imprimir-etiqueta/            (STOREKEEPER+)
POST   /api/v1/inventory/nfe/{id}/imprimir-etiquetas/             (MANAGER+)
```

**RBAC:**
- List/get de unidades/lotes: `IsConsultantOrAbove`.
- Reserva/baixa: `IsConsultantOrAbove` (operação do dia-a-dia).
- Config de impressora + impressão em massa: `IsManagerOrAbove`.
- `forcar_mais_caro=True`: apenas `IsAdminOrAbove` (auditoria).

---

### 6. Frontend

#### Página: `/estoque/unidades`

Lista de unidades físicas com:
- Filtros: peça canônica (autocomplete), status, NFe, localização.
- Colunas: Código barras · Peça · Valor NF · Status · OS vinculada · Localização.
- Ação "Reimprimir etiqueta" em cada linha.
- Tab superior alterna entre **Unidades (peças)** e **Lotes (insumos)**.

#### Página: `/estoque/lotes`

Lista de lotes de insumo com:
- Filtros: material canônico, saldo > 0, validade próxima (30d).
- Colunas: Código · Material · Saldo · Unidade base · Valor unit base · Validade.
- Destaque visual: saldo < 10% do quantidade_base (amarelo), = 0 (cinza).

#### Página: `/estoque/bipagem`

Interface de picking para OS:
- Campo grande de input com foco automático + scanner USB (HID keyboard).
- Ao bipar: resolve `codigo_barras` → busca `UnidadeFisica` ou `LoteInsumo`.
- Se OS selecionada: move unidade para `reserved` ou cria `ConsumoInsumo` parcial.
- Mostra histórico das últimas 20 bipagens na sessão.

#### Página: `/estoque/nfe-recebida`

Lista de NFe de entrada com:
- Status do pipeline: parseada · reconciliada · etiquetas impressas.
- Ação "Reimprimir etiquetas" (reenvia para impressora ativa).
- Drill-down: expande para ver unidades/lotes criados.

#### Página: `/configuracoes/impressoras`

CRUD de `ImpressoraEtiqueta`:
- Campos: nome, modelo (select com opções Zebra/Argox/Elgin/Outro), endpoint, largura, altura.
- Botão "Testar impressão" → envia ZPL de teste com código fixo.

#### Componentes compartilhados

```
src/features/estoque/
├── BipagemInput.tsx           # input com foco, onKeyDown=Enter
├── UnidadeStatusBadge.tsx     # available=verde, reserved=âmbar, consumed=cinza
├── LoteSaldoBar.tsx           # barra de progresso saldo/quantidade_base
└── EtiquetaPreview.tsx        # mostra ZPL como imagem (via labelary.com API opcional)
```

---

### 7. Admin Django

Registrar:
- `UnidadeFisica` — list_filter por status, search por código_barras.
- `LoteInsumo` — list_filter por material_canonico, search por código_barras.
- `ConsumoInsumo` — read-only (auditoria).
- `ImpressoraEtiqueta` — editável.
- `EtiquetaImpressa` — read-only.

---

## Testes

### Backend (pytest + factory-boy)

```
tests/inventory/
├── test_unidade_fisica.py
│   ├── test_criacao_por_nfe_gera_n_unidades
│   ├── test_codigo_barras_unico_auto
│   ├── test_reserva_ordena_por_valor_asc_default
│   ├── test_reserva_com_forcar_mais_caro_ordena_desc
│   ├── test_reserva_quantidade_insuficiente_raises
│   └── test_reserva_concorrente_skip_locked
├── test_lote_insumo.py
│   ├── test_saldo_nao_pode_ficar_negativo_constraint
│   ├── test_valor_unitario_base_calculado_no_save
│   ├── test_baixa_fifo_ordem_criacao
│   ├── test_baixa_atravessa_multiplos_lotes
│   └── test_baixa_quantidade_insuficiente_raises
├── test_custo_base.py
│   ├── test_custo_peca_retorna_max_valor_nf
│   ├── test_custo_peca_inclui_reservadas     # ARMADILHA A2
│   ├── test_custo_peca_sem_unidades_raises
│   ├── test_custo_insumo_retorna_max_valor_unit_base
│   └── test_custo_insumo_ignora_saldo_zero
├── test_etiqueta_zpl.py
│   ├── test_zpl_peca_contem_codigo_barras
│   ├── test_zpl_lote_contem_validade_formatada
│   └── test_xor_constraint_unidade_vs_lote
└── test_nfe_ingestao.py
    ├── test_nfe_validada_cria_unidades_para_pecas
    ├── test_nfe_validada_cria_lotes_para_insumos
    ├── test_item_sem_match_vai_para_pendentes
    └── test_valor_nf_inclui_tributacao
```

### Frontend (Vitest)

```
src/features/estoque/__tests__/
├── BipagemInput.test.tsx         # dispara onScan ao pressionar Enter
├── LoteSaldoBar.test.tsx         # cor muda em < 10%
└── useReservarUnidade.test.ts    # mutation + toast
```

### Playwright (happy path)

```
e2e/inventory-flow.spec.ts
  ├── Gestor importa NFe de teste (arquivo fixture)
  ├── Aguarda pipeline parsing
  ├── Verifica N unidades criadas
  ├── Imprime etiquetas (mock de impressora)
  ├── Bipagem: usa input para reservar unidade em OS
  └── Verifica status='reserved' + OS com unidade vinculada
```

---

## Critérios de aceite

- [ ] NFe de teste (fixture com 10 peças + 3 materiais) gera 10 `UnidadeFisica` + 3 `LoteInsumo` corretamente.
- [ ] `LoteInsumo.saldo` nunca fica negativo (constraint de DB bloqueia).
- [ ] `CustoPecaService.custo_base()` retorna o maior valor_nf, **incluindo reservadas** (teste explícito A2).
- [ ] Baixa FIFO de insumo atravessa corretamente múltiplos lotes.
- [ ] Código de barras único gerado no `save()` de `UnidadeFisica` e `LoteInsumo`.
- [ ] ZPL gerado imprime código Code128 válido (teste com labelary.com opcional).
- [ ] Bipagem resolve código de barras em < 200ms.
- [ ] RBAC: operador STOREKEEPER pode bipar e reservar, mas não ver `valor_nf` (campo omitido no serializer para roles abaixo de MANAGER).
- [ ] `forcar_mais_caro=True` só aceito em requests de ADMIN+ (log de auditoria obrigatório).

---

## Armadilhas específicas desta sprint

### P1 — `valor_nf` tem que vir COM tributação
O valor unitário na NF crua (`<vUnCom>`) NÃO inclui ICMS/IPI que serão
creditados. O motor de preços precisa do **custo efetivo de aquisição**.
O pipeline de `apps.fiscal.tributacao_service` já calcula isso; sempre
use `item.valor_unitario_com_tributos`, nunca o valor bruto do XML.

### P2 — `unidade_compra` ≠ `unidade_base`
```python
# ERRADO — confunde galão (compra) com litro (uso)
ConsumoInsumo.objects.create(quantidade_base=1, ...)  # 1 galão? 1 litro?

# CORRETO — sempre em unidade_base; motor de ficha só opera em unidade_base
# Conversão ocorre UMA VEZ no LoteInsumo.save() via fator_conversao.
```

### P3 — `max(valor_nf)` incluindo reservadas — ARMADILHA A2
Tentação de filtrar `status='available'` quando calcular custo base.
**ERRADO**: se todas as unidades baratas já estão reservadas, a próxima
OS precisaria cotar ao preço de reposição — que é o maior valor_nf das
unidades que sobraram. Incluir `reserved` no filtro força exatamente isso.

### P4 — Código de barras determinístico, não sequencial global
```python
# codigo_barras gerado no save(): "P-{peca_canonica_id}-{pk_sequencial}"
# Por quê: se trocar instância do banco (dump/restore em outro tenant),
# sequencial global quebra. Sequencial por peça é estável.

def save(self, *args, **kwargs):
    if not self.codigo_barras:
        super().save(*args, **kwargs)  # gera pk
        self.codigo_barras = f"P-{self.peca_canonica_id}-{self.pk}"
        UnidadeFisica.objects.filter(pk=self.pk).update(
            codigo_barras=self.codigo_barras
        )
    else:
        super().save(*args, **kwargs)
```

### P5 — `select_for_update(skip_locked=True)` em reserva concorrente
Dois operadores bipando a mesma peça simultaneamente: o segundo deve
pegar a próxima unidade, não falhar ou duplicar. `skip_locked=True`
garante isso. Sem ele, race condition vira deadlock.

### P6 — Impressão assíncrona OBRIGATÓRIA
`ZPLService.imprimir()` faz HTTP POST síncrono. Se impressora offline,
endpoint cliente congela 5s (timeout). Sempre encadeie via Celery
`task_imprimir_etiquetas_nfe.delay()` — nunca direto no viewset.

### P7 — `forcar_mais_caro` é log-mandatory
Toda chamada com `forcar_mais_caro=True` deve gravar em audit log com
`user_id`, `ordem_servico_id` e `justificativa` (campo obrigatório no
request body). Sem log, é vetor de fraude.

### P8 — `ConsumoInsumo.valor_unitario_na_baixa` é snapshot
Quando baixo 0.2L de um lote hoje, gravo `valor_unitario_base` atual.
Se amanhã um novo lote chegar mais caro, o consumo histórico **não
muda**. Isso vale para relatórios de CMV e para o snapshot do motor
(MO-6). Nunca faça `lote.valor_unitario_base` em relatório retroativo.

### P9 — `ImpressoraEtiqueta.endpoint` pode ser interno
Se a impressora está na LAN da oficina (`http://10.0.0.15:9100`) e o
Django está em Coolify, o container precisa acessar a rede local.
Dois caminhos: (a) impressão via worker local dedicado; (b) usar
tunnel. Documentar no README da stack.

### P10 — NFe duplicada
Mesma chave NFe ingressada 2x duplica estoque. Antes de rodar
`criar_registros_estoque`, checar se `NFeEntrada.chave_acesso` já
gerou unidades/lotes. Idempotência via flag `estoque_gerado=True`
no model `NFeEntrada`.

---

## Handoff para MO-6 (Motor de Precificação)

Entregar:

1. `CustoPecaService.custo_base(peca_id) → Decimal` **estável**, com teste A2.
2. `CustoInsumoService.custo_base(material_id) → Decimal` **estável**.
3. Query de decomposição para debug:
   ```python
   # GET /api/v1/pricing/debug/custo-peca/?peca_id=123
   # Response:
   {
     "peca_id": 123,
     "nome": "Parachoque Dianteiro VW Gol",
     "custo_base": "450.00",
     "unidades_contagem": {"available": 2, "reserved": 1},
     "detalhe_unidades": [
       {"id": "...", "valor_nf": "420.00", "status": "available", "nfe": "..."},
       {"id": "...", "valor_nf": "450.00", "status": "available", "nfe": "..."},
       {"id": "...", "valor_nf": "430.00", "status": "reserved", "os": "OS-2456"}
     ]
   }
   ```
4. Lista de NFe de teste reutilizável em `tests/fixtures/nfes/*.xml` para sprints futuras.
5. Contrato documentado em `docs/mo-contrato-custo-base.md`:
   - Service sempre retorna Decimal ou raise `CustoBaseIndisponivel`.
   - Nunca retorna 0 ou None silencioso.
   - `custo_base` é **por tenant** — multi-schema respeitado automaticamente.

---

## Checklist pós-sprint

- [ ] `make migrate` aplicou 2 migrations novas (inventory_physical, inventory_label).
- [ ] `make test-backend` verde, 25+ testes novos.
- [ ] Fixture de NFe de teste commitada em `backend/core/tests/fixtures/nfes/`.
- [ ] Impressora Zebra (ou labelary.com mock) configurada em dev.
- [ ] `make sprint-close SPRINT=MO-05` executado.
- [ ] CLAUDE.md atualizado: seção "Sprints Entregues" com MO-5.
- [ ] `docs/mo-contrato-custo-base.md` escrito.
- [ ] Rito de retrospectiva: registrar tempo gasto por task (baseline para MO-6).
