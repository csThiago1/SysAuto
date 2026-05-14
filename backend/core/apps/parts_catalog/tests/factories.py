"""
Paddock Solutions — Parts Catalog Test Factories
"""
import factory
from apps.parts_catalog.models import PartApplication, PartCategory, PartReference, PartSupplierRef


class PartCategoryFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = PartCategory
        django_get_or_create = ("code",)

    code = factory.Sequence(lambda n: f"CAT{n:03d}")
    name = factory.LazyAttribute(lambda o: f"Categoria {o.code}")
    order = factory.Sequence(lambda n: n * 10)


class PartReferenceFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = PartReference
        django_get_or_create = ("manufacturer_code",)

    manufacturer_code = factory.Sequence(lambda n: f"MFG-{n:06d}")
    description = factory.LazyAttribute(lambda o: f"Peça {o.manufacturer_code}")
    category = factory.SubFactory(PartCategoryFactory)
    ncm = "87082999"
    unit = "PC"


class PartApplicationFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = PartApplication

    part_ref = factory.SubFactory(PartReferenceFactory)
    make = factory.LazyFunction(lambda: _get_or_create_make())
    source = "manual"
    confidence_score = 100


class PartSupplierRefFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = PartSupplierRef

    part_ref = factory.SubFactory(PartReferenceFactory)
    supplier_name = factory.Sequence(lambda n: f"Fornecedor {n}")


def _get_or_create_make():
    from apps.vehicle_catalog.models import VehicleMake

    make, _ = VehicleMake.objects.get_or_create(
        fipe_id="59",
        defaults={"nome": "CHEVROLET", "nome_normalizado": "chevrolet"},
    )
    return make
