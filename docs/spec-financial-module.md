# SPEC — Módulo Financeiro / Contábil
# ERP DS Car · Paddock Solutions
# ─────────────────────────────────────────────────────────────────────────────
# Data: Abril 2026
# Autor: Thiago Campos (PO) + Claude (Engenheiro Sênior)
# ─────────────────────────────────────────────────────────────────────────────

## 1. Objetivo

Implementar o módulo financeiro/contábil completo do ERP DS Car, cobrindo:
plano de contas, lançamentos contábeis (partidas dobradas), contas a pagar (AP),
contas a receber (AR), contas bancárias, conciliação OFX, projeção de fluxo de
caixa rolling e relatórios gerenciais (DRE, Balanço, DFC).

O módulo segue os padrões **NBC TG 1000** (PMEs), compatibilidade com **SPED ECD**
e opera inteiramente dentro do schema do tenant (isolamento multitenancy).

---

## 2. Situação Atual do Codebase

### ✅ Já existe (não reimplementar)

| Arquivo | O que tem |
|---------|-----------|
| `apps/fiscal/models.py` | `FiscalDocument` (NF-e, NFC-e, NFS-e) — model OK, sem lógica |
| `apps/service_orders/models.py` | `parts_total`, `services_total`, `discount_total`, `nfe_key`, `invoice_issued` |
| `apps/service_orders/models.py` | `ServiceOrderPart` e `ServiceOrderLabor` com `unit_price`, `discount`, `total` |
| `apps/store/models.py` | `Sale` com `PaymentMethod`, `CartItem` com `discount_pct` |
| `apps/inventory/models.py` | `InventoryItem.cost_price`, `sale_price`; `StockMovement.unit_cost` |
| `apps/hr/models.py` | `base_salary`, `Bonus`, `Allowance`, `Payslip` com valores |
| `apps/cilia/models.py` | `OrcamentoCilia.total_liquid`, `total_pieces`, `total_workforce`, `franchise` |
| `packages/utils/src/formatters.ts` | `formatCurrency()` — BRL via `Intl.NumberFormat` |
| `.env` | `ASAAS_API_KEY`, `ASAAS_ENV`, `FOCUSNFE_TOKEN` configurados |

### ❌ Não existe (implementar neste módulo)

- App `accounting` — plano de contas, centros de custo, lançamentos, períodos fiscais
- App `accounts_payable` — AP, pagamentos, aprovação
- App `accounts_receivable` — AR, recebimentos, integração Asaas
- App `banking` — contas bancárias, transações OFX, conciliação
- Dependências: `asaas`, `ofxparse`, `reportlab`, `openpyxl` (não instaladas)
- Frontend: nenhuma página financeira em `apps/dscar-web`

---

## 3. Arquitetura do Módulo

### 3.1 Estrutura de Apps Django

```
backend/core/apps/
├── accounting/          ← Plano de Contas, Lançamentos, Períodos Fiscais, C. Custo
├── accounts_payable/    ← Contas a Pagar (AP)
├── accounts_receivable/ ← Contas a Receber (AR) + Asaas
├── banking/             ← Contas Bancárias + OFX + Conciliação
└── reports/             ← DRE, Balanço, DFC, PDF/XLSX
```

Todos os apps em `TENANT_APPS` — dados isolados por schema.

### 3.2 Dependências a Instalar

```txt
# backend/core/requirements/base.txt (adicionar)
ofxparse==0.21          # Importação OFX bancário
ofxtools==0.9.4         # OFX leitura/escrita completo
reportlab==4.2.2        # Geração PDF relatórios
openpyxl==3.1.2         # Exportação XLSX
httpx==0.27.0           # Chamadas API Asaas (já pode existir)
```

### 3.3 Princípios de Implementação

1. **Nunca `FloatField` para valores** — sempre `DecimalField(max_digits=18, decimal_places=2)`
2. **Lançamentos imutáveis** após aprovação — correção via estorno
3. **Bloqueio de período** — `FiscalPeriod.can_post()` verificado em todo `save()`
4. **Rastreabilidade total** — todo lançamento automático tem `content_type` + `object_id`
5. **Multitenancy** — todos os models em `TENANT_APPS`, nunca no schema público
6. **DRE baseada em lançamentos** — não em títulos AP/AR (competência)
7. **Fluxo de caixa baseado em AP/AR** — datas de vencimento/pagamento (caixa)

---

## 4. Modelos de Dados

### 4.1 App: `accounting`

