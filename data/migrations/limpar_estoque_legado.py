#!/usr/bin/env python3
"""
Limpeza e normalização do estoque legado do Databox.
Gera catálogo de peças canônico para o parts_catalog (shared).

Entrada: estoque_legado_databox.xls (30.842 linhas)
Saída:   catalogo_pecas_limpo.xlsx (deduplicado, categorizado, normalizado)

Uso: python3 limpar_estoque_legado.py
"""

from __future__ import annotations

import re
import logging
from pathlib import Path

import pandas as pd

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

HERE = Path(__file__).parent
INPUT_FILE = HERE / "estoque_legado_databox.xls"
OUTPUT_FILE = HERE / "catalogo_pecas_limpo.xlsx"

# ─────────────────────────────────────────────────────────────────────────────
# 1. NORMALIZAÇÃO DE UNIDADES
# ─────────────────────────────────────────────────────────────────────────────
UNIT_MAP = {
    # Peça
    "PC": "PC", "pc": "PC", "PCA": "PC", "PECA": "PC", "PEC": "PC",
    "PF": "PC",
    # Unidade
    "UN": "UN", "un": "UN", "UNIDA": "UN", "UNID": "UN", "UND": "UN",
    "UM": "UN", "EA": "UN",
    # Litro
    "LT": "LT", "Lit": "LT", "LIT": "LT", "LITRO": "LT", "LTRO": "LT",
    "LT3": "LT", "LTAO": "LT", "L": "LT",
    # Jogo
    "JG": "JG", "JOG": "JG", "jg": "JG",
    # Galão
    "GL": "GL", "Gal": "GL", "GL5": "GL",
    # Kit
    "KT": "KT", "KIT": "KT",
    # Metro
    "MT": "MT", "M2": "M2", "M3": "M3",
    # Outros
    "BD": "BD", "DS": "DS", "FL": "FL", "RL": "RL", "PCT": "PCT",
    "MC": "MC", "CX": "CX", "KG": "KG", "FR": "FR", "FR8": "FR",
    "LA": "LA", "BO": "BO", "FC": "FC", "PA": "PA", "CH": "CH",
    "PT": "PT", "PR": "PR", "0,2G": "UN",
}


