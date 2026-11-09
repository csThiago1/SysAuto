"""
Checklist de entrada 3D — chaves de peça e choices.

Espelhado manualmente no front (TS), como VALID_TRANSITIONS: mudou aqui, muda lá.
"""

from __future__ import annotations

from django.db import models

PANEL_CHOICES: tuple[tuple[str, str], ...] = (
    ("parachoque_diant", "Para-choque dianteiro"),
    ("parachoque_tras", "Para-choque traseiro"),
    ("capo", "Capô"),
    ("teto", "Teto"),
    ("tampa_tras", "Tampa traseira"),
    ("cacamba", "Caçamba"),
    ("paralama_diant_e", "Para-lama dianteiro esquerdo"),
    ("paralama_diant_d", "Para-lama dianteiro direito"),
    ("lateral_tras_e", "Lateral traseira esquerda"),
    ("lateral_tras_d", "Lateral traseira direita"),
    ("porta_diant_e", "Porta dianteira esquerda"),
    ("porta_diant_d", "Porta dianteira direita"),
    ("porta_tras_e", "Porta traseira esquerda"),
    ("porta_tras_d", "Porta traseira direita"),
    ("porta_lateral_corredica", "Porta lateral corrediça"),
    ("retrovisor_e", "Retrovisor esquerdo"),
    ("retrovisor_d", "Retrovisor direito"),
    ("soleira_e", "Soleira esquerda"),
    ("soleira_d", "Soleira direita"),
    ("coluna_a_e", "Coluna A esquerda"),
    ("coluna_a_d", "Coluna A direita"),
    ("parabrisa", "Para-brisa"),
    ("vidro_tras", "Vidro traseiro"),
    ("farol_e", "Farol esquerdo"),
    ("farol_d", "Farol direito"),
    ("lanterna_e", "Lanterna esquerda"),
    ("lanterna_d", "Lanterna direita"),
    ("grade", "Grade"),
    ("roda_diant_e", "Roda dianteira esquerda"),
    ("roda_diant_d", "Roda dianteira direita"),
    ("roda_tras_e", "Roda traseira esquerda"),
    ("roda_tras_d", "Roda traseira direita"),
)

PANEL_KEYS: tuple[str, ...] = tuple(key for key, _ in PANEL_CHOICES)

EXTERIOR_STOPS: tuple[str, ...] = ("frente", "lado_direito", "lado_esquerdo", "traseira", "teto")


class DamageType(models.TextChoices):
    AMASSADO = "amassado", "Amassado"
    RISCO = "risco", "Risco"
    TRINCA = "trinca", "Trinca"
    QUEBRA = "quebra", "Quebra"
    CORROSAO = "corrosao", "Corrosão"
    PINTURA = "pintura", "Pintura"
    FALTANDO = "faltando", "Faltando"


class DamageSeverity(models.TextChoices):
    LEVE = "leve", "Leve"
    MODERADA = "moderada", "Moderada"
    GRAVE = "grave", "Grave"


class DamageRelation(models.TextChoices):
    SINISTRO = "sinistro", "Sinistro"
    PRE_EXISTENTE = "pre_existente", "Pré-existente"
    NAO_SEI = "nao_sei", "Não sei"


class BudgetMatch(models.TextChoices):
    NO_ORCAMENTO = "no_orcamento", "No orçamento"
    FORA_DO_ORCAMENTO = "fora_do_orcamento", "Fora do orçamento"
    SEM_ORCAMENTO = "sem_orcamento", "Sem orçamento"


class BodyType(models.TextChoices):
    HATCH = "hatch", "Hatch"
    SEDAN = "sedan", "Sedã"
    SUV = "suv", "SUV"
    PICKUP = "pickup", "Picape"
    VAN = "van", "Van"


class SignatureStatus(models.TextChoices):
    PENDENTE = "pendente", "Pendente"
    PRESENCIAL = "presencial", "Presencial"
    REMOTO = "remoto", "Remoto"