```python
# ── Plano de Contas ──────────────────────────────────────────────────────────

class AccountType(TextChoices):
    ASSET     = 'A', 'Ativo'
    LIABILITY = 'L', 'Passivo'
    EQUITY    = 'E', 'Patrimônio Líquido'
    REVENUE   = 'R', 'Receita'
    COST      = 'C', 'Custo'
    EXPENSE   = 'X', 'Despesa'
    OTHER     = 'O', 'Outras'

class NatureType(TextChoices):
    DEBIT  = 'D', 'Devedora'   # Ativo, Custos, Despesas
    CREDIT = 'C', 'Credora'    # Passivo, PL, Receitas

class ChartOfAccount(PaddockBaseModel):
    """
    Plano de Contas — compatível com SPED ECD e NBC TG 1000.
    Máscara: 1.1.01.001.0001 (5 níveis).
    """
    code         = CharField(max_length=30, unique=True)  # ex: "4.1.02.001"
    name         = CharField(max_length=200)
    parent       = ForeignKey('self', null=True, blank=True, on_delete=PROTECT)
    account_type = CharField(max_length=1, choices=AccountType.choices)
    nature       = CharField(max_length=1, choices=NatureType.choices)
    is_analytical       = BooleanField(default=False)     # aceita lançamentos diretos
    level               = PositiveSmallIntegerField()     # 1 a 5
    sped_code           = CharField(max_length=30, blank=True)  # referencial SPED
    accepts_cost_center = BooleanField(default=False)
    is_active           = BooleanField(default=True)

    # Impede lançamento em conta sintética (validado no serializer)
    # code__startswith usado para saldo consolidado de subárvore


# ── Centro de Custo ──────────────────────────────────────────────────────────

class CostCenter(PaddockBaseModel):
    """
    Centros de custo por unidade de negócio.
    Pré-configurados: CC-OS, CC-PECAS, CC-VIDROS, CC-ESTETICA, CC-ADM
    """
    code   = CharField(max_length=20, unique=True)
    name   = CharField(max_length=200)
    parent = ForeignKey('self', null=True, blank=True, on_delete=PROTECT)
    is_active = BooleanField(default=True)

    # Mapeamento para ServiceOrder.os_type (opcional)
    os_type_code = CharField(max_length=20, blank=True)


# ── Período Fiscal ───────────────────────────────────────────────────────────

class FiscalYear(PaddockBaseModel):
    year       = PositiveSmallIntegerField(unique=True)
    start_date = DateField()
    end_date   = DateField()
    is_closed  = BooleanField(default=False)
    closed_at  = DateTimeField(null=True, blank=True)
    closed_by  = ForeignKey(GlobalUser, null=True, blank=True, on_delete=SET_NULL)


class FiscalPeriod(PaddockBaseModel):
    """Período contábil mensal."""
    fiscal_year  = ForeignKey(FiscalYear, on_delete=PROTECT, related_name='periods')
    number       = PositiveSmallIntegerField()  # 1-12
    start_date   = DateField()
    end_date     = DateField()
    is_closed    = BooleanField(default=False)
    is_adjustment = BooleanField(default=False)  # 13º período (acertos anuais)

    class Meta:
        unique_together = [['fiscal_year', 'number']]

    def can_post(self) -> bool:
        return not self.is_closed and not self.fiscal_year.is_closed


# ── Lançamentos Contábeis (Partidas Dobradas) ─────────────────────────────────

class JournalEntryOrigin(TextChoices):
    MANUAL      = 'MAN',   'Manual'
    SERVICE_ORDER = 'OS',  'Ordem de Serviço'
    NFE         = 'NFE',   'NF-e Emitida'
    NFCE        = 'NFCE',  'NFC-e Emitida'
    NFSE        = 'NFSE',  'NFS-e Emitida'
    NFE_ENTRADA = 'NFE_E', 'NF-e Entrada (Compra)'
    BANK_PAYMENT = 'PAG',  'Pagamento Bancário'
    BANK_RECEIPT = 'REC',  'Recebimento Bancário'
    ASAAS       = 'ASAAS', 'Asaas (Cobrança)'
    OFX_IMPORT  = 'OFX',   'Importação OFX'
    PAYROLL     = 'FOLHA', 'Folha de Pagamento'
    DEPRECIATION = 'DEP',  'Depreciação'
    CLOSING     = 'ENC',   'Encerramento de Período'
    INVENTORY   = 'EST',   'Ajuste de Estoque'


class JournalEntry(PaddockBaseModel):
    """
    Lançamento contábil — partidas dobradas.
    Imutável após aprovação. Correção via reversal_entry.
    """
    number          = CharField(max_length=20, unique=True)   # JE000001
    description     = CharField(max_length=500)
    competence_date = DateField()
    document_date   = DateField(null=True, blank=True)
    origin          = CharField(max_length=10, choices=JournalEntryOrigin.choices)
    # Rastreabilidade (GenericForeignKey)
    content_type    = ForeignKey(ContentType, null=True, blank=True, on_delete=SET_NULL)
    object_id       = PositiveIntegerField(null=True, blank=True)
    # Estado
    is_approved   = BooleanField(default=False)
    is_reversed   = BooleanField(default=False)
    reversal_entry = OneToOneField('self', null=True, blank=True,
                                   on_delete=SET_NULL, related_name='reversed_by')
    fiscal_period  = ForeignKey(FiscalPeriod, on_delete=PROTECT)
    created_by     = ForeignKey(GlobalUser, on_delete=PROTECT, related_name='journal_entries')
    approved_by    = ForeignKey(GlobalUser, null=True, blank=True,
                                on_delete=PROTECT, related_name='approved_entries')

    # Validação: sum(debit_amount) == sum(credit_amount) via JournalEntryService


class JournalEntryLine(models.Model):
    """Linha de lançamento (partida simples). Sem PaddockBaseModel (sem soft delete)."""
    entry        = ForeignKey(JournalEntry, on_delete=CASCADE, related_name='lines')
    account      = ForeignKey(ChartOfAccount, on_delete=PROTECT,
                              limit_choices_to={'is_analytical': True})
    cost_center  = ForeignKey(CostCenter, null=True, blank=True, on_delete=SET_NULL)
    debit_amount  = DecimalField(max_digits=18, decimal_places=2, default=0)
    credit_amount = DecimalField(max_digits=18, decimal_places=2, default=0)
    description   = CharField(max_length=300, blank=True)
    document_number = CharField(max_length=100, blank=True)

    # Validação: apenas debit OU credit > 0, nunca ambos; conta deve ser analítica


# ── Numeração Sequencial ──────────────────────────────────────────────────────

class NumberSequence(models.Model):
    """Controle de sequências numéricas por tenant."""
    key         = CharField(max_length=20, unique=True)  # 'JE', 'AP', 'AR', ...
    last_number = PositiveIntegerField(default=0)
    # select_for_update() no serviço — thread-safe
```

---

### 4.2 App: `accounts_payable`

