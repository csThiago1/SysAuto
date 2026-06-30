from django.urls import path
from django.http import JsonResponse
from apps.cilia.views import consultar_orcamento


def _debug_parser_sha(_request):
    """Endpoint temporário pra debug do deploy. REMOVER depois."""
    import hashlib, inspect
    from apps.cilia.sources import xml_ifx_parser
    src_file = inspect.getsourcefile(xml_ifx_parser)
    with open(src_file, "rb") as f:
        content = f.read()
    return JsonResponse({
        "file": src_file,
        "size_bytes": len(content),
        "sha256": hashlib.sha256(content).hexdigest(),
        "has_logger": b"logger" in content,
        "first_line": content.split(b"\n", 1)[0].decode("utf-8", "replace"),
    })


def _debug_recalc(_request):
    """Endpoint temporário pra debug do recalculate_version_totals."""
    import hashlib, inspect
    from apps.service_orders.services.versioning_service import _ServiceOrderVersioningMixin
    src = inspect.getsource(_ServiceOrderVersioningMixin.recalculate_version_totals)
    sig = str(inspect.signature(_ServiceOrderVersioningMixin.recalculate_version_totals))
    return JsonResponse({
        "signature": sig,
        "has_source_grand_total_param": "source_grand_total" in src,
        "sha256": hashlib.sha256(src.encode()).hexdigest(),
        "size_bytes": len(src),
    })


def _debug_orders_view(_request):
    """Endpoint temporário pra debug do orders.py view."""
    import hashlib, inspect
    from apps.service_orders.views import orders as orders_mod
    src = inspect.getsource(orders_mod)
    return JsonResponse({
        "has_source_total_call": "source_grand_total=source_total" in src,
        "has_helper": "_apply_parsed_budget_to_order" in src,
        "has_create_resp": "_create_version_and_respond" in src,
        "sha256": hashlib.sha256(src.encode()).hexdigest(),
        "size_bytes": len(src),
    })


@__import__("django.views.decorators.csrf", fromlist=["csrf_exempt"]).csrf_exempt
def _debug_parse_xml(request):
    """Endpoint que aceita upload de XML e retorna source_grand_total do parse."""
    if request.method != "POST" or "file" not in request.FILES:
        return JsonResponse({"detail": "POST com file"}, status=400)
    from apps.cilia.sources.xml_ifx_parser import XmlIfxParser
    xml_bytes = request.FILES["file"].read()
    parsed = XmlIfxParser.parse(xml_bytes, insurer_code="soma")
    return JsonResponse({
        "source_parts_total": str(parsed.source_parts_total),
        "source_services_total": str(parsed.source_services_total),
        "source_grand_total": str(parsed.source_grand_total),
        "franchise_amount": str(parsed.franchise_amount),
        "casualty_number": parsed.casualty_number,
        "items_count": len(parsed.items),
    })


app_name = "cilia"

urlpatterns = [
    path("consultar/", consultar_orcamento, name="cilia-consultar"),
    path("debug/parser-sha/", _debug_parser_sha, name="cilia-debug-parser-sha"),
    path("debug/recalc/", _debug_recalc, name="cilia-debug-recalc"),
    path("debug/orders/", _debug_orders_view, name="cilia-debug-orders"),
    path("debug/parse-xml/", _debug_parse_xml, name="cilia-debug-parse-xml"),
]
