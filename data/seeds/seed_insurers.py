"""
Seed: cria as seguradoras padrão da DS Car no tenant ativo.

Uso:
    python manage.py shell -c "from data.seeds.seed_insurers import run; run()"
    ou
    python manage.py shell < data/seeds/seed_insurers.py
"""
from django_tenants.utils import schema_context

INSURERS = [
    "Bradesco Seguros",
    "Porto Seguro",
    "Azul Seguros",
    "Itaú Seguros",
    "Mitsui Sumitomo",
    "HDI Seguros",
    "Yelum Seguros",
    "Allianz Seguros",
    "Tokio Marine",
]


def run(tenant_schema: str = "tenant_dscar") -> None:
    """Popula seguradoras padrão se ainda não existirem."""
    from apps.persons.models import Person, PersonRole  # noqa: PLC0415

    with schema_context(tenant_schema):
        for name in INSURERS:
            person, created = Person.objects.get_or_create(
                full_name=name,
                person_kind="PJ",
                defaults={"is_active": True},
            )
            PersonRole.objects.get_or_create(person=person, role="INSURER")
            status = "✓ Criada" if created else "· Já existe"
            print(f"  {status}: {name}")


if __name__ == "__main__":
    run()
