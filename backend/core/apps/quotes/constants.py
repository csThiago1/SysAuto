"""
Paddock Solutions — Quotes — Constants
Motor de Orçamentos (MO) — Sprint MO-7

Vocabulário Cilia adotado conforme ADR-001.
"""
from django.db import models


class Acao(models.TextChoices):
    """Ação sobre a peça — vocabulário Cilia (T, R, P, R&I)."""

    TROCAR             = "trocar",             "Trocar"
    REPARAR            = "reparar",            "Reparar"
    PINTAR             = "pintar",             "Pintar"
    REMOCAO_INSTALACAO = "remocao_instalacao", "Remoção e instalação"


class StatusItem(models.TextChoices):
    """Status Cilia do item — aplica-se a Intervenção e Item Adicional."""

    ORCADO        = "orcado",        "Orçado"
    APROVADO      = "aprovado",      "Aprovado"
    SEM_COBERTURA = "sem_cobertura", "Sem cobertura"
    SOB_ANALISE   = "sob_analise",   "Sob análise"
    EXECUTADO     = "executado",     "Executado"
    CANCELADO     = "cancelado",     "Cancelado"


class QualificadorPeca(models.TextChoices):
    """Qualificador de peça — vocabulário Cilia (PPO, PRO, PR, PREC)."""

    PPO  = "PPO",  "Peça Original (PPO)"
    PRO  = "PRO",  "Peça Recondicionada Original (PRO)"
    PR   = "PR",   "Peça de Reposição (PR)"
    PREC = "PREC", "Peça Recondicionada (PREC)"


class Fornecimento(models.TextChoices):
    """Quem fornece a peça."""

    OFICINA    = "oficina",    "Oficina"
    SEGURADORA = "seguradora", "Seguradora"
    CLIENTE    = "cliente",    "Cliente"


class StatusArea(models.TextChoices):
    """Status da Área de Impacto."""

    ABERTA           = "aberta",           "Aberta"
    APROVADA         = "aprovada",         "Aprovada"
    NEGADA_PRE_EXIST = "negada_pre_exist", "Negada — pré-existência"
    PARCIAL          = "parcial",          "Parcial"
    CANCELADA        = "cancelada",        "Cancelada"
