"""Constantes do módulo de documentos PDF."""

WARRANTY_MONTHS_BY_CATEGORY: dict[str, int] = {
    "mechanic": 3,
    "bodywork": 6,
    "painting": 6,
    "polishing": 3,
    "washing": 0,
    "aesthetic": 3,
    "default": 3,
}

DEFAULT_WARRANTY_COVERAGE: list[str] = [
    "Defeitos de execução em funilaria, pintura e montagem originados de falha técnica da DS Car.",
    "Peças instaladas que apresentem defeito de fabricação ou de aplicação durante o período de garantia.",
    "Serviços de pintura: garantia contra descascamento, bolhas ou perda de brilho decorrentes da aplicação.",
]

DEFAULT_WARRANTY_EXCLUSIONS: list[str] = [
    "Danos causados por novo acidente, colisão, vandalismo ou uso indevido do veículo.",
    "Desgaste natural decorrente do uso normal do veículo.",
    "Serviços realizados por terceiros após a entrega sem comunicação prévia à DS Car.",
    "Danos causados por produtos químicos, combustíveis, intempéries ou catástrofes naturais.",
]

DOCUMENT_S3_PREFIX = "documents"
