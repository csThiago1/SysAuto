from django.db import migrations


PERMISSIONS = [
    # module, code, label
    ("budget", "budget.create", "Criar orçamento particular"),
    ("budget", "budget.edit_own", "Editar orçamentos próprios"),
    ("budget", "budget.edit_any", "Editar qualquer orçamento"),
    ("budget", "budget.approve", "Marcar orçamento como aprovado"),
    ("budget", "budget.clone", "Clonar orçamento arquivado"),

    ("os", "os.create", "Criar OS"),
    ("os", "os.edit", "Editar OS"),
    ("os", "os.change_status", "Mover OS no Kanban"),
    ("os", "os.delete", "Excluir OS (soft delete)"),
    ("os", "os.import_insurance", "Importar orçamento de seguradora"),
    ("os", "os.view_cost_margin", "Ver custo/margem"),

    ("payment", "payment.create", "Registrar pagamento"),
    ("payment", "payment.view", "Ver pagamentos"),

    ("fiscal", "fiscal.issue_nfse", "Emitir NFS-e"),
    ("fiscal", "fiscal.issue_nfe", "Emitir NFe"),

    ("photo", "photo.upload", "Subir foto"),
    ("photo", "photo.delete", "Remover foto (soft)"),

    ("pareceres", "pareceres.reply_external", "Responder parecer externo"),
]


ROLE_DEFAULTS = {
    "OWNER": {"label": "Dono", "description": "Acesso total"},
    "ADMIN": {"label": "Administrador", "description": "Gestão geral menos exclusão"},
    "MANAGER": {"label": "Gerente", "description": "Gestão operacional"},
    "CONSULTANT": {"label": "Consultor", "description": "Atendimento e orçamento"},
    "MECHANIC": {"label": "Mecânico", "description": "Execução de reparo"},
    "FINANCIAL": {"label": "Financeiro", "description": "Pagamentos e fiscal"},
}


ROLE_PERMISSIONS = {
    "OWNER": "ALL",  # especial: recebe tudo
    "ADMIN": [
        "budget.create", "budget.edit_own", "budget.edit_any", "budget.approve", "budget.clone",
        "os.create", "os.edit", "os.change_status", "os.import_insurance", "os.view_cost_margin",
        "payment.create", "payment.view",
        "fiscal.issue_nfse", "fiscal.issue_nfe",
        "photo.upload", "photo.delete",
        "pareceres.reply_external",
    ],
    "MANAGER": [
        "budget.create", "budget.edit_own", "budget.edit_any", "budget.approve", "budget.clone",
        "os.create", "os.edit", "os.change_status", "os.import_insurance", "os.view_cost_margin",
        "payment.create", "payment.view",
        "fiscal.issue_nfse", "fiscal.issue_nfe",
        "photo.upload", "photo.delete",
        "pareceres.reply_external",
    ],
    "CONSULTANT": [
        "budget.create", "budget.edit_own", "budget.approve", "budget.clone",
        "os.create", "os.edit", "os.change_status", "os.import_insurance",
        "photo.upload",
        "pareceres.reply_external",
    ],
    "MECHANIC": [
        "os.change_status",
        "photo.upload",
    ],
    "FINANCIAL": [
        "payment.create", "payment.view",
        "fiscal.issue_nfse", "fiscal.issue_nfe",
    ],
}


def seed(apps, schema_editor) -> None:
    Permission = apps.get_model("authz", "Permission")
    Role = apps.get_model("authz", "Role")
    RolePermission = apps.get_model("authz", "RolePermission")

    # Permissões
    perm_by_code = {}
    for module, code, label in PERMISSIONS:
        p, _ = Permission.objects.get_or_create(code=code, defaults={"label": label, "module": module})
        perm_by_code[code] = p

    # Roles
    for code, defaults in ROLE_DEFAULTS.items():
        Role.objects.get_or_create(code=code, defaults=defaults)

    # Mapeamentos
    for role_code, perm_codes in ROLE_PERMISSIONS.items():
        role = Role.objects.get(code=role_code)
        if perm_codes == "ALL":
            codes_to_assign = list(perm_by_code.keys())
        else:
            codes_to_assign = perm_codes
        for pc in codes_to_assign:
            RolePermission.objects.get_or_create(role=role, permission=perm_by_code[pc])


class Migration(migrations.Migration):

    dependencies = [
        ("authz", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed, migrations.RunPython.noop),
    ]