```python
class PayableStatus(TextChoices):
    DRAFT     = 'DFT', 'Rascunho'
    PENDING   = 'PND', 'Pendente'
    APPROVED  = 'APR', 'Aprovado'
    SCHEDULED = 'SCH', 'Agendado'
    PARTIAL   = 'PAR', 'Pago Parcialmente'
    PAID      = 'PAD', 'Pago'
    OVERDUE   = 'OVR', 'Vencido'
    CANCELLED = 'CAN', 'Cancelado'


class AccountsPayable(PaddockBaseModel):
    """Título a pagar."""
    number          = CharField(max_length=30, unique=True)  # AP000001
    # supplier → FK para Supplier (criar se não existir, ou usar Customer com is_supplier=True)
    description     = CharField(max_length=300)
    # Valores
    gross_amount    = DecimalField(max_digits=18, decimal_places=2)
    discount_amount = DecimalField(max_digits=18, decimal_places=2, default=0)
    interest_amount = DecimalField(max_digits=18, decimal_places=2, default=0)
    fine_amount     = DecimalField(max_digits=18, decimal_places=2, default=0)
    net_amount      = DecimalField(max_digits=18, decimal_places=2)  # calculado no save()
    paid_amount     = DecimalField(max_digits=18, decimal_places=2, default=0)
    # Datas
    issue_date      = DateField()
    due_date        = DateField(db_index=True)
    payment_date    = DateField(null=True, blank=True)
    competence_date = DateField()
    # Classificação contábil
    cost_center     = ForeignKey(CostCenter, null=True, blank=True, on_delete=SET_NULL)
    expense_account = ForeignKey(ChartOfAccount, on_delete=PROTECT, related_name='payables')
    # Documento de origem
    nfe_key         = CharField(max_length=44, blank=True)
    invoice_number  = CharField(max_length=50, blank=True)
    # Estado
    status          = CharField(max_length=3, choices=PayableStatus.choices, default='PND')
    bank_account    = ForeignKey('banking.BankAccount', null=True, blank=True, on_delete=SET_NULL)
    # Aprovação
    requires_approval = BooleanField(default=False)
    approved_by     = ForeignKey(GlobalUser, null=True, blank=True, on_delete=SET_NULL,
                                  related_name='approved_payables')
    approved_at     = DateTimeField(null=True, blank=True)
    # Lançamento contábil gerado
    journal_entry   = ForeignKey('accounting.JournalEntry', null=True, blank=True,
                                  on_delete=SET_NULL)
    created_by      = ForeignKey(GlobalUser, on_delete=PROTECT)

    class Meta:
        indexes = [
            Index(fields=['due_date', 'status']),
            Index(fields=['competence_date']),
        ]


class PayablePayment(models.Model):
    """Registro de cada pagamento (parcial ou total) de um título AP."""
    payable         = ForeignKey(AccountsPayable, on_delete=CASCADE, related_name='payments')
    payment_date    = DateField()
    amount          = DecimalField(max_digits=18, decimal_places=2)
    discount        = DecimalField(max_digits=18, decimal_places=2, default=0)
    interest        = DecimalField(max_digits=18, decimal_places=2, default=0)
    bank_account    = ForeignKey('banking.BankAccount', on_delete=PROTECT)
    payment_method  = CharField(max_length=20, choices=[
        ('PIX', 'Pix'), ('TED', 'TED'), ('DOC', 'DOC'),
        ('BOLETO', 'Boleto'), ('DINHEIRO', 'Dinheiro'), ('CARTAO', 'Cartão'),
    ])
    bank_transaction_id = CharField(max_length=100, blank=True)  # ID OFX/API
    journal_entry   = ForeignKey('accounting.JournalEntry', null=True, blank=True,
                                  on_delete=SET_NULL)
    reconciled      = BooleanField(default=False)
    notes           = TextField(blank=True)
    created_by      = ForeignKey(GlobalUser, on_delete=PROTECT)
    created_at      = DateTimeField(auto_now_add=True)


class ApprovalRule(PaddockBaseModel):
    """Regra de aprovação por faixa de valor."""
    name        = CharField(max_length=100)
    min_amount  = DecimalField(max_digits=18, decimal_places=2)
    max_amount  = DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    approver    = ForeignKey(GlobalUser, on_delete=PROTECT)
    cost_center = ForeignKey(CostCenter, null=True, blank=True, on_delete=SET_NULL)
    is_active   = BooleanField(default=True)
```

---

### 4.3 App: `accounts_receivable`

```python
class ReceivableStatus(TextChoices):
    DRAFT          = 'DFT', 'Rascunho'
    PENDING        = 'PND', 'Pendente'
    PARTIALLY_PAID = 'PAR', 'Recebido Parcialmente'
    PAID           = 'PAD', 'Recebido'
    OVERDUE        = 'OVR', 'Inadimplente'
    CANCELLED      = 'CAN', 'Cancelado'
    NEGOTIATING    = 'NEG', 'Em Negociação'


class AccountsReceivable(PaddockBaseModel):
    """Título a receber."""
    number          = CharField(max_length=30, unique=True)  # AR000001
    # Ref ao customer (UnifiedCustomer do schema público via customer_id UUID)
    customer_name   = CharField(max_length=300)   # desnormalizado — LGPD
    customer_id     = UUIDField(null=True, blank=True)
    description     = CharField(max_length=300)
    # Origem
    service_order   = ForeignKey('service_orders.ServiceOrder',
                                  null=True, blank=True, on_delete=SET_NULL)
    nfe_key         = CharField(max_length=44, blank=True)
    nfse_number     = CharField(max_length=50, blank=True)
    # Valores
    gross_amount    = DecimalField(max_digits=18, decimal_places=2)
    discount_amount = DecimalField(max_digits=18, decimal_places=2, default=0)
    interest_amount = DecimalField(max_digits=18, decimal_places=2, default=0)
    fine_amount     = DecimalField(max_digits=18, decimal_places=2, default=0)
    net_amount      = DecimalField(max_digits=18, decimal_places=2)
    received_amount = DecimalField(max_digits=18, decimal_places=2, default=0)
    # Datas
    issue_date      = DateField()
    due_date        = DateField(db_index=True)
    received_date   = DateField(null=True, blank=True)
    competence_date = DateField()
    # Classificação
    revenue_account = ForeignKey('accounting.ChartOfAccount', on_delete=PROTECT,
                                  related_name='receivables')
    cost_center     = ForeignKey('accounting.CostCenter', null=True, blank=True,
                                  on_delete=SET_NULL)
    # Integração Asaas
    asaas_payment_id   = CharField(max_length=100, blank=True, db_index=True)
    asaas_invoice_url  = URLField(blank=True)
    asaas_pix_qr_code  = TextField(blank=True)
    asaas_billing_type = CharField(max_length=20, blank=True, choices=[
        ('BOLETO', 'Boleto'), ('PIX', 'Pix'),
        ('CREDIT_CARD', 'Cartão de Crédito'), ('DEBIT_CARD', 'Cartão de Débito'),
        ('TRANSFER', 'Transferência'), ('DEPOSIT', 'Depósito'),
    ])
    # Estado
    status          = CharField(max_length=3, choices=ReceivableStatus.choices, default='PND')
    days_overdue    = PositiveIntegerField(default=0)
    last_contact_date = DateField(null=True, blank=True)
    # Lançamento contábil
    journal_entry   = ForeignKey('accounting.JournalEntry', null=True, blank=True,
                                  on_delete=SET_NULL)

    class Meta:
        indexes = [
            Index(fields=['due_date', 'status']),
            Index(fields=['asaas_payment_id']),
        ]


class ReceivableReceipt(models.Model):
    """Registro de cada recebimento (parcial ou total)."""
    receivable      = ForeignKey(AccountsReceivable, on_delete=CASCADE, related_name='receipts')
    payment_date    = DateField()
    amount          = DecimalField(max_digits=18, decimal_places=2)
    discount        = DecimalField(max_digits=18, decimal_places=2, default=0)
    interest        = DecimalField(max_digits=18, decimal_places=2, default=0)
    asaas_fee       = DecimalField(max_digits=18, decimal_places=2, default=0)
    bank_account    = ForeignKey('banking.BankAccount', on_delete=PROTECT)
    payment_method  = CharField(max_length=20)
    asaas_event_id  = CharField(max_length=100, blank=True)  # ID do webhook
    journal_entry   = ForeignKey('accounting.JournalEntry', null=True, blank=True,
                                  on_delete=SET_NULL)
    reconciled      = BooleanField(default=False)
    created_at      = DateTimeField(auto_now_add=True)
```

