"""
Paddock Solutions — Parts Catalog Model Tests

Cobre unicidade de código/fabricante, __str__ de todos os modelos e
unicidade das constraints compostas de PartApplication e PartSupplierRef.
"""
import pytest
from django.db import IntegrityError

from apps.parts_catalog.models import PartApplication, PartCategory, PartReference, PartSupplierRef

from .factories import (
    PartApplicationFactory,
    PartCategoryFactory,
    PartReferenceFactory,
    PartSupplierRefFactory,
    _get_or_create_make,
)

pytestmark = pytest.mark.django_db(databases=["default"])


class TestPartCategory:
    """Testes de criação e unicidade de PartCategory."""

    def test_create_and_str(self) -> None:
        cat = PartCategoryFactory(code="CARROCERIA", name="Carroceria")
        assert str(cat) == "Carroceria"

    def test_unique_code_constraint(self) -> None:
        PartCategoryFactory(code="MOTOR")
        with pytest.raises(IntegrityError):
            PartCategory.objects.create(code="MOTOR", name="Motor Duplicado", order=999)


class TestPartReference:
    """Testes de criação e unicidade de PartReference."""

    def test_create_and_str(self) -> None:
        ref = PartReferenceFactory(manufacturer_code="52058207", description="Para-choque dianteiro")
        assert "52058207" in str(ref)
        assert "Para-choque dianteiro" in str(ref)

    def test_unique_manufacturer_code_constraint(self) -> None:
        cat = PartCategoryFactory(code="ILUM")
        PartReferenceFactory(manufacturer_code="MFG-DUP-001")
        with pytest.raises(IntegrityError):
            PartReference.objects.create(
                manufacturer_code="MFG-DUP-001",
                description="Duplicado",
                category=cat,
            )


class TestPartApplication:
    """Testes de criação, __str__ e unicidade de PartApplication."""

    def test_create_and_str_with_year(self) -> None:
        app = PartApplicationFactory(year_start=2018, year_end=2022)
        result = str(app)
        assert "2018" in result
        assert "2022" in result
        assert app.part_ref.manufacturer_code in result
        assert app.make.nome in result

    def test_str_without_year(self) -> None:
        app = PartApplicationFactory(year_start=None, year_end=None)
        result = str(app)
        assert app.make.nome in result

    def test_unique_constraint_same_part_make_model_source(self) -> None:
        """Mesma combinação part_ref + make + model + source deve lançar IntegrityError."""
        make = _get_or_create_make()
        ref = PartReferenceFactory()
        PartApplication.objects.create(
            part_ref=ref,
            make=make,
            model=None,
            source=PartApplication.Source.MANUAL,
            confidence_score=100,
        )
        with pytest.raises(IntegrityError):
            PartApplication.objects.create(
                part_ref=ref,
                make=make,
                model=None,
                source=PartApplication.Source.MANUAL,
                confidence_score=100,
            )


class TestPartSupplierRef:
    """Testes de criação, __str__ e unicidade de PartSupplierRef."""

    def test_create_and_str(self) -> None:
        supplier = PartSupplierRefFactory(supplier_name="PMZ DISTRIBUIDORA")
        result = str(supplier)
        assert "PMZ DISTRIBUIDORA" in result
        assert supplier.part_ref.manufacturer_code in result

    def test_unique_constraint_same_part_supplier_name(self) -> None:
        """Mesma combinação part_ref + supplier_name deve lançar IntegrityError."""
        ref = PartReferenceFactory()
        PartSupplierRef.objects.create(part_ref=ref, supplier_name="FORTBRAS")
        with pytest.raises(IntegrityError):
            PartSupplierRef.objects.create(part_ref=ref, supplier_name="FORTBRAS")
