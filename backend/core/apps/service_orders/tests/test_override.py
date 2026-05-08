"""
Integration tests for TransitionOverrideRequest flow.

Uses TenantTestCase to ensure models are created in the correct tenant schema,
consistent with the rest of the service_orders test suite.
"""
from __future__ import annotations

import hashlib
from datetime import timedelta

from django.utils import timezone
from django_tenants.test.cases import TenantTestCase

from apps.authentication.models import GlobalUser
from apps.service_orders.models import (
    ServiceOrder,
    ServiceOrderStatus,
    TransitionOverrideRequest,
)


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def _make_user(email: str) -> GlobalUser:
    """Cria GlobalUser com email_hash calculado explicitamente."""
    return GlobalUser.objects.create_user(
        email=email,
        email_hash=_sha256(email),
        password="test123456",
    )


class TransitionOverrideModelTest(TenantTestCase):
    """Testes de integração para o modelo TransitionOverrideRequest."""

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.user = _make_user("consultor@dscar.test")
        cls.manager = _make_user("gerente@dscar.test")
        cls.os = ServiceOrder.objects.create(
            number=9999,
            plate="TST1A23",
            make="Test",
            model="Car",
            customer_type="private",
            customer_name="Test Customer",
            status=ServiceOrderStatus.INITIAL_SURVEY,
            entry_date=timezone.now(),
            created_by=cls.user,
        )

    def _make_override(self, **kwargs) -> TransitionOverrideRequest:
        """Cria um TransitionOverrideRequest com valores padrão razoáveis."""
        defaults: dict = {
            "service_order": self.os,
            "from_status": "initial_survey",
            "to_status": "budget",
            "requested_by": self.user,
            "request_reason": "Fotos serão tiradas amanhã",
            "expires_at": timezone.now() + timedelta(hours=24),
            "created_by": self.user,
        }
        defaults.update(kwargs)
        return TransitionOverrideRequest.objects.create(**defaults)

    # ── Criação ───────────────────────────────────────────────────────────────

    def test_create_override_request_with_valid_data(self) -> None:
        """Override request pode ser criado com dados válidos e status inicial é 'pending'."""
        override = self._make_override()

        self.assertEqual(override.status, TransitionOverrideRequest.Status.PENDING)
        self.assertEqual(override.from_status, "initial_survey")
        self.assertEqual(override.to_status, "budget")
        self.assertEqual(override.requested_by, self.user)
        self.assertIsNone(override.approved_by)
        self.assertIsNone(override.resolved_at)
        self.assertEqual(override.justification, "")

    def test_override_default_blocks_snapshot_is_empty_list(self) -> None:
        """blocks_snapshot tem valor padrão de lista vazia."""
        override = self._make_override()
        self.assertEqual(override.blocks_snapshot, [])

    def test_override_accepts_blocks_snapshot(self) -> None:
        """blocks_snapshot armazena corretamente a lista de soft blocks."""
        blocks = [{"code": "PHOTOS_MIN_12", "message": "Fotos: 8/12"}]
        override = self._make_override(blocks_snapshot=blocks)
        override.refresh_from_db()
        self.assertEqual(override.blocks_snapshot, blocks)

    # ── __str__ ───────────────────────────────────────────────────────────────

    def test_str_representation(self) -> None:
        """str() retorna formato legível com número da OS, transição e status."""
        override = self._make_override()
        expected = "Override OS #9999: initial_survey → budget (pending)"
        self.assertEqual(str(override), expected)

    def test_str_representation_after_approval(self) -> None:
        """str() reflete o status correto após aprovação."""
        override = self._make_override()
        override.status = TransitionOverrideRequest.Status.APPROVED
        override.save(update_fields=["status"])
        self.assertIn("approved", str(override))

    # ── Expiração ─────────────────────────────────────────────────────────────

    def test_expire_pending_overrides_past_expires_at(self) -> None:
        """Override com expires_at no passado é marcado como 'expired' pelo queryset update."""
        override = self._make_override(
            expires_at=timezone.now() - timedelta(hours=1),
        )
        self.assertEqual(override.status, "pending")

        expired_count = TransitionOverrideRequest.objects.filter(
            status="pending",
            expires_at__lt=timezone.now(),
        ).update(status="expired", resolved_at=timezone.now())

        self.assertEqual(expired_count, 1)
        override.refresh_from_db()
        self.assertEqual(override.status, TransitionOverrideRequest.Status.EXPIRED)

    def test_valid_override_not_expired_by_update(self) -> None:
        """Override com expires_at no futuro não é afetado pelo job de expiração."""
        future_override = self._make_override(
            request_reason="ainda válido",
            expires_at=timezone.now() + timedelta(hours=12),
        )
        past_override = self._make_override(
            request_reason="já vencido",
            expires_at=timezone.now() - timedelta(hours=1),
        )

        TransitionOverrideRequest.objects.filter(
            status="pending",
            expires_at__lt=timezone.now(),
        ).update(status="expired", resolved_at=timezone.now())

        future_override.refresh_from_db()
        past_override.refresh_from_db()
        self.assertEqual(future_override.status, "pending")
        self.assertEqual(past_override.status, "expired")

    # ── Aprovação ─────────────────────────────────────────────────────────────

    def test_approve_override_by_manager(self) -> None:
        """Override pode ser aprovado — campos approved_by, justification e resolved_at são gravados."""
        override = self._make_override()
        now = timezone.now()

        override.status = TransitionOverrideRequest.Status.APPROVED
        override.approved_by = self.manager
        override.justification = "OK, tirar fotos amanhã cedo"
        override.resolved_at = now
        override.save()

        override.refresh_from_db()
        self.assertEqual(override.status, "approved")
        self.assertEqual(override.approved_by, self.manager)
        self.assertEqual(override.justification, "OK, tirar fotos amanhã cedo")
        self.assertIsNotNone(override.resolved_at)

    def test_reject_override(self) -> None:
        """Override pode ser rejeitado — status muda para 'rejected'."""
        override = self._make_override()

        override.status = TransitionOverrideRequest.Status.REJECTED
        override.approved_by = self.manager
        override.justification = "Fotos obrigatórias antes de avançar"
        override.resolved_at = timezone.now()
        override.save()

        override.refresh_from_db()
        self.assertEqual(override.status, "rejected")

    # ── Filtros de negócio ────────────────────────────────────────────────────

    def test_pending_filter_excludes_expired_and_approved(self) -> None:
        """Filtro de pendentes válidos retorna apenas overrides com status='pending' e não expirados."""
        valid = self._make_override(
            request_reason="válido",
            expires_at=timezone.now() + timedelta(hours=12),
        )
        # Expirado no tempo mas ainda com status pending
        expired_time = self._make_override(
            request_reason="expirado no tempo",
            expires_at=timezone.now() - timedelta(hours=1),
        )
        # Já aprovado
        approved = self._make_override(
            request_reason="já aprovado",
            expires_at=timezone.now() + timedelta(hours=12),
        )
        approved.status = "approved"
        approved.save(update_fields=["status"])

        pending_qs = TransitionOverrideRequest.objects.filter(
            status="pending",
            expires_at__gt=timezone.now(),
        )

        pks = list(pending_qs.values_list("pk", flat=True))
        self.assertIn(valid.pk, pks)
        self.assertNotIn(expired_time.pk, pks)
        self.assertNotIn(approved.pk, pks)

    def test_filter_by_service_order_and_to_status(self) -> None:
        """Filtro por service_order + to_status retorna apenas o override correto."""
        override = self._make_override(to_status="budget")
        # Override para outro status na mesma OS
        self._make_override(to_status="waiting_auth")

        result = TransitionOverrideRequest.objects.filter(
            service_order=self.os,
            to_status="budget",
            status="pending",
        )
        self.assertEqual(result.count(), 1)
        self.assertEqual(result.first().pk, override.pk)

    def test_has_pending_override_helper(self) -> None:
        """Método _has_pending_override do TransitionValidator detecta override existente."""
        from apps.service_orders.transition_validator import TransitionValidator

        # Antes de criar — sem override
        self.assertFalse(
            TransitionValidator._has_pending_override(self.os, "budget")
        )

        # Cria override pendente
        self._make_override(to_status="budget")

        # Após criar — deve detectar
        self.assertTrue(
            TransitionValidator._has_pending_override(self.os, "budget")
        )

    def test_uuid_primary_key(self) -> None:
        """TransitionOverrideRequest usa UUID como PK (herdado de PaddockBaseModel)."""
        import uuid

        override = self._make_override()
        self.assertIsInstance(override.pk, uuid.UUID)

    def test_soft_delete_via_is_active(self) -> None:
        """soft_delete() desativa o override sem removê-lo do banco."""
        override = self._make_override()
        override.soft_delete()

        override.refresh_from_db()
        self.assertFalse(override.is_active)
        # Registro ainda existe no banco
        self.assertTrue(
            TransitionOverrideRequest.objects.filter(pk=override.pk).exists()
        )
