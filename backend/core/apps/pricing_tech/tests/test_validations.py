"""
Paddock Solutions — Pricing Tech Tests: Validações de Modelo
Motor de Orçamentos (MO) — Sprint MO-4: Ficha Técnica Versionada

Testa validações de FichaTecnicaInsumo.clean() e validators de campos decimais.
"""
import hashlib
import logging
from decimal import Decimal

from django.core.exceptions import ValidationError
from django_tenants.test.cases import TenantTestCase

from apps.authentication.models import GlobalUser
from apps.pricing_catalog.models import (
    CategoriaMaoObra,
    CategoriaServico,
    MaterialCanonico,
    ServicoCanonico,
)
from apps.pricing_tech.models import (
    FichaTecnicaInsumo,
    FichaTecnicaMaoObra,
    FichaTecnicaServico,
)

logger = logging.getLogger(__name__)


# ─── Helpers de fixture ────────────────────────────────────────────────────────


def make_user(email: str = "val-test@example.com") -> GlobalUser:
    email_hash = hashlib.sha256(email.lower().encode()).hexdigest()
    user, _ = GlobalUser.objects.get_or_create(
        email_hash=email_hash,
        defaults={"email": email, "name": "Validation Test User"},
    )
    return user


def make_ficha_base() -> tuple[FichaTecnicaServico, CategoriaMaoObra, MaterialCanonico]:
    """Cria os objetos base necessários para os testes de validação."""
    cat_svc, _ = CategoriaServico.objects.get_or_create(
        codigo="val-cat",
        defaults={"nome": "Categoria Validação", "ordem": 99},
    )
    svc, _ = ServicoCanonico.objects.get_or_create(
        codigo="servico-val-test",
        defaults={
            "nome": "Serviço Validação",
            "categoria": cat_svc,
            "unidade": "un",
        },
    )
    user = make_user()
    ficha = FichaTecnicaServico.objects.create(
        servico=svc,
        tipo_pintura=None,
        versao=1,
        is_active=True,
        criada_por=user,
        motivo_nova_versao="Ficha para testes de validação",
    )
    cat_mo, _ = CategoriaMaoObra.objects.get_or_create(
        codigo="pintor-val",
        defaults={"nome": "Pintor Val", "ordem": 99},
    )
    # Material base com unidade_base="L"
    material, _ = MaterialCanonico.objects.get_or_create(
        codigo="tinta-val-test",
        defaults={
            "nome": "Tinta Validação",
            "unidade_base": "L",
            "tipo": "consumivel",
        },
    )
    return ficha, cat_mo, material


# ─── Tests: FichaTecnicaInsumo.unidade == material.unidade_base ────────────────


class TestFichaTecnicaInsumoValidacao(TenantTestCase):
    """Testa que FichaTecnicaInsumo.clean() valida unidade vs unidade_base."""

    def setUp(self) -> None:
        super().setUp()
        self.ficha, self.cat_mo, self.material = make_ficha_base()

    def test_unidade_correta_nao_levanta_erro(self) -> None:
        """Unidade igual à unidade_base do material não deve levantar ValidationError."""
        insumo = FichaTecnicaInsumo(
            ficha=self.ficha,
            material_canonico=self.material,
            quantidade=Decimal("0.30"),
            unidade="L",  # correto
            afetado_por_tamanho=True,
        )

        # Não deve levantar exceção
        insumo.full_clean()
        insumo.save()
        self.assertIsNotNone(insumo.pk)

    def test_unidade_errada_levanta_validation_error(self) -> None:
        """Unidade diferente da unidade_base do material deve levantar ValidationError."""
        insumo = FichaTecnicaInsumo(
            ficha=self.ficha,
            material_canonico=self.material,
            quantidade=Decimal("0.30"),
            unidade="kg",  # ERRADO — material tem unidade_base="L"
            afetado_por_tamanho=True,
        )

        with self.assertRaises(ValidationError) as ctx:
            insumo.full_clean()

        # Deve mencionar a unidade incorreta
        error_message = str(ctx.exception)
        self.assertIn("unidade", error_message.lower())

    def test_unidade_case_sensitive(self) -> None:
        """Unidade deve casar exatamente (case-sensitive) com unidade_base."""
        # "l" (minúsculo) != "L" (maiúsculo)
        insumo = FichaTecnicaInsumo(
            ficha=self.ficha,
            material_canonico=self.material,
            quantidade=Decimal("0.30"),
            unidade="l",  # Case diferente
            afetado_por_tamanho=True,
        )

        with self.assertRaises(ValidationError):
            insumo.full_clean()

    def test_unidade_com_material_kg(self) -> None:
        """Material com unidade_base='kg' aceita 'kg' e rejeita 'L'."""
        material_kg, _ = MaterialCanonico.objects.get_or_create(
            codigo="massa-polies-val",
            defaults={
                "nome": "Massa Poliéster Val",
                "unidade_base": "kg",
                "tipo": "consumivel",
            },
        )

        # Correto: kg
        insumo_ok = FichaTecnicaInsumo(
            ficha=self.ficha,
            material_canonico=material_kg,
            quantidade=Decimal("0.50"),
            unidade="kg",
            afetado_por_tamanho=True,
        )
        insumo_ok.full_clean()  # não deve levantar

        # Errado: L
        insumo_errado = FichaTecnicaInsumo(
            ficha=self.ficha,
            material_canonico=material_kg,
            quantidade=Decimal("0.50"),
            unidade="L",  # ERRADO
            afetado_por_tamanho=True,
        )
        with self.assertRaises(ValidationError):
            insumo_errado.full_clean()


