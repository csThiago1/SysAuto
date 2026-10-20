"""Carga inicial das regras de sugestão de conta contábil.

Mapeia itens do dia a dia da oficina para as contas do plano padrão DS Car,
para que a sugestão funcione desde o primeiro lançamento sem gastar LLM.

Tolerante por design: conta ausente no plano do tenant → o termo é pulado,
sem quebrar a migração. Termo que já existe não é sobrescrito — regra criada
por um humano tem precedência sobre esta carga.
"""

from django.db import migrations

# A MESMA normalização usada na consulta. Importada em vez de escrita à mão:
# um acento esquecido aqui viraria um termo que nunca casa.
from apps.accounting.services.term_normalizer import normalize_term

# código da conta → termos em linguagem de quem digita a despesa
SEED: dict[str, list[str]] = {
    # Material de Escritorio e Limpeza — no plano DS Car é UMA conta só,
    # então tesoura e detergente caem no mesmo lugar.
    "6.1.03.001": [
        "tesoura",
        "régua",
        "caneta",
        "lápis",
        "papel A4",
        "grampeador",
        "grampo",
        "clips",
        "pasta",
        "toner",
        "cartucho",
        "envelope",
        "detergente",
        "desinfetante",
        "água sanitária",
        "saco de lixo",
        "vassoura",
        "rodo",
        "pano de chão",
        "papel higiênico",
    ],
    "6.1.02.003": ["energia", "luz", "conta de luz", "energia elétrica"],
    "6.1.02.002": ["água", "esgoto", "saneamento", "conta de água"],
    "6.1.02.004": ["internet", "telefone", "celular", "link dedicado", "telefonia"],
    "6.1.03.005": ["gasolina", "diesel", "álcool", "combustível", "uber", "pedágio"],
    "6.1.03.003": [
        "assinatura",
        "licença",
        "software",
        "hospedagem",
        "domínio",
        "SaaS",
    ],
    # Suposição sinalizada ao cliente: café e água mineral como benefício.
    # Se o contador preferir despesa administrativa, editar a regra na tela.
    "6.1.01.006": ["café", "água mineral", "lanche", "marmita", "refeição"],
    # Suposição sinalizada ao cliente: EPI como consumo direto de produção.
    "5.1.01.002": [
        "lixa",
        "fita crepe",
        "máscara",
        "luva",
        "óculos de proteção",
        "EPI",
        "thinner",
        "verniz",
        "massa plástica",
        "estopa",
        "solvente",
    ],
    "6.1.02.005": ["ferramenta", "reparo", "manutenção predial", "conserto"],
    "6.2.01.003": ["taxa de cartão", "maquininha", "taxa de maquininha"],
}


def forwards(apps, schema_editor):
    ChartOfAccount = apps.get_model("accounting", "ChartOfAccount")
    AccountSuggestionRule = apps.get_model("accounting", "AccountSuggestionRule")

    for code, terms in SEED.items():
        account = ChartOfAccount.objects.filter(code=code, is_active=True).first()
        if account is None:
            # Plano de contas do tenant não tem esta conta — segue o baile.
            continue

        for term in terms:
            normalized = normalize_term(term)
            if not normalized:
                continue
            AccountSuggestionRule.objects.get_or_create(
                term=normalized,
                defaults={"account": account, "source": "S", "is_active": True},
            )


def backwards(apps, schema_editor):
    AccountSuggestionRule = apps.get_model("accounting", "AccountSuggestionRule")
    terms = [normalize_term(t) for terms in SEED.values() for t in terms]
    # Só remove o que continua marcado como carga inicial: se um humano
    # corrigiu a classificação, a regra dele fica.
    AccountSuggestionRule.objects.filter(term__in=terms, source="S").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("accounting", "0006_alter_despesarecorrente_supplier_and_more"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