# ─────────────────────────────────────────────────────────────────────────────
# 2. CATEGORIZAÇÃO POR KEYWORDS + NCM
# ─────────────────────────────────────────────────────────────────────────────
# Ordem importa: a primeira categoria que bater, ganha.
# CARROCERIA primeiro — é a maior categoria e evita falsos positivos
# (ex: "PARACHOQUE PRIMER" é carroceria, não pintura)
CATEGORY_RULES: list[tuple[str, list[str]]] = [
    ("CARROCERIA", [
        "PARACHOQUE", "PARA-CHOQUE", "PARA CHOQUE", "P/CHOQUE", "P-CHOQUE",
        "P/CHOQ", "PCH ", "PARALAMA", "PARA-LAMA", "CAPO ", "CAPÔ", "CAPU",
        "PORTA DIANT", "PORTA TRAS", "PORTA LD", "PORTA LE", "PORTA DIR",
        "PORTA ESQ", "TAMPA", "PAINEL", "GRADE", "MOLDURA", "SPOILER", "SAIA ",
        "FRISO", "CALHA", "DEFLETOR", "RACK ", "ESTRIBO", "LONGARINA",
        "SOLEIRA", "RETROVISOR", "ESPELHO RETROV", "PARA BARRO", "PARABARRO",
        "PARA-BARRO", "ALMA ", "REFORÇO", "REFORCO", "TRAVESSA", "COLUNA ",
        "ASSOALHO", "CAIXA RODA", "PESTANA", "FECHADURA", "MACANETA",
        "DOBRADIÇA", "DOBRADICA", "PROTETOR INTERNO", "COBERTURA",
        "ABSORVEDOR", "REVESTIMENTO", "FORRO PORTA", "FORRO TETO",
        "CAPA RETROVISOR", "GUARDA-PO",
    ]),
    ("VIDROS", [
        "PARABRISA", "PARA-BRISA", "PARA BRISA", "VIDRO ", "VIGIA",
        "JANELA", "VIDRO PORTA", "VIDRO TRASEIRO", "VIDRO LATERAL",
    ]),
    ("ILUMINACAO", [
        "FAROL", "LANTERNA", "REFLETOR", "LAMPADA", "LÂMPADA", "LUZ ",
        "SETA ", "PISCA", "MILHA", "NEBLINA",
    ]),
    ("FREIOS", [
        "PASTILHA", "DISCO FREIO", "DISCO DE FREIO", "SAPATA", "LONA FREIO",
        "CILINDRO FREIO", "CILINDRO MESTRE", "PINÇA FREIO", "FLEXIVEL FREIO",
        "FLUIDO FREIO", "OLEO DE FREIO",
    ]),
    ("SUSPENSAO", [
        "AMORTECEDOR", "MOLA ", "BANDEJA", "BIELETA", "COXIM", "BUCHA ",
        "TERMINAL DIR", "TERMINAL ESQ", "TERMINAL DE", "PIVO", "PIVÔ",
        "ROLAMENTO", "CUBO ", "HOMOCINETI", "JUNTA HOMOC", "TULIPA",
        "BARRA ESTAB", "BARRA DIR", "BRAÇO OSCIL", "BATENTE ",
    ]),
    ("ARREFECIMENTO_AR", [
        "CONDENSADOR AR", "CONDENSADOR A/C", "CONDENSADOR DO AC",
        "EVAPORADOR", "COMPRESSOR AR", "COMPRESSOR A/C",
        "VENTOINHA", "ELETROVENT", "MANGUEIRA RAD", "VALVULA TERMOS",
        "RESERVATORIO AGUA", "INTERCOLER", "INTERCOOLER",
        "GMV ",  # grupo moto-ventilador
    ]),
    ("MOTOR_TRANSMISSAO", [
        "CORREIA", "TENSOR", "BOMBA ", "FILTRO", "VELA ", "CABO VELA",
        "BICO INJETOR", "BOBINA ", "VALVULA", "JOGO BRONZINA", "GAXETA",
        "RETENTOR", "JOGO ANEL", "OLEO MOTOR", "OLEO CAMBIO", "OLEO TRANS",
        "ADITIVO", "MOTOR PARTIDA", "CAIXA DE MUDANÇ",
    ]),
    ("ELETRICA", [
        "ALTERNADOR", "SENSOR", "ATUADOR", "MODULO", "MÓDULO", "CHICOTE",
        "RELE ", "RELÊ", "FUSIVEL", "BUZINA", "CHAVE SETA", "COMUTADOR",
        "MOTOR VIDRO", "MOTOR LIMPADOR", "AIRBAG",
    ]),
    ("RODAS_PNEUS", [
        "PNEU", "RODA ", "RODA DE", "CALOTA", "BICO PNEU",
    ]),
    ("EMBLEMAS_ADESIVOS", [
        "EMBLEMA", "LOGOTIPO", "LOGO ",
    ]),
    ("PINTURA_INSUMOS", [
        "TINTA", "VERNIZ", "LIXA", "MASSA PLASTICA", "MASSA POLIESTER",
        "MASSA RAPIDA", "LAZZUDUR", "SIKKENS", "GLASURIT", "DILUIDO", "DILU",
        "THINNER", "CATALISADOR", "ENDURECEDOR", "SELADOR", "POLIMENTO",
        "POLITRIZ", "LIXADEIRA", "MASCARAMENTO", "SCOTCH", "3M ",
        "DESENGRAXANTE", "ANTICORROSIVO", "CERA ", "WAX", "BOINA",
        "ESPUMA POL", "REMOVEDOR", "MASSA POLIR", "PRIMER ",
    ]),
    ("CONSUMIVEIS", [
        "FITA CREPE", "FITA ADESIV", "PAPEL ", "COLA ", "SILICONE", "ESPATULA",
        "PISTOLA PINTURA", "MANGUEIRA", "ESTOPA", "PANO ", "DISCO LIXA",
        "DISCO P/", "REBITE", "SOLDA", "ELETRODO", "ARAME ", "ABRASIV",
    ]),
]

# NCM fallback para categorias
NCM_CATEGORY_MAP = {
    "87081": "CARROCERIA",       # Para-choques e partes
    "87082": "CARROCERIA",       # Carroçaria e partes
    "87083": "FREIOS",           # Freios e servo-freios
    "87084": "MOTOR_TRANSMISSAO",  # Caixas de marchas
    "87085": "SUSPENSAO",        # Eixos e partes
    "87087": "RODAS_PNEUS",      # Rodas e partes
    "87088": "SUSPENSAO",        # Amortecedores
    "87089": "OUTROS",           # Outras partes
    "85122": "ILUMINACAO",       # Equipamento iluminação
    "85119": "ELETRICA",         # Partes equipamento elétrico
    "70072": "VIDROS",           # Vidros de segurança
    "70091": "VIDROS",           # Espelhos retrovisores
    "40169": "CONSUMIVEIS",      # Borrachas
    "32081": "PINTURA_INSUMOS",  # Tintas
    "32091": "PINTURA_INSUMOS",  # Vernizes
    "68052": "CONSUMIVEIS",      # Abrasivos
    "39263": "CARROCERIA",       # Guarnições plásticas
    "39269": "CONSUMIVEIS",      # Plásticos diversos
    "84159": "ARREFECIMENTO_AR", # Ar condicionado
}


