# Generated manually — MO-6 (fix)
# Remove DB-level FK constraints em:
# - CalculoCustoSnapshot.servico_canonico e peca_canonica (snapshots imutáveis)
# - MarkupPeca.peca_canonica (regras de markup sobrevivem a reindexações)
# Usa RunSQL direto pois AlterField não suporta db_constraint nesta versão do Django.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("pricing_engine", "0003_add_created_by_to_motor_models"),
        ("pricing_catalog", "0001_initial"),
    ]

    operations = [
        # Atualiza o estado interno do Django (sem alterar o DB)
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AlterField(
                    model_name="markuppeca",
                    name="peca_canonica",
                    field=models.ForeignKey(
                        blank=True,
                        db_constraint=False,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="markups",
                        to="pricing_catalog.pecacanonica",
                        verbose_name="Peça canônica",
                    ),
                ),
                migrations.AlterField(
                    model_name="calculocustosnapshot",
                    name="servico_canonico",
                    field=models.ForeignKey(
                        blank=True,
                        db_constraint=False,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="snapshots_custo",
                        to="pricing_catalog.servicocanonico",
                        verbose_name="Serviço canônico",
                    ),
                ),
                migrations.AlterField(
                    model_name="calculocustosnapshot",
                    name="peca_canonica",
                    field=models.ForeignKey(
                        blank=True,
                        db_constraint=False,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="snapshots_custo",
                        to="pricing_catalog.pecacanonica",
                        verbose_name="Peça canônica",
                    ),
                ),
            ],
            database_operations=[
                # Drop FK constraint para MarkupPeca.peca_canonica
                migrations.RunSQL(
                    sql="""
                        DO $$
                        DECLARE
                            r RECORD;
                        BEGIN
                            FOR r IN
                                SELECT tc.constraint_name
                                FROM information_schema.table_constraints tc
                                JOIN information_schema.key_column_usage kcu
                                    ON tc.constraint_name = kcu.constraint_name
                                WHERE tc.constraint_type = 'FOREIGN KEY'
                                    AND tc.table_name = 'pricing_engine_markuppeca'
                                    AND kcu.column_name = 'peca_canonica_id'
                            LOOP
                                EXECUTE 'ALTER TABLE pricing_engine_markuppeca DROP CONSTRAINT ' || r.constraint_name;
                            END LOOP;
                        END $$;
                    """,
                    reverse_sql=migrations.RunSQL.noop,
                ),
                # Drop FK constraint para servico_canonico
                migrations.RunSQL(
                    sql="""
                        DO $$
                        DECLARE
                            r RECORD;
                        BEGIN
                            FOR r IN
                                SELECT tc.constraint_name
                                FROM information_schema.table_constraints tc
                                JOIN information_schema.key_column_usage kcu
                                    ON tc.constraint_name = kcu.constraint_name
                                WHERE tc.constraint_type = 'FOREIGN KEY'
                                    AND tc.table_name = 'pricing_engine_calculocustosnapshot'
                                    AND kcu.column_name = 'servico_canonico_id'
                            LOOP
                                EXECUTE 'ALTER TABLE pricing_engine_calculocustosnapshot DROP CONSTRAINT ' || r.constraint_name;
                            END LOOP;
                        END $$;
                    """,
                    reverse_sql=migrations.RunSQL.noop,
                ),
                # Drop FK constraint para peca_canonica
                migrations.RunSQL(
                    sql="""
                        DO $$
                        DECLARE
                            r RECORD;
                        BEGIN
                            FOR r IN
                                SELECT tc.constraint_name
                                FROM information_schema.table_constraints tc
                                JOIN information_schema.key_column_usage kcu
                                    ON tc.constraint_name = kcu.constraint_name
                                WHERE tc.constraint_type = 'FOREIGN KEY'
                                    AND tc.table_name = 'pricing_engine_calculocustosnapshot'
                                    AND kcu.column_name = 'peca_canonica_id'
                            LOOP
                                EXECUTE 'ALTER TABLE pricing_engine_calculocustosnapshot DROP CONSTRAINT ' || r.constraint_name;
                            END LOOP;
                        END $$;
                    """,
                    reverse_sql=migrations.RunSQL.noop,
                ),
            ],
        ),
    ]