---

### 4.4 App: `banking`

```python
class Bank(models.Model):
    """Tabela de bancos brasileiros (schema público — compartilhada)."""
    code = CharField(max_length=10, unique=True)   # "001" (BB), "033" (Santander)
    name = CharField(max_length=200)
    ispb = CharField(max_length=8, blank=True)     # Para Pix

    class Meta:
        ordering = ['code']
        app_label = 'banking'
        # Este model vai em SHARED_APPS (tabela de referência)


class BankAccount(PaddockBaseModel):
    """Conta bancária da empresa."""
    ACCOUNT_TYPES = [
        ('CC', 'Conta Corrente'), ('CP', 'Conta Poupança'),
        ('CI', 'Conta de Investimento'), ('CAIXA', 'Caixa Interno'),
    ]
    bank           = ForeignKey(Bank, null=True, blank=True, on_delete=PROTECT)
    account_type   = CharField(max_length=6, choices=ACCOUNT_TYPES)
    agency         = CharField(max_length=10, blank=True)
    account_number = CharField(max_length=20)
    account_digit  = CharField(max_length=2, blank=True)
    name           = CharField(max_length=100)  # "Bradesco Principal"
    # Conta contábil associada (Caixa e Equivalentes — 1.1.01.xxx)
    chart_account  = ForeignKey('accounting.ChartOfAccount', on_delete=PROTECT)
    current_balance = DecimalField(max_digits=18, decimal_places=2, default=0)
    balance_date   = DateField(null=True, blank=True)
    is_active      = BooleanField(default=True)
    # Integrações
    asaas_account_id = CharField(max_length=100, blank=True)
    ofx_enabled    = BooleanField(default=True)
    last_ofx_import = DateTimeField(null=True, blank=True)


class BankTransaction(models.Model):
    """Transação bancária importada via OFX ou informada manualmente."""
    TYPES = [('CREDIT', 'Crédito'), ('DEBIT', 'Débito')]
    RECONCILE = [
        ('UNRECONCILED', 'Não Conciliado'), ('RECONCILED', 'Conciliado'),
        ('IGNORED', 'Ignorado'), ('MANUAL', 'Manual'),
    ]
    bank_account      = ForeignKey(BankAccount, on_delete=CASCADE, related_name='transactions')
    fitid             = CharField(max_length=255)  # ID único OFX
    transaction_type  = CharField(max_length=6, choices=TYPES)
    date              = DateField(db_index=True)
    amount            = DecimalField(max_digits=18, decimal_places=2)
    description       = CharField(max_length=500)
    memo              = CharField(max_length=500, blank=True)
    reconcile_status  = CharField(max_length=12, choices=RECONCILE, default='UNRECONCILED')
    # Vínculos de conciliação
    payable_payment   = ForeignKey('accounts_payable.PayablePayment',
                                    null=True, blank=True, on_delete=SET_NULL)
    receivable_receipt = ForeignKey('accounts_receivable.ReceivableReceipt',
                                     null=True, blank=True, on_delete=SET_NULL)
    journal_entry     = ForeignKey('accounting.JournalEntry', null=True, blank=True,
                                    on_delete=SET_NULL)
    imported_at       = DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [['bank_account', 'fitid']]
        indexes = [Index(fields=['date', 'reconcile_status'])]
```

---

## 5. Services (Regras de Negócio)

### 5.1 `accounting.services.JournalEntryService`

```python
# Métodos públicos:

def create_entry(description, competence_date, origin, lines, origin_object=None) -> JournalEntry
    # Valida: sum(debit) == sum(credit)
    # Valida: fiscal_period.can_post()
    # Valida: todas as contas são analíticas
    # Lançamentos automáticos: is_approved=True automaticamente

def reverse_entry(entry, user, description=None) -> JournalEntry
    # Cria estorno com linhas invertidas (D↔C)
    # Marca entry.is_reversed=True
    # Vincula reversal_entry

def create_from_service_order(service_order) -> JournalEntry
    # Fechamento de OS: D: Clientes a Receber / C: Receita Bruta (serviços + peças)
    # CMV: D: CMV / C: Estoque
    # Centro de custo derivado do ServiceOrder.os_type

def create_from_nfe_emission(fiscal_doc) -> JournalEntry
    # Emissão NF-e: D: Impostos s/Vendas / C: Impostos a Recolher

def create_from_asaas_receipt(receivable, receipt) -> JournalEntry
    # Recebimento: D: Banco / C: Clientes a Receber
    # Taxa Asaas: D: Despesas Financeiras / C: Banco

def create_from_payable_payment(payable, payment) -> JournalEntry
    # Pagamento: D: Fornecedores / C: Banco
```

