"""Smoke Ciclo 04 — validar pipeline Cilia live com DB migrado.

Requer:
  - CILIA_AUTH_TOKEN configurado em .env (ou export antes de rodar)
  - DATABASE_URL válido + migrations aplicadas
  - Insurer.code=tokio seedado (vem por default da migration 0003_seed_insurers)

Uso:
  cd backend/core
  python manage.py shell < scripts/smoke_ciclo4.py
"""
from apps.imports.services import ImportService


def check(cond, msg):
    print(f"[{'OK' if cond else 'FAIL'}] {msg}")
    assert cond, msg


def main():
    print("=== Smoke Ciclo 04 — Cilia live ===\n")

    # V1 — versão inicial (not_authorized)
    a1 = ImportService.fetch_cilia_budget(
        casualty_number="406571903",
        budget_number="1446508",
        version_number=1,
    )
    check(a1.parsed_ok, f"v1 fetched: {a1.error_message or 'OK'}")
    check(a1.version_created.version_number == 1, "v1 is version 1")
    check(a1.version_created.items.count() == 3, "v1 has 3 items")

    os = a1.service_order
    check(os.customer_type == "SEGURADORA", "OS seguradora")
    check(os.insurer.code == "tokio", "Tokio Marine")
    check(os.casualty_number == "406571903", "casualty ok")

    # V2 — complemento (authorized)
    a2 = ImportService.fetch_cilia_budget(
        casualty_number="406571903",
        budget_number="1446508",
        version_number=2,
    )
    check(a2.parsed_ok, "v2 fetched")
    check(a2.service_order == os, "mesma OS reutilizada")
    check(a2.version_created.version_number == 2, "v2 is version 2")

    # V3 — não existe
    a3 = ImportService.fetch_cilia_budget(
        casualty_number="406571903",
        budget_number="1446508",
        version_number=3,
    )
    check(not a3.parsed_ok and a3.http_status == 404, "v3 returns 404")

    # Events timeline
    events = os.events.all()
    check(
        events.filter(event_type="VERSION_CREATED").count() >= 2,
        "2+ VERSION_CREATED events",
    )
    check(
        events.filter(event_type="IMPORT_RECEIVED").count() >= 2,
        "2+ IMPORT_RECEIVED events",
    )

    # Pareceres — 1 por versão
    check(os.pareceres.count() >= 2, "2+ pareceres (1 por versão)")
    v1_parecer = os.pareceres.filter(flow_number=1).first()
    v2_parecer = os.pareceres.filter(flow_number=2).first()
    check(v1_parecer and v1_parecer.parecer_type == "NEGADO", "v1 NEGADO")
    check(v2_parecer and v2_parecer.parecer_type == "AUTORIZADO", "v2 AUTORIZADO")

    # Snapshot preservado
    check(a2.version_created.raw_payload is not None, "v2 raw_payload salvo")
    check(a2.version_created.report_pdf_base64 != "", "v2 report_pdf_base64 salvo")
    check(a2.version_created.external_budget_id == 17732641, "v2 external_budget_id")

    print(f"\n[DONE] OS {os.os_number} criada com 2 versões Cilia")
    print("⚠ Rode manualmente pra não sujar banco: os.delete()")


main()
