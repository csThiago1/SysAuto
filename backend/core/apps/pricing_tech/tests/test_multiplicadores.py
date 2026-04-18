"""
Paddock Solutions — Pricing Tech Tests: Multiplicadores
Motor de Orçamentos (MO) — Sprint MO-4: Ficha Técnica Versionada

Testa FichaTecnicaService.aplicar_multiplicadores().
"""
import logging
from decimal import Decimal

from django_tenants.test.cases import TenantTestCase

from apps.pricing_tech.services import FichaResolvida, FichaTecnicaService

logger = logging.getLogger(__name__)


def make_ficha_resolvida(
    horas_mo: str = "2.00",
    qtde_ins: str = "0.30",
    afetada_mo: bool = True,
    afetado_ins: bool = True,
) -> FichaResolvida:
    """Cria uma FichaResolvida sintética para testes de multiplicadores."""
    return FichaResolvida(
        ficha_id="fake-uuid-1234",
        versao=1,
        maos_obra=[
            {
                "categoria_codigo": "pintor",
                "categoria_nome": "Pintor",
                "horas": Decimal(horas_mo),
                "afetada_por_tamanho": afetada_mo,
            }
        ],
        insumos=[
            {
                "material_codigo": "tinta-solida",
                "material_nome": "Tinta Sólida",
                "quantidade": Decimal(qtde_ins),
                "unidade_base": "L",
                "afetado_por_tamanho": afetado_ins,
            }
        ],
    )