### 5.2 `accounts_receivable.services.AsaasService`

```python
# Integração com API Asaas (sandbox → production via ASAAS_ENV)

def create_charge(receivable: AccountsReceivable, billing_type: str) -> dict
    # POST /payments no Asaas
    # Salva asaas_payment_id, asaas_invoice_url, asaas_pix_qr_code

def process_webhook(event_type: str, payment_data: dict) -> None
    # PAYMENT_RECEIVED / PAYMENT_CONFIRMED → baixa AR + lança contábil
    # PAYMENT_OVERDUE → atualiza status
    # PAYMENT_REFUNDED → estorna lançamento
    # Usa select_for_update() para evitar race condition

def get_payment_status(asaas_payment_id: str) -> str
    # GET /payments/{id} → retorna status atual
```

### 5.3 `banking.services.OFXImportService`

```python
def import_file(bank_account: BankAccount, ofx_file) -> dict
    # Parse OFX com ofxparse
    # Cria BankTransaction (ignora FITID duplicado)
    # Chama _auto_reconcile após importação
    # Retorna: {'imported': N, 'duplicates': N, 'errors': N, 'reconciled': N}

def _auto_reconcile(bank_account, transactions) -> None
    # Para cada transação: busca AP/AR com mesmo valor ±3 dias
    # Se match único: reconcilia automaticamente
    # Se múltiplos matches: deixa para reconciliação manual
```

### 5.4 `banking.services.CashFlowService`

```python
def get_rolling_forecast(start_date: date, days: int = 90,
                          bank_account_id=None) -> dict
    # Saldo atual + AR pendentes (entradas) - AP pendentes (saídas) por data
    # Retorna: {initial_balance, daily: [...], summary: {30_days, 60_days, 90_days}}

def get_realized(start_date: date, end_date: date) -> dict
    # Baseado em PayablePayment.payment_date e ReceivableReceipt.payment_date
    # Entradas e saídas reais por categoria CashFlowCategory
```

### 5.5 `accounting.tasks` (Celery Beat)

```python
@shared_task
def update_overdue_receivables(tenant_schema: str) -> None
    # Todo dia às 06:00 — atualiza days_overdue e status=OVERDUE

@shared_task
def update_overdue_payables(tenant_schema: str) -> None
    # Todo dia às 06:00 — atualiza status=OVERDUE

@shared_task
def reconcile_asaas_payments(tenant_schema: str) -> None
    # A cada 30 min — consulta pagamentos pendentes no Asaas

@shared_task
def generate_monthly_depreciation(tenant_schema: str, year: int, month: int) -> None
    # Todo dia 1 às 01:00 — calcula depreciação do imobilizado

@shared_task
def close_fiscal_period(tenant_schema: str, period_id: int) -> None
    # Fecha período contábil após validação de balancamento
```

---

## 6. API Endpoints

### 6.1 `accounting` — `/api/v1/accounting/`

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET/POST | `/chart-of-accounts/` | Listar/criar contas |
| GET/PATCH | `/chart-of-accounts/{id}/` | Detalhar/editar conta |
| GET | `/chart-of-accounts/{id}/balance/` | Saldo da conta (com subtree) |
| GET/POST | `/cost-centers/` | Centros de custo |
| GET/POST | `/fiscal-periods/` | Períodos fiscais |
| POST | `/fiscal-periods/{id}/close/` | Fechar período |
| GET/POST | `/journal-entries/` | Listar/criar lançamentos |
| GET | `/journal-entries/{id}/` | Detalhar lançamento + linhas |
| POST | `/journal-entries/{id}/approve/` | Aprovar lançamento |
| POST | `/journal-entries/{id}/reverse/` | Estornar lançamento |

### 6.2 `accounts_payable` — `/api/v1/payables/`

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET/POST | `/` | Listar/criar títulos AP |
| GET/PATCH | `/{id}/` | Detalhar/editar AP |
| POST | `/{id}/approve/` | Aprovar AP |
| POST | `/{id}/pay/` | Registrar pagamento |
| GET | `/{id}/payments/` | Histórico de pagamentos |
| GET | `/summary/` | Resumo: total vencido, a vencer 7/30 dias |
| GET | `/overdue/` | Títulos vencidos |

### 6.3 `accounts_receivable` — `/api/v1/receivables/`

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET/POST | `/` | Listar/criar títulos AR |
| GET/PATCH | `/{id}/` | Detalhar/editar AR |
| POST | `/{id}/charge/` | Gerar cobrança no Asaas |
| POST | `/{id}/receive/` | Registrar recebimento manual |
| GET | `/{id}/receipts/` | Histórico de recebimentos |
| GET | `/summary/` | Resumo: total pendente, vencido, a vencer |
| POST | `/webhook/asaas/` | Webhook Asaas (público, validado por token) |

### 6.4 `banking` — `/api/v1/banking/`

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET/POST | `/bank-accounts/` | Contas bancárias |
| GET | `/bank-accounts/{id}/balance/` | Saldo atual |
| POST | `/bank-accounts/{id}/import-ofx/` | Upload arquivo OFX |
| GET | `/bank-accounts/{id}/transactions/` | Transações (filtro: data, status) |
| POST | `/transactions/{id}/reconcile/` | Conciliar manualmente |
| POST | `/transactions/{id}/ignore/` | Ignorar transação |
| GET | `/cash-flow/` | Fluxo de caixa realizado |
| GET | `/cash-flow/forecast/` | Projeção rolling `?days=90` |

### 6.5 `reports` — `/api/v1/reports/`

