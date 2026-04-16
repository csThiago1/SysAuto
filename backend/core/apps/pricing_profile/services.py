"""
Serviços de negócio do Perfil Veicular.
EnquadramentoService: resolve perfil veicular por marca/modelo/ano com fallback progressivo.
"""
import logging

from django.db.models import F, Q

logger = logging.getLogger(__name__)


class EnquadramentoResult:
    """Resultado da resolução de enquadramento veicular."""

    def __init__(
        self,
        segmento_codigo: str,
        tamanho_codigo: str,
        tipo_pintura_codigo: str | None,
        origem: str,
        enquadramento_id: str | None = None,
    ) -> None:
        self.segmento_codigo = segmento_codigo
        self.tamanho_codigo = tamanho_codigo
        self.tipo_pintura_codigo = tipo_pintura_codigo
        self.origem = origem  # "exato" | "marca_modelo" | "marca" | "fallback"
        self.enquadramento_id = enquadramento_id

    def to_dict(self) -> dict:
        """Retorna representação serializável."""
        return {
            "segmento_codigo": self.segmento_codigo,
            "tamanho_codigo": self.tamanho_codigo,
            "tipo_pintura_codigo": self.tipo_pintura_codigo,
            "origem": self.origem,
            "enquadramento_id": str(self.enquadramento_id) if self.enquadramento_id else None,
        }


class EnquadramentoService:
    """Serviço de resolução de perfil veicular por marca/modelo/ano.

    Implementa fallback progressivo:
    1. Match exato: marca + modelo + ano no intervalo
    2. Match marca + modelo (qualquer ano)
    3. Match somente marca (modelo vazio)
    4. Fallback genérico: médio/médio + log para curadoria
    """

    # Códigos padrão do fallback (criados no seed setup_perfil_veicular)
    FALLBACK_SEGMENTO = "medio"
    FALLBACK_TAMANHO = "medio"

    @staticmethod
    def resolver(marca: str, modelo: str, ano: int) -> EnquadramentoResult:
        """Resolve perfil veicular para uma combinação marca/modelo/ano.

        Args:
            marca: Nome da marca (ex: "Honda", "Volkswagen")
            modelo: Nome do modelo (ex: "Civic", "Gol")
            ano: Ano do veículo (ex: 2022)

        Returns:
            EnquadramentoResult com segmento, tamanho, tipo_pintura e origem do match.
        """
        from apps.pricing_profile.models import EnquadramentoFaltante, EnquadramentoVeiculo

        marca_upper = marca.strip().upper()
        modelo_upper = modelo.strip().upper()

        # 1. Match exato: marca + modelo + ano dentro de intervalo explicitamente definido.
        # Registros com ano_inicio=None AND ano_fim=None (sem restrição de ano) são
        # excluídos aqui e tratados pelo nível 2, evitando que esse nível 2 fique morto.
        match_exato = (
            EnquadramentoVeiculo.objects.filter(
                is_active=True,
                marca__iexact=marca_upper,
                modelo__iexact=modelo_upper,
            )
            .exclude(ano_inicio__isnull=True, ano_fim__isnull=True)
            .filter(Q(ano_inicio__isnull=True) | Q(ano_inicio__lte=ano))
            .filter(Q(ano_fim__isnull=True) | Q(ano_fim__gte=ano))
            .select_related("segmento", "tamanho", "tipo_pintura_default")
            .order_by("prioridade")
            .first()
        )

        if match_exato:
            return EnquadramentoResult(
                segmento_codigo=match_exato.segmento.codigo,
                tamanho_codigo=match_exato.tamanho.codigo,
                tipo_pintura_codigo=(
                    match_exato.tipo_pintura_default.codigo
                    if match_exato.tipo_pintura_default
                    else None
                ),
                origem="exato",
                enquadramento_id=match_exato.id,
            )

        # 2. Match marca + modelo sem restrição de ano.
        # Cobre registros com ano_inicio=None AND ano_fim=None (válidos para qualquer ano).
        match_marca_modelo = (
            EnquadramentoVeiculo.objects.filter(
                is_active=True,
                marca__iexact=marca_upper,
                modelo__iexact=modelo_upper,
                ano_inicio__isnull=True,
                ano_fim__isnull=True,
            )
            .select_related("segmento", "tamanho", "tipo_pintura_default")
            .order_by("prioridade")
            .first()
        )

        if match_marca_modelo:
            return EnquadramentoResult(
                segmento_codigo=match_marca_modelo.segmento.codigo,
                tamanho_codigo=match_marca_modelo.tamanho.codigo,
                tipo_pintura_codigo=(
                    match_marca_modelo.tipo_pintura_default.codigo
                    if match_marca_modelo.tipo_pintura_default
                    else None
                ),
                origem="marca_modelo",
                enquadramento_id=match_marca_modelo.id,
            )

        # 3. Match somente marca (modelo vazio = regra genérica de marca)
        match_marca = (
            EnquadramentoVeiculo.objects.filter(
                is_active=True,
                marca__iexact=marca_upper,
                modelo="",
            )
            .select_related("segmento", "tamanho", "tipo_pintura_default")
            .order_by("prioridade")
            .first()
        )

        if match_marca:
            return EnquadramentoResult(
                segmento_codigo=match_marca.segmento.codigo,
                tamanho_codigo=match_marca.tamanho.codigo,
                tipo_pintura_codigo=(
                    match_marca.tipo_pintura_default.codigo
                    if match_marca.tipo_pintura_default
                    else None
                ),
                origem="marca",
                enquadramento_id=match_marca.id,
            )

        # 4. Fallback genérico + registro para curadoria
        logger.warning(
            "EnquadramentoFaltante: marca=%s modelo=%s ano=%s — usando fallback médio/médio",
            marca_upper,
            modelo_upper,
            ano,
        )

        obj, created = EnquadramentoFaltante.objects.get_or_create(
            marca=marca_upper,
            modelo=modelo_upper,
            defaults={"ocorrencias": 1},
        )
        if not created:
            # Incrementa o contador de ocorrências para rastreamento de curadoria
            EnquadramentoFaltante.objects.filter(
                marca=marca_upper,
                modelo=modelo_upper,
            ).update(ocorrencias=F("ocorrencias") + 1)

        return EnquadramentoResult(
            segmento_codigo=EnquadramentoService.FALLBACK_SEGMENTO,
            tamanho_codigo=EnquadramentoService.FALLBACK_TAMANHO,
            tipo_pintura_codigo=None,
            origem="fallback",
        )
