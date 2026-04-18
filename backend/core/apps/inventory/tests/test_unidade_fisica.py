"""
Paddock Solutions — Inventory Tests: UnidadeFisica + ReservaUnidadeService
Motor de Orçamentos (MO) — Sprint MO-5

Requer make dev (Docker + PostgreSQL) para rodar.
"""
import hashlib
from decimal import Decimal

from django_tenants.test.cases import TenantTestCase

from apps.authentication.models import GlobalUser
from apps.inventory.models import UnidadeFisica
from apps.inventory.services.reserva import ReservaIndisponivel, ReservaUnidadeService


# ─── Helpers ──────────────────────────────────────────────────────────────────


def make_user(email: str = "inv-test@example.com") -> GlobalUser:
    email_hash = hashlib.sha256(email.lower().encode()).hexdigest()
    user, _ = GlobalUser.objects.get_or_create(
        email_hash=email_hash,
        defaults={"email": email, "name": "Inv Test User"},
    )
    return user


def make_peca_canonica(codigo: str = "peca-test-001") -> object:
    from apps.pricing_catalog.models import PecaCanonica
    p, _ = PecaCanonica.objects.get_or_create(
        codigo=codigo,
        defaults={"nome": f"Peça {codigo}", "tipo_peca": "genuina"},
    )
    return p


def make_service_order(number: int = 9001) -> object:
    """Cria uma ServiceOrder mínima para uso nos testes de reserva."""
    from apps.service_orders.models import ServiceOrder
    os, _ = ServiceOrder.objects.get_or_create(
        number=number,
        defaults={
            "customer_name": "Cliente Teste",
            "plate": "TST0001",
            "make": "VW",
            "model": "Gol",
            "color": "Branco",
            "vehicle_location": "Pátio",
            "status": "open",
        },
    )
    return os


def make_unidade(peca: object, valor_nf: str = "100.00", status: str = "available") -> UnidadeFisica:
    return UnidadeFisica.objects.create(
        peca_canonica=peca,
        valor_nf=Decimal(valor_nf),
        status=status,
    )


# ─── Tests ────────────────────────────────────────────────────────────────────


class TestUnidadeFisicaCriacao(TenantTestCase):
    """Testa criação e geração de codigo_barras."""

    def test_codigo_barras_gerado_automaticamente(self) -> None:
        peca = make_peca_canonica("peca-barras-001")
        u = make_unidade(peca)
        self.assertTrue(u.codigo_barras.startswith("P"))
        self.assertEqual(len(u.codigo_barras), 33)  # "P" + 32 hex chars

    def test_codigo_barras_unico_entre_unidades(self) -> None:
        peca = make_peca_canonica("peca-barras-002")
        u1 = make_unidade(peca, "100.00")
        u2 = make_unidade(peca, "120.00")
        self.assertNotEqual(u1.codigo_barras, u2.codigo_barras)

    def test_codigo_barras_determinístico_prefixo_P(self) -> None:
        peca = make_peca_canonica("peca-barras-003")
        u = make_unidade(peca)
        esperado = f"P{u.pk.hex}"
        self.assertEqual(u.codigo_barras, esperado)


class TestReservaUnidadeService(TenantTestCase):
    """Testa reserva de unidades físicas."""

    def setUp(self) -> None:
        self.os = make_service_order(9001)
        self.os_id = str(self.os.pk)

    def test_reserva_ordena_por_valor_asc_default(self) -> None:
        """Menor valor_nf deve ser reservado primeiro (default)."""
        peca = make_peca_canonica("peca-reserva-001")
        u_caro = make_unidade(peca, "200.00")
        u_barato = make_unidade(peca, "100.00")

        reservadas = ReservaUnidadeService.reservar(
            peca_canonica_id=str(peca.pk),
            quantidade=1,
            ordem_servico_id=self.os_id,
        )
        self.assertEqual(len(reservadas), 1)
        self.assertEqual(reservadas[0].pk, u_barato.pk)

        u_barato.refresh_from_db()
        u_caro.refresh_from_db()
        self.assertEqual(u_barato.status, "reserved")
        self.assertEqual(u_caro.status, "available")

    def test_reserva_com_forcar_mais_caro_ordena_desc(self) -> None:
        """forcar_mais_caro=True deve reservar o mais caro primeiro (A6)."""
        peca = make_peca_canonica("peca-reserva-002")
        u_caro = make_unidade(peca, "300.00")
        u_barato = make_unidade(peca, "150.00")

        reservadas = ReservaUnidadeService.reservar(
            peca_canonica_id=str(peca.pk),
            quantidade=1,
            ordem_servico_id=self.os_id,
            forcar_mais_caro=True,
        )
        self.assertEqual(reservadas[0].pk, u_caro.pk)

    def test_reserva_quantidade_insuficiente_raises(self) -> None:
        """Deve levantar ReservaIndisponivel se não há unidades suficientes."""
        peca = make_peca_canonica("peca-reserva-003")
        make_unidade(peca, "100.00")  # só 1 unidade

        with self.assertRaises(ReservaIndisponivel):
            ReservaUnidadeService.reservar(
                peca_canonica_id=str(peca.pk),
                quantidade=5,  # pede 5
                ordem_servico_id=self.os_id,
            )

    def test_reserva_nao_pega_unidades_ja_reservadas(self) -> None:
        """Unidades já reservadas não devem ser reservadas novamente."""
        peca = make_peca_canonica("peca-reserva-004")
        make_unidade(peca, "100.00", status="reserved")  # já reservada

        with self.assertRaises(ReservaIndisponivel):
            ReservaUnidadeService.reservar(
                peca_canonica_id=str(peca.pk),
                quantidade=1,
                ordem_servico_id=self.os_id,
            )

    def test_bipagem_resolve_codigo_barras(self) -> None:
        """Bipagem deve encontrar unidade por codigo_barras e reservar."""
        peca = make_peca_canonica("peca-bipagem-001")
        u = make_unidade(peca, "100.00")
        codigo = u.codigo_barras

        resultado = ReservaUnidadeService.baixar_por_bipagem(
            codigo_barras=codigo,
            ordem_servico_id=self.os_id,
        )
        u.refresh_from_db()
        self.assertEqual(u.status, "reserved")
        self.assertEqual(resultado.pk, u.pk)