| Método | Endpoint | Params | Saída |
|--------|----------|--------|-------|
| GET | `/dre/` | `start`, `end`, `cost_center` | JSON + PDF + XLSX |
| GET | `/balance-sheet/` | `date` | JSON + PDF |
| GET | `/cash-flow-statement/` | `start`, `end`, `method` (direct/indirect) | JSON + PDF |
| GET | `/trial-balance/` | `start`, `end` | JSON + XLSX |
| GET | `/aged-receivables/` | `date` | JSON (30/60/90/120+ dias) |
| GET | `/aged-payables/` | `date` | JSON |
| GET | `/margin-by-os/` | `start`, `end` | JSON + XLSX |
| GET | `/margin-by-cost-center/` | `start`, `end` | JSON |

---

## 7. Mapa de Integrações Automáticas

Todo evento operacional deve gerar lançamento contábil automaticamente:

| Evento (Signal/Service) | Débito | Crédito | App Trigger |
|-------------------------|--------|---------|-------------|
| OS fechada (serviço) | Clientes a Receber | Receita Bruta Serviços | service_orders |
| OS fechada (peças) | Clientes a Receber | Receita Bruta Peças | service_orders |
| OS fechada (CMV peças) | CMV Peças | Estoque | service_orders |
| NF-e emitida (impostos) | Impostos s/Vendas | Impostos a Recolher | fiscal |
| NF-e entrada (compra) | Estoque | Fornecedores | fiscal |
| Recebimento Asaas | Banco | Clientes a Receber | accounts_receivable |
| Taxa Asaas | Desp. Financeiras | Banco | accounts_receivable |
| Pagamento AP | Fornecedores | Banco | accounts_payable |
| Folha de pagamento fechada | Desp. Pessoal | Obrig. Trabalhistas | hr |
| Pagamento salário (Pix) | Obrig. Trabalhistas | Banco | hr |
| Ajuste de estoque (+) | Estoque | Ajuste Inventário | inventory |
| Ajuste de estoque (-) | Ajuste Inventário | Estoque | inventory |
| Depreciação mensal | Desp. Depreciação | Depreciação Acumulada | accounting (Celery) |

---

## 8. Plano de Contas Padrão (Fixture)

Contas pré-configuradas para o DS Car (fixture carregada no `setup_chart_of_accounts`):

```
1     ATIVO (Devedora)
1.1   Ativo Circulante
1.1.01 Caixa e Equivalentes
  1.1.01.001 Caixa Geral
  1.1.01.002 Banco Bradesco C/C
  1.1.01.003 Banco Itaú C/C
  1.1.01.004 Banco Sicoob C/C
1.1.02 Contas a Receber
  1.1.02.001 Clientes Particulares
  1.1.02.002 Seguradoras
  1.1.02.003 (-) PCLD
1.1.03 Estoques
  1.1.03.001 Estoque de Peças
  1.1.03.002 Estoque de Materiais
1.1.04 Tributos a Recuperar
  1.1.04.001 ICMS a Recuperar
  1.1.04.002 PIS a Recuperar
  1.1.04.003 COFINS a Recuperar
1.2   Ativo Não Circulante
1.2.01 Imobilizado
  1.2.01.001 Equipamentos
  1.2.01.002 Ferramentas
  1.2.01.003 Veículos
  1.2.01.004 Móveis e Utensílios
  1.2.01.099 (-) Depreciação Acumulada

2     PASSIVO (Credora)
2.1   Passivo Circulante
2.1.01 Fornecedores
  2.1.01.001 Fornecedores Nacionais
2.1.02 Obrigações Trabalhistas
  2.1.02.001 Salários a Pagar
  2.1.02.002 Férias a Pagar
  2.1.02.003 FGTS a Recolher
  2.1.02.004 INSS a Recolher
2.1.03 Obrigações Tributárias
  2.1.03.001 Simples Nacional a Recolher
  2.1.03.002 ISS a Recolher
  2.1.03.003 ICMS a Recolher
2.1.04 Contas a Pagar Diversas
  2.1.04.001 Aluguel a Pagar
  2.1.04.002 Despesas Administrativas a Pagar
2.1.05 Empréstimos e Financiamentos CP

3     PATRIMÔNIO LÍQUIDO (Credora)
3.1.01 Capital Social
3.2.01 Reserva de Lucros
3.3.01 Lucros/Prejuízos Acumulados

4     RECEITAS (Credora)
4.1.01 Receita Bruta de Peças
4.1.02 Receita Bruta de Serviços (OS)
4.1.03 Receita Bruta Vidros
4.1.04 Receita Bruta Estética
4.2.01 (-) ICMS sobre Vendas
4.2.02 (-) PIS/COFINS sobre Receitas
4.2.03 (-) ISS sobre Serviços
4.2.04 (-) Devoluções e Abatimentos

5     CUSTOS (Devedora)
5.1.01 CMV - Peças
5.1.02 CMV - Vidros
5.2.01 CSP - Custo dos Serviços Prestados

6     DESPESAS OPERACIONAIS (Devedora)
6.1.01 Despesas com Pessoal
  6.1.01.001 Salários e Ordenados
  6.1.01.002 Encargos Sociais (INSS + FGTS)
  6.1.01.003 Vale Alimentação/Refeição
  6.1.01.004 Vale Transporte
  6.1.01.005 PLR e Bônus
6.1.02 Despesas Administrativas
  6.1.02.001 Aluguel
  6.1.02.002 Energia Elétrica
  6.1.02.003 Água e Saneamento
  6.1.02.004 Internet e Telefonia
  6.1.02.005 Material de Escritório
  6.1.02.006 Depreciação e Amortização
6.1.03 Despesas Comerciais
  6.1.03.001 Marketing e Publicidade
  6.1.03.002 Fretes e Entregas
6.1.04 Despesas Financeiras
  6.1.04.001 Juros Bancários
  6.1.04.002 Tarifas Bancárias
  6.1.04.003 Taxas Asaas/Gateway
  6.1.04.004 IOF
  6.1.04.005 Multas e Juros de Mora (pagas)

7     OUTRAS RECEITAS/DESPESAS
7.1.01 Outras Receitas Operacionais
7.1.02 Ganhos na Venda de Ativos
7.2.01 Outras Despesas
7.2.02 Perdas na Venda de Ativos
7.3.01 Receitas Financeiras
  7.3.01.001 Juros Ativos
  7.3.01.002 Rendimentos de Aplicações

8     RESULTADO (encerramento — uso interno)
8.1.01 Apuração do Resultado
```

