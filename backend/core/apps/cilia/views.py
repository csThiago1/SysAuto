from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
import httpx

from apps.cilia.client import buscar_orcamento
from apps.cilia.models import OrcamentoCilia
from apps.cilia.serializers import OrcamentoCiliaDetalheSerializer

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def consultar_orcamento(request):
    """
    POST /api/cilia/consultar/
    Body:
    {
      "sinistro": "406571903",
      "orcamento": "1446508",
      "versao": "2" (opcional, pode vir tudo em orcamento como "1446508.2")
    }
    """
    sinistro = request.data.get("sinistro")
    orcamento = request.data.get("orcamento")
    versao = request.data.get("versao")

    if not sinistro or not orcamento:
        return Response({"erro": "Parâmetros 'sinistro' e 'orcamento' são obrigatórios."}, status=400)

    # Tratar caso a versão venha embutida no campo orçamento (ex: 1446508.2)
    if isinstance(orcamento, str) and "." in orcamento and not versao:
        parts = orcamento.split(".")
        orcamento = parts[0]
        versao = parts[1]

    try:
        dados = buscar_orcamento(sinistro, str(orcamento), str(versao) if versao else None)
    except httpx.HTTPStatusError as e:
        status_code = e.response.status_code
        if status_code == 401:
            return Response({"erro": "Não autorizado na API Cilia. Verifique o CILIA_AUTH_TOKEN."}, status=401)
        elif status_code == 403:
            return Response({"erro": "Orçamento não encontrado ou não pertence a esta oficina."}, status=403)
        return Response({"erro": f"Erro HTTP {status_code} da Cilia API."}, status=502)
    except httpx.RequestError as e:
        return Response({"erro": "Erro de conexão com a Cilia API."}, status=502)
    except Exception as e:
        return Response({"erro": str(e)}, status=500)

    # Upsert no banco
    conclusion_dict = dados.get("conclusion") or {}
    
    obj, _ = OrcamentoCilia.objects.update_or_create(
        budget_version_id=dados["budget_version_id"],
        defaults={
            "budget_id": dados["budget_id"],
            "casualty_number": str(dados["casualty_number"]),
            "budget_number": dados["budget_number"],
            "version_number": dados["version_number"],
            "status": dados["status"],
            "license_plate": dados.get("license_plate", ""),
            "vehicle_model": dados.get("vehicle", {}).get("model", ""),
            "vehicle_brand": dados.get("vehicle", {}).get("brand", ""),
            "vehicle_year": dados.get("vehicle", {}).get("model_year"),
            "vehicle_chassi": dados.get("vehicle", {}).get("body", ""),
            "vehicle_color": dados.get("vehicle", {}).get("color", ""),
            "client_name": dados.get("client", {}).get("name", ""),
            "client_document": dados.get("client", {}).get("document_identifier", ""),
            "client_phone": dados.get("client", {}).get("phone", {}).get("number", ""),
            "insurer_name": dados.get("insurer", {}).get("trade", ""),
            "insurer_cnpj": dados.get("insurer", {}).get("document_identifier", ""),
            "conclusion_key": conclusion_dict.get("key", ""),
            "conclusion_title": conclusion_dict.get("conclusion_type_title", ""),
            "conclusion_at": conclusion_dict.get("created_at"),
            "total_liquid": dados.get("totals", {}).get("total_liquid", 0),
            "total_pieces": dados.get("totals", {}).get("total_pieces_cost", 0),
            "total_workforce": dados.get("totals", {}).get("total_workforce_cost", 0),
            "total_hours": dados.get("totals", {}).get("total_hours", 0),
            "franchise": dados.get("totals", {}).get("franchise", 0),
            "budget_created_at": dados.get("budget_webservice_creation_date"),
            "version_created_at": dados.get("budget_version_creation_date"),
            "raw_data": dados,
        },
    )

    serializer = OrcamentoCiliaDetalheSerializer(obj)
    return Response({"sucesso": True, "data": serializer.data})