# ─────────────────────────────────────────────────────────────────────────────
# 3. EXTRAÇÃO DE VEÍCULO (MARCA / MODELO / ANO)
# ─────────────────────────────────────────────────────────────────────────────
VEHICLE_MAKES = {
    # keyword → marca normalizada
    "CHEVROLET": "CHEVROLET", "GM": "CHEVROLET", "GENERAL MOTORS": "CHEVROLET",
    "VOLKSWAGEN": "VOLKSWAGEN", "VW": "VOLKSWAGEN",
    "FIAT": "FIAT",
    "FORD": "FORD",
    "TOYOTA": "TOYOTA",
    "HONDA": "HONDA",
    "HYUNDAI": "HYUNDAI",
    "NISSAN": "NISSAN",
    "RENAULT": "RENAULT",
    "JEEP": "JEEP",
    "MITSUBISHI": "MITSUBISHI",
    "KIA": "KIA",
    "PEUGEOT": "PEUGEOT",
    "CITROEN": "CITROEN", "CITROËN": "CITROEN",
    "SUZUKI": "SUZUKI",
    "SUBARU": "SUBARU",
    "BMW": "BMW",
    "MERCEDES": "MERCEDES-BENZ", "MERCEDES-BENZ": "MERCEDES-BENZ",
    "AUDI": "AUDI",
    "CHERY": "CHERY",
    "CAOA CHERY": "CAOA CHERY",
    "JAC": "JAC",
    "LIFAN": "LIFAN",
    "VOLVO": "VOLVO",
    "RAM": "RAM",
}