---

## 9. Frontend Next.js — Páginas

### 9.1 Estrutura de Rotas

```
apps/dscar-web/src/app/(app)/financeiro/
├── page.tsx                         ← Dashboard Financeiro
│   Cards: Saldo bancário total, AR pendente, AP vencido, Lucro do mês
│
├── plano-contas/
│   └── page.tsx                     ← Árvore de contas + saldos
│
├── lancamentos/
│   ├── page.tsx                     ← Lista lançamentos (filtros: data, origem, conta)
│   └── novo/page.tsx                ← Form lançamento manual (partidas dobradas)
│
├── contas-pagar/
│   ├── page.tsx                     ← Lista AP (tabs: pendente/vencido/pago)
│   ├── novo/page.tsx                ← Form novo título AP
│   └── [id]/page.tsx                ← Detalhe AP + histórico pagamentos
│
├── contas-receber/
│   ├── page.tsx                     ← Lista AR (tabs: pendente/vencido/recebido)
│   ├── novo/page.tsx                ← Form novo título AR
│   └── [id]/page.tsx                ← Detalhe AR + QR Pix + histórico
│
├── bancos/
│   ├── page.tsx                     ← Cards das contas bancárias + saldos
│   ├── [id]/page.tsx                ← Extrato + conciliação OFX
│   └── [id]/conciliacao/page.tsx    ← Interface de conciliação (split-screen)
│
├── fluxo-caixa/
│   └── page.tsx                     ← Chart rolling 90 dias + projeção vs realizado
│
└── relatorios/
    ├── page.tsx                     ← Hub de relatórios
    ├── dre/page.tsx                 ← DRE interativa + export PDF/XLSX
    ├── balanco/page.tsx             ← Balanço Patrimonial
    ├── dfc/page.tsx                 ← Demonstração de Fluxo de Caixa
    └── margem/page.tsx             ← Margem por OS / Centro de Custo
```

### 9.2 Componentes Principais

```
src/components/financeiro/
├── AccountingTree.tsx               ← Árvore hierárquica de contas (shadcn/ui TreeView)
├── JournalEntryForm.tsx             ← Form dinâmico de lançamento (linhas D/C)
├── BalanceValidator.tsx             ← Indicador em tempo real: débitos == créditos
├── CashFlowChart.tsx                ← Recharts (linha: projeção + realizado)
├── ReconciliationPanel.tsx          ← Split-screen: transações OFX ↔ títulos
├── FinancialSummaryCards.tsx        ← Cards do dashboard (AR, AP, saldo, DRE)
├── DRETable.tsx                     ← Tabela DRE com variação % e drill-down
└── AgingReport.tsx                  ← Aging receivables/payables (30/60/90/120+)
```

### 9.3 Tipos TypeScript

```typescript
// packages/types/src/financial.types.ts

export interface ChartOfAccount {
  id: string
  code: string
  name: string
  parent_id: string | null
  account_type: 'A' | 'L' | 'E' | 'R' | 'C' | 'X' | 'O'
  nature: 'D' | 'C'
  is_analytical: boolean
  level: number
  balance?: string   // DecimalField retorna string
  children?: ChartOfAccount[]
}

export interface JournalEntry {
  id: string
  number: string
  description: string
  competence_date: string
  origin: string
  is_approved: boolean
  is_reversed: boolean
  lines: JournalEntryLine[]
}

export interface JournalEntryLine {
  id: string
  account: ChartOfAccount
  cost_center?: CostCenter
  debit_amount: string
  credit_amount: string
  description: string
}

export interface AccountsPayable {
  id: string
  number: string
  description: string
  gross_amount: string
  net_amount: string
  paid_amount: string
  due_date: string
  payment_date: string | null
  status: 'DFT' | 'PND' | 'APR' | 'SCH' | 'PAR' | 'PAD' | 'OVR' | 'CAN'
  cost_center?: CostCenter
}

export interface AccountsReceivable {
  id: string
  number: string
  customer_name: string
  gross_amount: string
  net_amount: string
  received_amount: string
  due_date: string
  received_date: string | null
  status: 'DFT' | 'PND' | 'PAR' | 'PAD' | 'OVR' | 'CAN' | 'NEG'
  asaas_pix_qr_code?: string
  asaas_invoice_url?: string
  service_order?: { id: string; number: number }
}

export interface BankAccount {
  id: string
  name: string
  bank_name: string
  account_type: string
  current_balance: string
  balance_date: string
}

export interface CashFlowForecast {
  initial_balance: string
  daily: Array<{
    date: string
    inflows: string
    outflows: string
    balance: string
  }>
  summary: {
    '30_days': CashFlowPeriodSummary
    '60_days': CashFlowPeriodSummary
    '90_days': CashFlowPeriodSummary
  }
}

export interface DRE {
  period: { start: string; end: string }
  receita_bruta: string
  deducoes: string
  receita_liquida: string
  cmv: string
  csp: string
  lucro_bruto: string
  margem_bruta_pct: string
  despesas_operacionais: string
  resultado_operacional: string
  resultado_financeiro: string
  resultado_liquido: string
  margem_liquida_pct: string
}
```

### 9.4 Hooks TanStack Query v5

