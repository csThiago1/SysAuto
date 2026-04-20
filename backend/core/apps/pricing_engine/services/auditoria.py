"""
Paddock Solutions — Pricing Engine — AuditoriaService
MO-9: Log imutável de chamadas ao motor de precificação.
"""
import logging
import time
from typing import Any

logger = logging.getLogger(__name__)


class AuditoriaService:
    """
    Registra chamadas ao motor de precificação na tabela AuditoriaMotor.
    Uso via context manager:

        with AuditoriaService.log(operacao="calcular_servico", contexto=input_dict) as audit:
            resultado = motor.calcular_servico(...)
            audit.set_resultado(resultado)
    """

    @staticmethod
    def log(
        operacao: str,
        contexto_input: dict,
        empresa_id: str | None = None,
        user_id: Any = None,
    ) -> "AuditoriaContext":
        return AuditoriaContext(
            operacao=operacao,
            contexto_input=contexto_input,
            empresa_id=empresa_id,
            user_id=user_id,
        )

    @staticmethod
    def healthcheck() -> dict:
        """
        Verifica saúde do motor: tabelas acessíveis, últimas 100 chamadas,
        taxa de erro e tempo médio.
        """
        from apps.pricing_engine.models import AuditoriaMotor
        from django.db.models import Avg, Count, Q

        try:
            stats = AuditoriaMotor.objects.aggregate(
                total=Count("id"),
                erros=Count("id", filter=Q(sucesso=False)),
                tempo_medio_ms=Avg("tempo_ms"),
            )
            return {
                "status": "ok",
                "total_chamadas": stats["total"],
                "taxa_erro_pct": round(
                    (stats["erros"] / stats["total"] * 100) if stats["total"] else 0, 2
                ),
                "tempo_medio_ms": round(stats["tempo_medio_ms"] or 0, 1),
            }
        except Exception as exc:
            logger.error("AuditoriaService.healthcheck error: %s", exc)
            return {"status": "error", "detalhe": "Tabela inacessível"}


class AuditoriaContext:
    """Context manager que registra início/fim de chamada ao motor."""

    def __init__(
        self,
        operacao: str,
        contexto_input: dict,
        empresa_id: str | None,
        user_id: Any,
    ) -> None:
        self.operacao = operacao
        self.contexto_input = contexto_input
        self.empresa_id = empresa_id
        self.user_id = user_id
        self._resultado: dict | None = None
        self._snapshot_id: str | None = None
        self._start = 0.0

    def set_resultado(self, resultado: dict) -> None:
        self._resultado = resultado
        if "snapshot_id" in resultado:
            self._snapshot_id = str(resultado["snapshot_id"])

    def __enter__(self) -> "AuditoriaContext":
        self._start = time.monotonic()
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> bool:
        from apps.pricing_engine.models import AuditoriaMotor

        tempo_ms = int((time.monotonic() - self._start) * 1000)
        sucesso = exc_type is None
        erro_msg = str(exc_val) if exc_val else ""

        try:
            AuditoriaMotor.objects.create(
                operacao=self.operacao,
                chamado_por_id=self.user_id,
                empresa_id=self.empresa_id,
                contexto_input=self.contexto_input,
                resultado_output=self._resultado,
                sucesso=sucesso,
                erro_msg=erro_msg[:2000],
                tempo_ms=tempo_ms,
                snapshot_id=self._snapshot_id,
            )
        except Exception as log_exc:
            # Auditoria nunca deve interromper o fluxo principal
            logger.error("AuditoriaService: falha ao gravar log: %s", log_exc)

        return False  # não suprime a exceção original
