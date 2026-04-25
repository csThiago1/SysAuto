"""Seed: 6 roles padrão + 20 permissões canônicas."""
from django.db import migrations


PERMISSIONS = [
    # (code, label, module)
    ("budget.view", "Ver orçamentos", "budget"),
    ("budget.create", "Criar orçamento", "budget"),
    ("budget.approve", "Aprovar orçamento", "budget"),
    ("budget.reject", "Recusar orçamento", "budget"),
    ("os.view", "Ver OS", "os"),
    ("os.create", "Abrir OS", "os"),
    ("os.cancel", "Cancelar OS", "os"),
    ("os.import_xml", "Importar XML de seguradora", "os"),
    ("os.change_status", "Transicionar status de OS", "os"),
    ("payment.view", "Ver pagamentos", "payment"),
    ("payment.record", "Registrar pagamento", "payment"),
    ("payment.refund", "Estornar pagamento", "payment"),
    ("vehicle.view", "Ver veículos", "vehicle"),
    ("vehicle.create", "Cadastrar veículo", "vehicle"),
    ("vehicle.lookup", "Consultar placa externa", "vehicle"),
    ("import.view", "Ver tentativas de importação", "import"),
    ("import.trigger", "Disparar importação Cilia", "import"),
    ("import.upload_xml", "Upload de XML seguradora", "import"),
    ("authz.manage_roles", "Gerenciar roles de usuários", "authz"),
    ("authz.manage_perms", "Gerenciar permissões de usuários", "authz"),
]

ROLES = [
    # (code, label, perm_codes)
    ("OWNER", "Proprietário", [p[0] for p in PERMISSIONS]),
    ("ADMIN", "Administrador", [p[0] for p in PERMISSIONS]),
    (
        "MANAGER",
        "Gerente",
        [
            "budget.view", "budget.create", "budget.approve", "budget.reject",
            "os.view", "os.create", "os.cancel", "os.change_status",
            "payment.view", "payment.record", "payment.refund",
            "vehicle.view", "vehicle.create", "vehicle.lookup",
            "import.view", "import.trigger", "import.upload_xml",
        ],
    ),
    (
        "CONSULTANT",
        "Consultor",
        [
            "budget.view", "budget.create",
            "os.view", "os.create", "os.change_status",
            "payment.view",
            "vehicle.view", "vehicle.lookup",
            "import.view",
        ],
    ),
    (
        "MECHANIC",
        "Mecânico",
        ["os.view", "os.change_status", "vehicle.view"],
    ),
    (
        "FINANCIAL",
        "Financeiro",
        ["payment.view", "payment.record", "payment.refund", "budget.view"],
    ),
]


def seed_roles(apps, schema_editor):
    Permission = apps.get_model("authz", "Permission")
    Role = apps.get_model("authz", "Role")
    RolePermission = apps.get_model("authz", "RolePermission")

    perms_by_code = {}
    for code, label, module in PERMISSIONS:
        p, _ = Permission.objects.get_or_create(code=code, defaults={"label": label, "module": module})
        perms_by_code[code] = p

    for code, label, perm_codes in ROLES:
        role, _ = Role.objects.get_or_create(code=code, defaults={"label": label})
        for perm_code in perm_codes:
            perm = perms_by_code.get(perm_code)
            if perm:
                RolePermission.objects.get_or_create(role=role, permission=perm)


def unseed_roles(apps, schema_editor):
    pass  # Não remove dados em rollback — operação segura


class Migration(migrations.Migration):

    dependencies = [
        ("authz", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_roles, unseed_roles),
    ]
