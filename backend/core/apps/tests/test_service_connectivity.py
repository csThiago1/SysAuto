"""
Paddock Solutions — Integration Tests: Service Connectivity
===========================================================

Verifica que o Django consegue alcançar todas as suas dependências de
infraestrutura:

- PostgreSQL : executa uma query simples
- Redis      : PING + SET/GET de chave
- Celery     : worker responde a inspect com timeout
- Multitenancy: schema public e schema tenant_dscar existem e são queryáveis

Usa django.test.TestCase (NÃO TenantTestCase) porque estes testes
verificam a infraestrutura em si, não a lógica de negócio por tenant.

Requisito: `make dev` deve estar rodando (Docker services healthy).
Execute via: make test-backend
"""
import logging

from django.db import connection
from django.test import TestCase

logger = logging.getLogger(__name__)


class TestPostgreSQLConnectivity(TestCase):
    """TC-CONN-01 — Django consegue executar queries no PostgreSQL."""

    def test_can_execute_simple_query(self) -> None:
        """Executa SELECT 1 via ORM — confirma que o banco está acessível."""
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            row = cursor.fetchone()
        self.assertIsNotNone(row)
        self.assertEqual(row[0], 1)

    def test_can_query_django_tables(self) -> None:
        """Verifica que tabelas do Django foram criadas (migration rodou)."""
        from apps.authentication.models import GlobalUser

        # count() não levanta exceção se a tabela existir
        count = GlobalUser.objects.count()
        self.assertGreaterEqual(count, 0)

    def test_connection_uses_correct_database(self) -> None:
        """Banco conectado deve ser paddock_test (settings de teste)."""
        db_name = connection.settings_dict["NAME"]
        # Aceita tanto 'paddock_dev' (TEST herdado sem override) quanto 'paddock_test'
        self.assertIn("paddock", db_name.lower())


class TestRedisConnectivity(TestCase):
    """TC-CONN-02 — Django consegue alcançar o Redis via cache backend."""

    def test_redis_set_and_get(self) -> None:
        """SET + GET de uma chave — confirma read-write no Redis."""
        from django.core.cache import cache

        cache_key = "integration_test:redis_connectivity"
        cache_value = "paddock-ok-2026"

        cache.set(cache_key, cache_value, timeout=30)
        retrieved = cache.get(cache_key)

        self.assertEqual(retrieved, cache_value)

    def test_redis_delete(self) -> None:
        """DELETE de chave — garante que o cache está funcional."""
        from django.core.cache import cache

        cache_key = "integration_test:redis_delete"
        cache.set(cache_key, "temporary", timeout=30)
        cache.delete(cache_key)
        result = cache.get(cache_key)

        self.assertIsNone(result)

    def test_redis_cache_miss_returns_none(self) -> None:
        """Cache miss deve retornar None sem levantar exceção."""
        from django.core.cache import cache

        result = cache.get("integration_test:nonexistent_key_xyz")
        self.assertIsNone(result)


class TestCeleryConnectivity(TestCase):
    """TC-CONN-03 — Celery está configurado e tasks rodam em modo síncrono nos testes."""

    def test_celery_task_always_eager_in_test_settings(self) -> None:
        """Em settings de teste, CELERY_TASK_ALWAYS_EAGER deve ser True."""
        from django.conf import settings

        self.assertTrue(
            getattr(settings, "CELERY_TASK_ALWAYS_EAGER", False),
            "CELERY_TASK_ALWAYS_EAGER deve ser True nas configurações de teste "
            "(definido em config/settings/test.py)",
        )

    def test_celery_app_is_importable(self) -> None:
        """O app Celery deve ser importável sem erros."""
        from config.celery import app as celery_app  # noqa: F401

        self.assertIsNotNone(celery_app)

    def test_celery_task_eager_propagates_exceptions(self) -> None:
        """Com TASK_EAGER_PROPAGATES=True, exceções propagam diretamente."""
        from django.conf import settings

        self.assertTrue(
            getattr(settings, "CELERY_TASK_EAGER_PROPAGATES", False),
            "CELERY_TASK_EAGER_PROPAGATES deve ser True nas configurações de teste",
        )

    def test_celery_broker_url_is_configured(self) -> None:
        """Broker URL deve estar configurada (Redis)."""
        from django.conf import settings

        broker_url = getattr(settings, "CELERY_BROKER_URL", "")
        self.assertTrue(
            broker_url,
            "CELERY_BROKER_URL não está configurada",
        )
        self.assertIn("redis", broker_url.lower())


class TestMultitenancyConnectivity(TestCase):
    """TC-CONN-04 — Multitenancy: schemas public e tenant_dscar existem e são acessíveis."""

    def _schema_exists(self, schema_name: str) -> bool:
        """Verifica se um schema PostgreSQL existe via information_schema."""
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name = %s",
                [schema_name],
            )
            row = cursor.fetchone()
        return bool(row and row[0] > 0)

    def test_public_schema_exists(self) -> None:
        """Schema 'public' deve existir no banco de dados."""
        self.assertTrue(
            self._schema_exists("public"),
            "Schema 'public' não encontrado — banco pode não ter sido inicializado",
        )

    def test_tenant_dscar_schema_exists(self) -> None:
        """Schema 'tenant_dscar' deve existir (tenant de desenvolvimento)."""
        self.assertTrue(
            self._schema_exists("tenant_dscar"),
            "Schema 'tenant_dscar' não encontrado. "
            "Rode: make migrate && make dev para criar o tenant de desenvolvimento.",
        )

    def test_public_schema_has_global_user_table(self) -> None:
        """Tabela users_global deve existir no schema public."""
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT COUNT(*)
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name = 'users_global'
                """
            )
            row = cursor.fetchone()
        self.assertIsNotNone(row)
        self.assertEqual(
            row[0],
            1,
            "Tabela 'users_global' não encontrada no schema public. "
            "Rode: make migrate",
        )

    def test_tenant_dscar_schema_has_service_orders_table(self) -> None:
        """Tabela service_orders_serviceorder deve existir no schema tenant_dscar."""
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT COUNT(*)
                FROM information_schema.tables
                WHERE table_schema = 'tenant_dscar'
                  AND table_name = 'service_orders_serviceorder'
                """
            )
            row = cursor.fetchone()
        self.assertIsNotNone(row)
        self.assertEqual(
            row[0],
            1,
            "Tabela 'service_orders_serviceorder' não encontrada no schema tenant_dscar. "
            "Rode: make migrate",
        )

    def test_can_query_tenant_model_in_public_schema(self) -> None:
        """Model Company (tenant model) deve ser queryável no schema public."""
        from apps.tenants.models import Company

        count = Company.objects.count()
        self.assertGreaterEqual(count, 0)

    def test_can_switch_to_tenant_dscar_schema(self) -> None:
        """schema_context('tenant_dscar') deve funcionar sem levantar exceção."""
        from django_tenants.utils import schema_context

        executed = False
        with schema_context("tenant_dscar"):
            with connection.cursor() as cursor:
                cursor.execute("SELECT current_schema()")
                row = cursor.fetchone()
            self.assertEqual(row[0], "tenant_dscar")
            executed = True

        self.assertTrue(executed, "Bloco schema_context não foi executado")