class TestAplicarMultiplicadores(TenantTestCase):
    """Testa FichaTecnicaService.aplicar_multiplicadores() em todos os cenários."""

    def test_gate_false_retorna_ficha_inalterada(self) -> None:
        """aplica_multiplicador_tamanho=False deve retornar a ficha sem qualquer mudança."""
        ficha = make_ficha_resolvida(horas_mo="3.00", qtde_ins="0.40")

        resultado = FichaTecnicaService.aplicar_multiplicadores(
            ficha=ficha,
            aplica_multiplicador_tamanho=False,
            multiplicador_insumos=Decimal("1.25"),
            multiplicador_horas=Decimal("1.10"),
        )

        # Mesma instância retornada
        self.assertIs(resultado, ficha)
        self.assertEqual(resultado.maos_obra[0]["horas"], Decimal("3.00"))
        self.assertEqual(resultado.insumos[0]["quantidade"], Decimal("0.40"))

    def test_item_nao_afetado_por_tamanho_mantem_valor_original(self) -> None:
        """Item com afetada_por_tamanho=False não deve ter seu valor alterado."""
        ficha = make_ficha_resolvida(
            horas_mo="1.00",
            qtde_ins="0.50",
            afetada_mo=False,   # não afetada
            afetado_ins=False,  # não afetado
        )

        resultado = FichaTecnicaService.aplicar_multiplicadores(
            ficha=ficha,
            aplica_multiplicador_tamanho=True,
            multiplicador_insumos=Decimal("1.25"),
            multiplicador_horas=Decimal("1.10"),
        )

        # Valores devem ser inalterados
        self.assertEqual(resultado.maos_obra[0]["horas"], Decimal("1.00"))
        self.assertEqual(resultado.insumos[0]["quantidade"], Decimal("0.50"))

    def test_tamanho_medio_multiplicador_um_nao_altera_valores(self) -> None:
        """Multiplicador 1.00/1.00 (tamanho médio) não deve alterar os valores."""
        ficha = make_ficha_resolvida(horas_mo="2.00", qtde_ins="0.30")

        resultado = FichaTecnicaService.aplicar_multiplicadores(
            ficha=ficha,
            aplica_multiplicador_tamanho=True,
            multiplicador_insumos=Decimal("1.00"),
            multiplicador_horas=Decimal("1.00"),
        )

        self.assertEqual(resultado.maos_obra[0]["horas"], Decimal("2.00"))
        self.assertEqual(resultado.insumos[0]["quantidade"], Decimal("0.30"))

    def test_tamanho_suv_aplica_multiplicadores_corretos(self) -> None:
        """SUV/Grande (1.25 insumos / 1.10 horas) deve multiplicar corretamente."""
        ficha = make_ficha_resolvida(
            horas_mo="2.00",
            qtde_ins="0.30",
            afetada_mo=True,
            afetado_ins=True,
        )

        resultado = FichaTecnicaService.aplicar_multiplicadores(
            ficha=ficha,
            aplica_multiplicador_tamanho=True,
            multiplicador_insumos=Decimal("1.25"),
            multiplicador_horas=Decimal("1.10"),
        )

        # 2.00 * 1.10 = 2.20
        self.assertEqual(resultado.maos_obra[0]["horas"], Decimal("2.20"))
        # 0.30 * 1.25 = 0.375
        self.assertEqual(resultado.insumos[0]["quantidade"], Decimal("0.375"))

    def test_nova_instancia_retornada_quando_gate_true(self) -> None:
        """Quando aplica=True, deve retornar nova FichaResolvida, não a original."""
        ficha = make_ficha_resolvida()

        resultado = FichaTecnicaService.aplicar_multiplicadores(
            ficha=ficha,
            aplica_multiplicador_tamanho=True,
            multiplicador_insumos=Decimal("1.10"),
            multiplicador_horas=Decimal("1.05"),
        )

        # Nova instância
        self.assertIsNot(resultado, ficha)
        # ficha_id e versao preservados
        self.assertEqual(resultado.ficha_id, ficha.ficha_id)
        self.assertEqual(resultado.versao, ficha.versao)

    def test_mix_afetado_nao_afetado(self) -> None:
        """Quando há itens afetados e não afetados, cada um deve ser tratado corretamente."""
        ficha = FichaResolvida(
            ficha_id="fake-uuid-mix",
            versao=2,
            maos_obra=[
                {
                    "categoria_codigo": "pintor",
                    "categoria_nome": "Pintor",
                    "horas": Decimal("3.00"),
                    "afetada_por_tamanho": True,  # afetada
                },
                {
                    "categoria_codigo": "eletricista",
                    "categoria_nome": "Eletricista",
                    "horas": Decimal("1.00"),
                    "afetada_por_tamanho": False,  # não afetada
                },
            ],
            insumos=[
                {
                    "material_codigo": "tinta",
                    "material_nome": "Tinta",
                    "quantidade": Decimal("0.40"),
                    "unidade_base": "L",
                    "afetado_por_tamanho": True,  # afetado
                },
                {
                    "material_codigo": "lixa",
                    "material_nome": "Lixa",
                    "quantidade": Decimal("2.00"),
                    "unidade_base": "un",
                    "afetado_por_tamanho": False,  # não afetado
                },
            ],
        )

        resultado = FichaTecnicaService.aplicar_multiplicadores(
            ficha=ficha,
            aplica_multiplicador_tamanho=True,
            multiplicador_insumos=Decimal("1.25"),
            multiplicador_horas=Decimal("1.10"),
        )

        # Pintor: 3.00 * 1.10 = 3.30
        self.assertEqual(resultado.maos_obra[0]["horas"], Decimal("3.30"))
        # Eletricista: 1.00 (não afetado)
        self.assertEqual(resultado.maos_obra[1]["horas"], Decimal("1.00"))

        # Tinta: 0.40 * 1.25 = 0.50
        self.assertEqual(resultado.insumos[0]["quantidade"], Decimal("0.50"))
        # Lixa: 2.00 (não afetada)
        self.assertEqual(resultado.insumos[1]["quantidade"], Decimal("2.00"))

    def test_ficha_sem_itens_nao_quebra(self) -> None:
        """Ficha sem mãos de obra e insumos deve retornar sem erros."""
        ficha_vazia = FichaResolvida(
            ficha_id="fake-uuid-vazia",
            versao=1,
            maos_obra=[],
            insumos=[],
        )

        resultado = FichaTecnicaService.aplicar_multiplicadores(
            ficha=ficha_vazia,
            aplica_multiplicador_tamanho=True,
            multiplicador_insumos=Decimal("1.25"),
            multiplicador_horas=Decimal("1.10"),
        )

        self.assertEqual(resultado.maos_obra, [])
        self.assertEqual(resultado.insumos, [])