# Modelo → Marca (para quando só aparece o modelo na descrição)
MODEL_TO_MAKE: dict[str, tuple[str, str]] = {
    # CHEVROLET
    "ONIX": ("CHEVROLET", "ONIX"),
    "ONIX PLUS": ("CHEVROLET", "ONIX PLUS"),
    "PRISMA": ("CHEVROLET", "PRISMA"),
    "CRUZE": ("CHEVROLET", "CRUZE"),
    "COBALT": ("CHEVROLET", "COBALT"),
    "SPIN": ("CHEVROLET", "SPIN"),
    "TRACKER": ("CHEVROLET", "TRACKER"),
    "EQUINOX": ("CHEVROLET", "EQUINOX"),
    "TRAILBLAZER": ("CHEVROLET", "TRAILBLAZER"),
    "S10": ("CHEVROLET", "S10"),
    "MONTANA": ("CHEVROLET", "MONTANA"),
    "CORSA": ("CHEVROLET", "CORSA"),
    "CELTA": ("CHEVROLET", "CELTA"),
    "CLASSIC": ("CHEVROLET", "CLASSIC"),
    "AGILE": ("CHEVROLET", "AGILE"),
    "CAPTIVA": ("CHEVROLET", "CAPTIVA"),
    "MERIVA": ("CHEVROLET", "MERIVA"),
    "VECTRA": ("CHEVROLET", "VECTRA"),
    "ASTRA": ("CHEVROLET", "ASTRA"),
    "ZAFIRA": ("CHEVROLET", "ZAFIRA"),
    # VOLKSWAGEN
    "GOL": ("VOLKSWAGEN", "GOL"),
    "VOYAGE": ("VOLKSWAGEN", "VOYAGE"),
    "SAVEIRO": ("VOLKSWAGEN", "SAVEIRO"),
    "FOX": ("VOLKSWAGEN", "FOX"),
    "POLO": ("VOLKSWAGEN", "POLO"),
    "VIRTUS": ("VOLKSWAGEN", "VIRTUS"),
    "T-CROSS": ("VOLKSWAGEN", "T-CROSS"),
    "TCROSS": ("VOLKSWAGEN", "T-CROSS"),
    "NIVUS": ("VOLKSWAGEN", "NIVUS"),
    "JETTA": ("VOLKSWAGEN", "JETTA"),
    "TIGUAN": ("VOLKSWAGEN", "TIGUAN"),
    "AMAROK": ("VOLKSWAGEN", "AMAROK"),
    "UP": ("VOLKSWAGEN", "UP"),
    "GOLF": ("VOLKSWAGEN", "GOLF"),
    "TAOS": ("VOLKSWAGEN", "TAOS"),
    # FIAT
    "PALIO": ("FIAT", "PALIO"),
    "UNO": ("FIAT", "UNO"),
    "SIENA": ("FIAT", "SIENA"),
    "ARGO": ("FIAT", "ARGO"),
    "CRONOS": ("FIAT", "CRONOS"),
    "MOBI": ("FIAT", "MOBI"),
    "TORO": ("FIAT", "TORO"),
    "STRADA": ("FIAT", "STRADA"),
    "DOBLO": ("FIAT", "DOBLO"),
    "DUCATO": ("FIAT", "DUCATO"),
    "PUNTO": ("FIAT", "PUNTO"),
    "BRAVO": ("FIAT", "BRAVO"),
    "FREEMONT": ("FIAT", "FREEMONT"),
    "LINEA": ("FIAT", "LINEA"),
    "GRAND SIENA": ("FIAT", "GRAND SIENA"),
    "IDEA": ("FIAT", "IDEA"),
    "WEEKEND": ("FIAT", "WEEKEND"),
    "PULSE": ("FIAT", "PULSE"),
    "FASTBACK": ("FIAT", "FASTBACK"),
    "FIORINO": ("FIAT", "FIORINO"),
    # FORD
    "KA": ("FORD", "KA"),
    "FIESTA": ("FORD", "FIESTA"),
    "FOCUS": ("FORD", "FOCUS"),
    "ECOSPORT": ("FORD", "ECOSPORT"),
    "RANGER": ("FORD", "RANGER"),
    "FUSION": ("FORD", "FUSION"),
    "TERRITORY": ("FORD", "TERRITORY"),
    "BRONCO": ("FORD", "BRONCO"),
    "MAVERICK": ("FORD", "MAVERICK"),
    # TOYOTA
    "COROLLA": ("TOYOTA", "COROLLA"),
    "COROLLA CROSS": ("TOYOTA", "COROLLA CROSS"),
    "YARIS": ("TOYOTA", "YARIS"),
    "ETIOS": ("TOYOTA", "ETIOS"),
    "HILUX": ("TOYOTA", "HILUX"),
    "SW4": ("TOYOTA", "SW4"),
    "RAV4": ("TOYOTA", "RAV4"),
    "CAMRY": ("TOYOTA", "CAMRY"),
    "PRIUS": ("TOYOTA", "PRIUS"),
    # HONDA
    "CIVIC": ("HONDA", "CIVIC"),
    "FIT": ("HONDA", "FIT"),
    "CITY": ("HONDA", "CITY"),
    "HRV": ("HONDA", "HR-V"),
    "HR-V": ("HONDA", "HR-V"),
    "CRV": ("HONDA", "CR-V"),
    "CR-V": ("HONDA", "CR-V"),
    "WRV": ("HONDA", "WR-V"),
    "WR-V": ("HONDA", "WR-V"),
    "ACCORD": ("HONDA", "ACCORD"),
    # HYUNDAI
    "HB20": ("HYUNDAI", "HB20"),
    "HB20S": ("HYUNDAI", "HB20S"),
    "CRETA": ("HYUNDAI", "CRETA"),
    "TUCSON": ("HYUNDAI", "TUCSON"),
    "IX35": ("HYUNDAI", "IX35"),
    "AZERA": ("HYUNDAI", "AZERA"),
    "SANTA FE": ("HYUNDAI", "SANTA FE"),
    "VELOSTER": ("HYUNDAI", "VELOSTER"),
    # NISSAN
    "KICKS": ("NISSAN", "KICKS"),
    "VERSA": ("NISSAN", "VERSA"),
    "SENTRA": ("NISSAN", "SENTRA"),
    "MARCH": ("NISSAN", "MARCH"),
    "FRONTIER": ("NISSAN", "FRONTIER"),
    "LIVINA": ("NISSAN", "LIVINA"),
    # RENAULT
    "KWID": ("RENAULT", "KWID"),
    "DUSTER": ("RENAULT", "DUSTER"),
    "SANDERO": ("RENAULT", "SANDERO"),
    "LOGAN": ("RENAULT", "LOGAN"),
    "CAPTUR": ("RENAULT", "CAPTUR"),
    "OROCH": ("RENAULT", "OROCH"),
    "FLUENCE": ("RENAULT", "FLUENCE"),
    "MEGANE": ("RENAULT", "MEGANE"),
    "CLIO": ("RENAULT", "CLIO"),
    # JEEP
    "RENEGADE": ("JEEP", "RENEGADE"),
    "COMPASS": ("JEEP", "COMPASS"),
    "COMMANDER": ("JEEP", "COMMANDER"),
    # MITSUBISHI
    "L200": ("MITSUBISHI", "L200"),
    "PAJERO": ("MITSUBISHI", "PAJERO"),
    "ASX": ("MITSUBISHI", "ASX"),
    "OUTLANDER": ("MITSUBISHI", "OUTLANDER"),
    "ECLIPSE CROSS": ("MITSUBISHI", "ECLIPSE CROSS"),
    # PEUGEOT / CITROEN
    "C3": ("CITROEN", "C3"),
    "C4": ("CITROEN", "C4"),
    "208": ("PEUGEOT", "208"),
    "2008": ("PEUGEOT", "2008"),
    "3008": ("PEUGEOT", "3008"),
    # SUZUKI
    "JIMNY": ("SUZUKI", "JIMNY"),
    "VITARA": ("SUZUKI", "VITARA"),
    "SWIFT": ("SUZUKI", "SWIFT"),
}

# Modelos longos primeiro para evitar match parcial ("ONIX PLUS" antes de "ONIX")
_MODELS_BY_LEN = sorted(MODEL_TO_MAKE.keys(), key=len, reverse=True)

# Regex para anos (2005-2029) em contexto automotivo
YEAR_RE = re.compile(r"\b(20[0-2]\d)\b")
# Padrão "12/18" = 2012 a 2018
YEAR_RANGE_RE = re.compile(r"\b(\d{2})/(\d{2})\b")


