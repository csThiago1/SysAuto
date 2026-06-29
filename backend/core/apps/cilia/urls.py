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


app_name = "cilia"

urlpatterns = [
    path("consultar/", consultar_orcamento, name="cilia-consultar"),
    path("debug/parser-sha/", _debug_parser_sha, name="cilia-debug-parser-sha"),
]
