"""
Paddock Solutions — Permission codes and default matrix per role.

PERMISSION_CODES: canonical list of granular permission codes.
DEFAULT_PERMISSIONS: which permissions each role has by default.
Tenant admins can override these defaults via TenantPermissionOverride.
"""

PERMISSION_CODES: dict[str, str] = {
    # OS
    "os.view": "Ver lista e detalhe de OS",
    "os.create": "Criar nova OS",
    "os.edit": "Editar OS existente",
    "os.transition": "Avancar/retroceder status",
    "os.billing": "Faturar OS (emitir NF)",
    "os.delete": "Cancelar OS",
    # Cadastros
    "cadastros.view": "Ver pessoas, seguradoras, etc",
    "cadastros.edit": "Criar/editar cadastros",
    "cadastros.catalog": "Gerenciar catalogo (servicos, pecas)",
    # Compras
    "compras.view": "Ver pedidos e cotacoes",
    "compras.create": "Criar pedidos de compra",
    "compras.approve": "Aprovar OC",
    # Estoque
    "estoque.view": "Ver estoque",
    "estoque.move": "Dar entrada/saida",
    # Financeiro
    "financeiro.view": "Ver contas a pagar/receber",
    "financeiro.edit": "Registrar pagamentos/recebimentos",
    # Fiscal
    "fiscal.view": "Ver notas fiscais",
    "fiscal.emit": "Emitir NF-e/NFS-e/NFC-e",
    # Admin
    "admin.users": "Gerenciar usuarios do tenant",
    "admin.permissions": "Configurar matriz de permissoes",
    "admin.settings": "Configuracoes do tenant",
}

DEFAULT_PERMISSIONS: dict[str, list[str]] = {
    "OWNER": list(PERMISSION_CODES.keys()),
    "ADMIN": list(PERMISSION_CODES.keys()),
    "MANAGER": [
        "os.view", "os.create", "os.edit", "os.transition", "os.billing",
        "cadastros.view", "cadastros.edit", "cadastros.catalog",
        "compras.view", "compras.create", "compras.approve",
        "estoque.view", "estoque.move",
        "financeiro.view", "fiscal.view", "fiscal.emit",
    ],
    "CONSULTANT": [
        "os.view", "os.create", "os.edit", "os.transition",
        "cadastros.view",
        "compras.view",
        "estoque.view",
    ],
    "STOREKEEPER": [
        "os.view",
        "cadastros.view",
        "compras.view", "compras.create",
        "estoque.view", "estoque.move",
    ],
}