def extract_vehicle(text: str) -> dict:
    """Extrai marca, modelo e ano de uma descrição de peça."""
    if not text:
        return {"marca": None, "modelo": None, "ano_de": None, "ano_ate": None}

    upper = text.upper()
    marca = None
    modelo = None
    ano_de = None
    ano_ate = None

    # Tentar modelo primeiro (mais específico)
    for model_key in _MODELS_BY_LEN:
        pattern = r"\b" + re.escape(model_key) + r"\b"
        if re.search(pattern, upper):
            make, normalized_model = MODEL_TO_MAKE[model_key]
            marca = make
            modelo = normalized_model
            break

    # Se não achou modelo, tenta marca genérica
    if not marca:
        for kw, normalized_make in VEHICLE_MAKES.items():
            pattern = r"\b" + re.escape(kw) + r"\b"
            if re.search(pattern, upper):
                marca = normalized_make
                break

    # Extrair anos
    # Primeiro tentar padrão "12/18" (abreviado)
    range_match = YEAR_RANGE_RE.search(text)
    if range_match:
        y1 = int(range_match.group(1))
        y2 = int(range_match.group(2))
        if 5 <= y1 <= 29 and 5 <= y2 <= 29:
            ano_de = 2000 + y1
            ano_ate = 2000 + y2

    # Senão, tentar anos completos
    if not ano_de:
        years = [int(y) for y in YEAR_RE.findall(text) if 2005 <= int(y) <= 2029]
        if years:
            ano_de = min(years)
            if len(years) > 1:
                ano_ate = max(years)

    return {"marca": marca, "modelo": modelo, "ano_de": ano_de, "ano_ate": ano_ate}


# ─────────────────────────────────────────────────────────────────────────────
# 4. LIMPEZA DE DESCRIÇÃO
# ─────────────────────────────────────────────────────────────────────────────

# Prefixo de fornecedor: (121 - 48216) -CAPO ONIX 2017
SUPPLIER_PREFIX_RE = re.compile(r"^\(\d+\s*-\s*[^)]+\)\s*-\s*")
# Prefixo <N>(...)
N_PREFIX_RE = re.compile(r"^<N>\(([^)]+)\)")
# Chars especiais no início
LEADING_JUNK_RE = re.compile(r"^[*.\-\s]+")
# Código numérico longo no início (tipo "10012101677")
LEADING_CODE_RE = re.compile(r"^\d{6,}\s+")
# Detalhe complementar entre parênteses — ex: "FAROL(FAROL DIANTEIRO LD CROMADO)"
PAREN_DETAIL_RE = re.compile(r"^([^(]+)\(([^)]+)\)\s*$")
# Abreviações comuns
ABBREVIATION_MAP = {
    "DT": "DIANTEIRO",
    "DT.": "DIANTEIRO",
    "DIANT": "DIANTEIRO",
    "DIANT.": "DIANTEIRO",
    "TRAS": "TRASEIRO",
    "TRAS.": "TRASEIRO",
    "ESQ": "ESQUERDO",
    "ESQ.": "ESQUERDO",
    "DIR": "DIREITO",
    "DIR.": "DIREITO",
    "LD": "DIREITO",
    "LD.": "DIREITO",
    "LE": "ESQUERDO",
    "LE.": "ESQUERDO",
    "SUP": "SUPERIOR",
    "SUP.": "SUPERIOR",
    "INF": "INFERIOR",
    "INF.": "INFERIOR",
    "INT": "INTERNO",
    "INT.": "INTERNO",
    "EXT": "EXTERNO",
    "EXT.": "EXTERNO",
    "P/CHOQUE": "PARA-CHOQUE",
    "P-CHOQUE": "PARA-CHOQUE",
    "PCH": "PARA-CHOQUE",
    "P/CHOQ": "PARA-CHOQUE",
    "CAPU": "CAPÔ",
    "PTA": "PORTA",
}

# Lateralidade normalization — "(A)" suffix = ambos os lados
LATERALITY_RE = re.compile(r"\(A\)\s*$", re.IGNORECASE)


def clean_description(raw: str) -> str:
    """Normaliza uma descrição de peça."""
    if not raw or pd.isna(raw):
        return ""

    text = str(raw).strip()

    # 1. Remover prefixo <N>(...)  → manter conteúdo
    m = N_PREFIX_RE.match(text)
    if m:
        text = m.group(1).strip()

    # 2. Remover prefixo de fornecedor (121 - CODE) -
    text = SUPPLIER_PREFIX_RE.sub("", text)

    # 3. Remover chars especiais no início
    text = LEADING_JUNK_RE.sub("", text)

    # 4. Remover código numérico longo no início
    text = LEADING_CODE_RE.sub("", text)

    # 5. Se tem formato "NOME_CURTO(DETALHE LONGO)", usar o detalhe longo
    m = PAREN_DETAIL_RE.match(text)
    if m:
        short_name = m.group(1).strip()
        detail = m.group(2).strip()
        # Usar o detalhe se for mais descritivo (mais longo)
        if len(detail) > len(short_name):
            text = detail
        else:
            text = short_name

    # 6. Uppercase e normalizar espaços
    text = text.upper().strip()
    text = re.sub(r"\s+", " ", text)

    # 7. Remover "(A)" de lateralidade — "PARALAMA ESQUERDO(A)" → "PARALAMA ESQUERDO"
    text = LATERALITY_RE.sub("", text).strip()

    # 8. Remover trailing " - -" ou similar
    text = re.sub(r"[\s\-]+$", "", text)

    return text