```typescript
// apps/dscar-web/src/hooks/useFinancial.ts

// Accounting
export const useChartOfAccounts = (params?) => useQuery(...)
export const useJournalEntries = (filters?) => useQuery(...)
export const useCreateJournalEntry = () => useMutation(...)
export const useApproveJournalEntry = () => useMutation(...)

// AP
export const usePayables = (filters?) => useQuery(...)
export const usePayable = (id) => useQuery(...)
export const useCreatePayable = () => useMutation(...)
export const useApprovePayable = () => useMutation(...)
export const usePayPayable = () => useMutation(...)

// AR
export const useReceivables = (filters?) => useQuery(...)
export const useReceivable = (id) => useQuery(...)
export const useCreateReceivable = () => useMutation(...)
export const useChargeReceivable = () => useMutation(...)  // gera Asaas
export const useReceivePayment = () => useMutation(...)

// Banking
export const useBankAccounts = () => useQuery(...)
export const useBankTransactions = (bankAccountId, filters?) => useQuery(...)
export const useImportOFX = () => useMutation(...)
export const useReconcileTransaction = () => useMutation(...)

// Reports
export const useCashFlowForecast = (days?) => useQuery(...)
export const useDRE = (start, end, costCenter?) => useQuery(...)
export const useFinancialSummary = () => useQuery(...)
```

---

## 10. Sprints

### Sprint 11 — Fundação Contábil (Backend)
**Estimativa: 2 semanas**

**Entregáveis:**
- App `accounting`: `ChartOfAccount`, `CostCenter`, `FiscalYear`, `FiscalPeriod`, `JournalEntry`, `JournalEntryLine`, `NumberSequence`
- `JournalEntryService` — CRUD + validação balanceamento
- Management command `setup_chart_of_accounts` — fixture com plano de contas DS Car
- Endpoints REST: `/chart-of-accounts/`, `/cost-centers/`, `/fiscal-periods/`, `/journal-entries/`
- Migrations + `manage.py check` passando
- Testes: 15+ casos (validação partidas dobradas, bloqueio de período, conta sintética)

**Fora do escopo:** AP, AR, banking, frontend

---

### Sprint 12 — Contas a Pagar e Receber (Backend)
**Estimativa: 2 semanas**

**Entregáveis:**
- App `accounts_payable`: `AccountsPayable`, `PayablePayment`, `ApprovalRule`
- App `accounts_receivable`: `AccountsReceivable`, `ReceivableReceipt`
- `PayableService` — CRUD + aprovação + pagamento + lançamento automático
- `ReceivableService` — CRUD + recebimento manual + lançamento automático
- `AsaasService` — `create_charge()`, `process_webhook()`
- Webhook endpoint `/api/v1/receivables/webhook/asaas/` (autenticação por token do header)
- Celery tasks: `update_overdue_receivables`, `update_overdue_payables`
- Testes: webhook Asaas (RECEIVED, OVERDUE, REFUNDED), pagamento parcial, aprovação

---

### Sprint 13 — Banking e Conciliação (Backend)
**Estimativa: 1-2 semanas**

**Entregáveis:**
- App `banking`: `Bank` (fixture com ~20 bancos), `BankAccount`, `BankTransaction`
- `OFXImportService` — parse + dedup por FITID + auto-reconciliação
- `CashFlowService` — `get_rolling_forecast()` (30/60/90 dias)
- Endpoints: `/bank-accounts/`, `/transactions/`, `/import-ofx/`, `/cash-flow/forecast/`
- Celery task: `reconcile_asaas_payments`

---

### Sprint 14 — Relatórios (Backend)
**Estimativa: 1 semana**

**Entregáveis:**
- App `reports`: DRE, Balanço Patrimonial, DFC (método direto), Aging AP/AR, Margem por OS
- PDF via ReportLab + XLSX via openpyxl
- Filtros por período e centro de custo
- Cache de relatórios (Redis, TTL 1h) para relatórios pesados

---

### Sprint 15 — Frontend Financeiro (Next.js)
**Estimativa: 2-3 semanas**

**Entregáveis (por prioridade):**
1. Dashboard `/financeiro` — cards resumo (saldo bancário, AR, AP, DRE do mês)
2. Contas a Pagar `/financeiro/contas-pagar` — lista + novo + detalhe + pagar
3. Contas a Receber `/financeiro/contas-receber` — lista + novo + detalhe + QR Pix
4. Fluxo de Caixa `/financeiro/fluxo-caixa` — chart rolling 90 dias
5. Contas Bancárias `/financeiro/bancos` — cards + extrato + upload OFX
6. Conciliação `/financeiro/bancos/[id]/conciliacao` — split-screen
7. DRE `/financeiro/relatorios/dre` — tabela interativa + export
8. Plano de Contas `/financeiro/plano-contas` — árvore hierárquica
9. Lançamentos `/financeiro/lancamentos` — lista + form manual

---

## 11. Checklist de Segurança e Compliance

- [ ] Webhook Asaas validado por `asaas-access-token` no header (não expor endpoint público sem validação)
- [ ] Lançamentos contábeis: nunca deletar, apenas estornar (auditoria)
- [ ] Períodos fechados: impedir qualquer `save()` de `JournalEntry`
- [ ] Valores monetários: `Decimal` em todo cálculo Python, nunca `float`
- [ ] Dados bancários: agência/conta não criptografados (não são dados pessoais LGPD), mas PIX sim (já criptografado em HR)
- [ ] FITID único por conta bancária: `unique_together = [['bank_account', 'fitid']]`
- [ ] AP/AR: nunca hard delete — soft delete apenas (evidência contábil)
- [ ] Taxa Asaas: sempre lançar como Despesa Financeira (transparência contábil)
- [ ] DRE e Balanço: baseados em `JournalEntryLine` — nunca calculados de AP/AR diretamente
- [ ] `select_for_update()` no webhook Asaas e geração de número sequencial (race condition)
- [ ] Migração multitenancy: `setup_chart_of_accounts` rodado para cada novo tenant

---

## 12. Configurações CLAUDE.md a Adicionar

Após implementação, adicionar ao `CLAUDE.md`:
- Centros de custo padrão (CC-OS, CC-PECAS, CC-VIDROS, CC-ESTETICA, CC-ADM)
- Contas contábeis-chave (Clientes, Receitas, CMV, Bancos)
- Regra: todo fechamento de OS dispara `JournalEntryService.create_from_service_order()`
- Regra: webhook Asaas em `/api/v1/receivables/webhook/asaas/` — validar `X-Asaas-Access-Token`

---

*Paddock Solutions · paddock.solutions · Manaus, AM*
*Spec gerada: Abril 2026*
