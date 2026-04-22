"""
Paddock Solutions — Pricing Catalog — Constants
Motor de Orçamentos (MO) — Sprint MO-7: Orçamento + OS

Mapeamento de Ação Cilia → código de ServiçoCanonico no catálogo.
Documento vivo — atualizar junto com o enum Acao em apps.quotes.
"""

# Ação (enum quotes.constants.Acao) → código canônico do serviço
# Serviços devem existir em ServicoCanonico.codigo (criados pelo setup_catalogo_base)
MAPEAMENTO_ACAO_SERVICO: dict[str, str] = {
    "trocar":             "INST_PECA",       # Instalação de peça (mão de obra)
    "reparar":            "FUNILARIA",       # Funilaria / desamassamento
    "pintar":             "PINTURA",         # Pintura (usa TipoPintura do veículo)
    "remocao_instalacao": "REMOCAO_INSTAL",  # R&I (desmontar + remontar sem trocar)
}