def categorize(description: str, ncm: str | None) -> str:
    """Categoriza uma peça por keywords na descrição ou NCM."""
    desc_upper = description.upper() if description else ""

    # Regra especial: RADIADOR — "GRADE DO RADIADOR" é carroceria, "RADIADOR" sozinho é arrefecimento
    if "RADIADOR" in desc_upper:
        body_context = any(w in desc_upper for w in ["GRADE", "MOLDURA", "FRISO", "SUPORTE"])
        if body_context:
            return "CARROCERIA"
        return "ARREFECIMENTO_AR"

    # Tentar por keywords na descrição
    for category, keywords in CATEGORY_RULES:
        for kw in keywords:
            if kw.upper() in desc_upper:
                return category

    # Fallback por NCM
    if ncm:
        ncm_str = str(int(float(ncm))) if not pd.isna(ncm) else ""
        for prefix, cat in NCM_CATEGORY_MAP.items():
            if ncm_str.startswith(prefix):
                return cat

    return "OUTROS"


# ─────────────────────────────────────────────────────────────────────────────
# 5. DETECÇÃO DE CÓDIGOS FABRICANTE LIXO
# ─────────────────────────────────────────────────────────────────────────────
GARBAGE_CODE_PATTERNS = [
    re.compile(r"^0+\d{0,4}$"),       # 0000001, 0000002
    re.compile(r"^MM\d{3,4}$"),        # MM0001
    re.compile(r"^E \d{4}$"),          # E 0101
    re.compile(r"^0?[12]$"),           # 01, 02, 1, 2
    re.compile(r"^0+$"),              # 0000
    re.compile(r"^CG\d{2}$"),         # CG01, CG02 (carga de gás genérica)
]

# Códigos com muitas descrições diferentes = provavelmente lixo
MAX_DESCRIPTIONS_PER_CODE = 4


def is_garbage_code(code: str) -> bool:
    """Verifica se um código fabricante é placeholder/lixo."""
    if not code or pd.isna(code):
        return True
    code_str = str(code).strip()
    if not code_str:
        return True
    return any(p.match(code_str) for p in GARBAGE_CODE_PATTERNS)


# ─────────────────────────────────────────────────────────────────────────────
# 6. NORMALIZAÇÃO DE FORNECEDORES
# ─────────────────────────────────────────────────────────────────────────────
SUPPLIER_NORMALIZE = {
    "A ALVES DE SOUSA IND COM DE MOTOS EIRELI": "A ALVES DE SOUSA",
    "A ALVES DE SOUSA IND E COM DE MOTOS LTDA": "A ALVES DE SOUSA",
    "PMZ DISTRIBUIDORA S.A": "PMZ DISTRIBUIDORA",
    "PMZ DISTRIBUIDORA S.A.": "PMZ DISTRIBUIDORA",
    "FORTBRAS AUTOPECAS S.A.": "FORTBRAS",
    "FORTBRAS AUTOPECAS S.A": "FORTBRAS",
    "KC JOBIM COMERCIO DE TINTAS LTDA": "KC JOBIM TINTAS",
    "MG VIDROS AUTOMOTIVOS LTDA": "MG VIDROS",
    "MURANO VEICULOS LTDA": "MURANO VEICULOS",
    "RZD COMERCIO DE VEICULOS LTDA": "RZD VEICULOS",
    "VIA MARCONI VEICULOS LTDA": "VIA MARCONI",
    "DIAMANTINO & CIA LTDA": "DIAMANTINO",
    "H.F.R. ALBUQUERQUE & CIA LTDA": "HFR ALBUQUERQUE",
    "J.G.RODRIGUES E CIA.LTDA.": "JG RODRIGUES",
    "LUMI COMERCIO VAREJISTA DE PECAS AUTOMOTIVO LTDA": "LUMI AUTOPEÇAS",
    "GREEN BRASIL COM. DE PECAS P/ VEIC. AUT": "GREEN BRASIL",
    "PHD Tintas do Brasil LTDA": "PHD TINTAS",
    "IRMAOS BRITO DISTR. COM. DE MAT. CONSTRUCAO E SERVICOS LTDA": "IRMÃOS BRITO",
    "SHIZEN VEICULOS LTDA": "SHIZEN VEICULOS",
    "IRMAOS DIAMANTINO COMERCIO DE VEICULOS E UTILITARIOS LTDA": "IRMÃOS DIAMANTINO",
    "CASA DOS PARA-BRISAS LTDA": "CASA DOS PARA-BRISAS",
    "AMERICA VEICULOS S/A": "AMERICA VEICULOS",
    "AMAZON COMERCIO DE AUTOMOVEIS LTDA.": "AMAZON AUTOMOVEIS",
    "BRAGA MOTORS LTDA": "BRAGA MOTORS",
    "BRAGA VEICULOS LTDA": "BRAGA VEICULOS",
    "FELICIO VIGORITO E FILHOS LTDA": "FELICIO VIGORITO",
    "FIORI VEICOLO SA": "FIORI VEICOLO",
}