# ─── Tests: Validators de campos decimais ─────────────────────────────────────


class TestFichaTecnicaMaoObraValidacao(TenantTestCase):
    """Testa validators de FichaTecnicaMaoObra.horas (MinValueValidator)."""

    def setUp(self) -> None:
        super().setUp()
        self.ficha, self.cat_mo, _ = make_ficha_base()

    def test_horas_minimas_validas(self) -> None:
        """0.01 hora deve ser aceita (valor mínimo válido)."""
        mo = FichaTecnicaMaoObra(
            ficha=self.ficha,
            categoria=self.cat_mo,
            horas=Decimal("0.01"),
            afetada_por_tamanho=True,
        )
        mo.full_clean()  # não deve levantar

    def test_horas_zero_invalido(self) -> None:
        """0 horas deve ser rejeitado pelo MinValueValidator."""
        mo = FichaTecnicaMaoObra(
            ficha=self.ficha,
            categoria=self.cat_mo,
            horas=Decimal("0.00"),
            afetada_por_tamanho=True,
        )
        with self.assertRaises(ValidationError):
            mo.full_clean()

    def test_horas_negativas_invalido(self) -> None:
        """Horas negativas devem ser rejeitadas."""
        mo = FichaTecnicaMaoObra(
            ficha=self.ficha,
            categoria=self.cat_mo,
            horas=Decimal("-1.00"),
            afetada_por_tamanho=True,
        )
        with self.assertRaises(ValidationError):
            mo.full_clean()

    def test_horas_validas_normais(self) -> None:
        """Valor normal de horas (ex: 2.50) deve ser aceito sem erros."""
        mo = FichaTecnicaMaoObra(
            ficha=self.ficha,
            categoria=self.cat_mo,
            horas=Decimal("2.50"),
            afetada_por_tamanho=True,
        )
        mo.full_clean()


class TestFichaTecnicaInsumoQuantidade(TenantTestCase):
    """Testa validators de FichaTecnicaInsumo.quantidade (MinValueValidator)."""

    def setUp(self) -> None:
        super().setUp()
        self.ficha, _, self.material = make_ficha_base()

    def test_quantidade_minima_valida(self) -> None:
        """0.0001 deve ser aceito (valor mínimo válido)."""
        insumo = FichaTecnicaInsumo(
            ficha=self.ficha,
            material_canonico=self.material,
            quantidade=Decimal("0.0001"),
            unidade="L",
            afetado_por_tamanho=True,
        )
        insumo.full_clean()  # não deve levantar

    def test_quantidade_zero_invalido(self) -> None:
        """Quantidade 0 deve ser rejeitada pelo MinValueValidator."""
        insumo = FichaTecnicaInsumo(
            ficha=self.ficha,
            material_canonico=self.material,
            quantidade=Decimal("0.0000"),
            unidade="L",
            afetado_por_tamanho=True,
        )
        with self.assertRaises(ValidationError):
            insumo.full_clean()

    def test_quantidade_negativa_invalido(self) -> None:
        """Quantidade negativa deve ser rejeitada."""
        insumo = FichaTecnicaInsumo(
            ficha=self.ficha,
            material_canonico=self.material,
            quantidade=Decimal("-0.30"),
            unidade="L",
            afetado_por_tamanho=True,
        )
        with self.assertRaises(ValidationError):
            insumo.full_clean()