def normalize_supplier(raw: str | None) -> str | None:
    """Normaliza nome do fornecedor."""
    if not raw or pd.isna(raw):
        return None
    raw = str(raw).strip()
    return SUPPLIER_NORMALIZE.get(raw, raw)


# ─────────────────────────────────────────────────────────────────────────────
# PIPELINE PRINCIPAL
# ─────────────────────────────────────────────────────────────────────────────

def run() -> None:
    logger.info("Lendo %s ...", INPUT_FILE)
    df = pd.read_excel(INPUT_FILE)
    logger.info("Total de registros: %d", len(df))

    # ── Passo 1: Normalizar unidades ──
    df["unidade_norm"] = df["Unidade"].map(UNIT_MAP).fillna("UN")
    logger.info("Unidades normalizadas")

    # ── Passo 2: Limpar descrição ──
    df["descricao_limpa"] = df["Descrição"].apply(clean_description)
    # Usar Descrição Complementar quando disponível e mais longa
    for idx, row in df.iterrows():
        comp = row.get("Descrição Complementar")
        if comp and not pd.isna(comp):
            comp_clean = clean_description(comp)
            if len(comp_clean) > len(df.at[idx, "descricao_limpa"]):
                df.at[idx, "descricao_limpa"] = comp_clean
    logger.info("Descrições limpas")

    # ── Passo 3: Identificar códigos lixo ──
    # Primeiro: códigos que pattern-match como garbage
    df["codigo_fab"] = df["Código Fabricante"].astype(str).where(df["Código Fabricante"].notna(), None)
    df["codigo_lixo"] = df["codigo_fab"].apply(is_garbage_code)

    # Segundo: códigos com muitas descrições diferentes
    code_desc_counts = df[~df["codigo_lixo"]].groupby("codigo_fab")["descricao_limpa"].nunique()
    multi_desc_codes = set(code_desc_counts[code_desc_counts > MAX_DESCRIPTIONS_PER_CODE].index)
    df.loc[df["codigo_fab"].isin(multi_desc_codes), "codigo_lixo"] = True

    n_garbage = df["codigo_lixo"].sum()
    logger.info("Códigos lixo identificados: %d / %d", n_garbage, len(df))

    # ── Passo 4: Categorizar ──
    df["categoria"] = df.apply(
        lambda r: categorize(r["descricao_limpa"], r.get("NCM")), axis=1
    )
    logger.info("Categorização:")
    for cat, cnt in df["categoria"].value_counts().items():
        logger.info("  %s: %d", cat, cnt)

    # ── Passo 5: Extrair veículo ──
    vehicle_data = df["Descrição"].apply(lambda d: extract_vehicle(str(d) if d else ""))
    df["veiculo_marca"] = vehicle_data.apply(lambda v: v["marca"])
    df["veiculo_modelo"] = vehicle_data.apply(lambda v: v["modelo"])
    df["veiculo_ano_de"] = vehicle_data.apply(lambda v: v["ano_de"])
    df["veiculo_ano_ate"] = vehicle_data.apply(lambda v: v["ano_ate"])

    n_vehicle = df["veiculo_marca"].notna().sum()
    logger.info("Veículo identificado na descrição: %d / %d (%.1f%%)",
                n_vehicle, len(df), n_vehicle / len(df) * 100)

    # ── Passo 6: Normalizar fornecedores ──
    df["fornecedor_norm"] = df["Fornecedor última compra"].apply(normalize_supplier)

    # ── Passo 7: Normalizar NCM ──
    df["ncm_norm"] = df["NCM"].apply(
        lambda x: str(int(x)).zfill(8) if pd.notna(x) else None
    )

    # ── Passo 8: Deduplicar ──
    # Separar em: com código válido vs sem código / código lixo
    valid_code = df[~df["codigo_lixo"]].copy()
    no_code = df[df["codigo_lixo"]].copy()

    logger.info("Com código válido: %d", len(valid_code))
    logger.info("Sem código / código lixo: %d", len(no_code))

    # Para registros com código válido: agrupar por código fabricante
    # Manter a melhor descrição (mais longa) e consolidar fornecedores/veículos
    def _consolidate(group: pd.DataFrame, code_col: str | None = None) -> dict:
        best_idx = group["descricao_limpa"].str.len().idxmax()
        best = group.loc[best_idx]

        suppliers = group["fornecedor_norm"].dropna().unique()
        marks = group["veiculo_marca"].dropna().unique()
        models = group["veiculo_modelo"].dropna().unique()

        return {
            "codigo_fabricante": best.get(code_col) if code_col else None,
            "descricao": best["descricao_limpa"],
            "descricao_original": best["Descrição"],
            "categoria": best["categoria"],
            "ncm": best["ncm_norm"],
            "unidade": best["unidade_norm"],
            "veiculo_marca": marks[0] if len(marks) > 0 else None,
            "veiculo_modelo": models[0] if len(models) > 0 else None,
            "veiculo_ano_de": group["veiculo_ano_de"].dropna().min() if group["veiculo_ano_de"].notna().any() else None,
            "veiculo_ano_ate": group["veiculo_ano_ate"].dropna().max() if group["veiculo_ano_ate"].notna().any() else None,
            "fornecedores": " | ".join(sorted(set(suppliers))) if len(suppliers) > 0 else None,
            "qtd_registros_originais": len(group),
            "codigo_barras": group["Código Barra"].dropna().iloc[0] if group["Código Barra"].notna().any() else None,
        }

    logger.info("Consolidando por código fabricante...")
    rows_valid = []
    for code, group in valid_code.groupby("codigo_fab"):
        row = _consolidate(group, "codigo_fab")
        rows_valid.append(row)
    catalog_valid = pd.DataFrame(rows_valid)

    logger.info("Consolidando itens sem código...")
    rows_no_code = []
    for desc, group in no_code.groupby("descricao_limpa"):
        row = _consolidate(group)
        rows_no_code.append(row)
    catalog_no_code = pd.DataFrame(rows_no_code)

    # Juntar tudo
    catalog = pd.concat([catalog_valid, catalog_no_code], ignore_index=True)

    # Remover registros com descrição vazia ou muito curta
    catalog = catalog[catalog["descricao"].str.len() >= 3]

    # Ordenar por categoria e descrição
    catalog = catalog.sort_values(["categoria", "descricao"]).reset_index(drop=True)

    # ── Passo 9: Salvar ──
    logger.info("=" * 60)
    logger.info("RESULTADO FINAL")
    logger.info("  Registros originais: %d", len(df))
    logger.info("  Catálogo limpo: %d", len(catalog))
    logger.info("  Redução: %.1f%%", (1 - len(catalog) / len(df)) * 100)
    logger.info("")
    logger.info("  Distribuição por categoria:")
    for cat, cnt in catalog["categoria"].value_counts().items():
        pct = cnt / len(catalog) * 100
        logger.info("    %-25s %5d (%4.1f%%)", cat, cnt, pct)
    logger.info("")
    n_with_vehicle = catalog["veiculo_marca"].notna().sum()
    logger.info("  Com veículo identificado: %d (%.1f%%)",
                n_with_vehicle, n_with_vehicle / len(catalog) * 100)
    n_with_code = catalog["codigo_fabricante"].notna().sum()
    logger.info("  Com código fabricante: %d (%.1f%%)",
                n_with_code, n_with_code / len(catalog) * 100)

    # Sanitizar strings — remover caracteres de controle ilegais em Excel
    ILLEGAL_CHARS_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")
    for col in catalog.select_dtypes(include=["object"]).columns:
        catalog[col] = catalog[col].apply(
            lambda v: ILLEGAL_CHARS_RE.sub("", str(v)) if pd.notna(v) and isinstance(v, str) else v
        )

    # Salvar em Excel com formatação
    with pd.ExcelWriter(OUTPUT_FILE, engine="openpyxl") as writer:
        catalog.to_excel(writer, sheet_name="Catálogo", index=False)

        # Sheet separada com stats
        stats = pd.DataFrame({
            "Métrica": [
                "Registros originais",
                "Catálogo limpo",
                "Redução %",
                "Com código fabricante",
                "Com veículo identificado",
                "Categorias",
            ],
            "Valor": [
                len(df),
                len(catalog),
                f"{(1 - len(catalog) / len(df)) * 100:.1f}%",
                n_with_code,
                n_with_vehicle,
                catalog["categoria"].nunique(),
            ]
        })
        stats.to_excel(writer, sheet_name="Resumo", index=False)

        # Sheet com itens que precisam de atenção (sem código + sem veículo)
        needs_attention = catalog[
            (catalog["codigo_fabricante"].isna()) &
            (catalog["veiculo_marca"].isna())
        ]
        needs_attention.to_excel(writer, sheet_name="Precisa Atenção", index=False)

    logger.info("")
    logger.info("Arquivo salvo: %s", OUTPUT_FILE)
    logger.info("Sheets: Catálogo, Resumo, Precisa Atenção")


if __name__ == "__main__":
    run()
