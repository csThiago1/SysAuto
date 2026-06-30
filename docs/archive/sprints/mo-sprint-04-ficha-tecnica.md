# MO-Sprint 04 — Ficha Técnica + Multiplicadores

**Duração:** 2 semanas | **Equipe:** Solo + Claude Code | **Prioridade:** P0
**Pré-requisitos:** MO-2 (catálogo canônico) · **Desbloqueia:** MO-6

---

## Objetivo

Criar o coração do cálculo de custo: a ficha técnica versionada. Para cada
`ServicoCanonico` existe uma ou mais `FichaTecnicaServico` que descreve
quantas horas de cada categoria profissional consome e quanto de cada
`MaterialCanonico` usa. Implementar resolução por contexto (tipo de pintura)
e aplicação de multiplicadores por tamanho.

Ficha **não é imutável**, mas **mudanças criam nova versão**. Ficha antiga
continua acessível para OSs já calculadas.

---

## Referências obrigatórias

1. `docs/mo-roadmap.md` — **armadilhas A1 (mutabilidade), A3 (flag tamanho), A5 (unidade_base)**.
2. Spec v3.0 — §6 (ficha técnica), §8 (multiplicadores), §9.1 passos 1–2.
3. `apps.pricing_catalog.ServicoCanonico` + `MaterialCanonico` + `CategoriaMaoObra`.

---

## Escopo

### 1. Novo app: `apps.pricing_tech` (TENANT_APP)

#### Models

```python
# apps/pricing_tech/models.py

class FichaTecnicaServico(PaddockBaseModel):
    servico = models.ForeignKey(
        "pricing_catalog.ServicoCanonico",
        on_delete=models.PROTECT,
        related_name="fichas",
    )
    versao = models.PositiveIntegerField()
    tipo_pintura = models.ForeignKey(
        "pricing_profile.TipoPintura",
        null=True, blank=True,
        on_delete=models.PROTECT,
        help_text="Opcional — permite ficha distinta por tipo de pintura. "
                  "NULL = ficha genérica usada quando tipo não casa.",
    )
    is_active = models.BooleanField(default=True)
    criada_em = models.DateTimeField(auto_now_add=True)
    criada_por = models.ForeignKey(
        "authentication.GlobalUser",
        null=True, on_delete=models.SET_NULL,
        related_name="fichas_criadas",
    )
    observacoes = models.TextField(blank=True)
    motivo_nova_versao = models.CharField(max_length=300, blank=True)
    # Ex: "Fornecedor de verniz trocou, rendimento 15% melhor"

    class Meta:
        unique_together = [("servico", "versao", "tipo_pintura")]
        indexes = [
            models.Index(fields=["servico", "is_active", "tipo_pintura"]),
        ]


class FichaTecnicaMaoObra(PaddockBaseModel):
    ficha = models.ForeignKey(FichaTecnicaServico, on_delete=models.CASCADE, related_name="maos_obra")
    categoria = models.ForeignKey("pricing_catalog.CategoriaMaoObra", on_delete=models.PROTECT)
    horas = models.DecimalField(max_digits=5, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))])
    afetada_por_tamanho = models.BooleanField(
        default=True,
        help_text="TRUE para mão de obra que varia com porte (pintura, "
                  "funilaria). FALSE para elétrica/diagnóstico/configuração."
    )
    observacao = models.CharField(max_length=200, blank=True)


class FichaTecnicaInsumo(PaddockBaseModel):
    ficha = models.ForeignKey(FichaTecnicaServico, on_delete=models.CASCADE, related_name="insumos")
    material_canonico = models.ForeignKey("pricing_catalog.MaterialCanonico", on_delete=models.PROTECT)
    quantidade = models.DecimalField(max_digits=9, decimal_places=4, validators=[MinValueValidator(Decimal("0.0001"))])
    unidade = models.CharField(max_length=20)
    # DEVE casar com material_canonico.unidade_base. Valida no clean().
    afetado_por_tamanho = models.BooleanField(default=True)
    observacao = models.CharField(max_length=200, blank=True)

    def clean(self):
        super().clean()
        if self.material_canonico and self.unidade != self.material_canonico.unidade_base:
            raise ValidationError({
                "unidade": f"Deve ser '{self.material_canonico.unidade_base}' "
                           f"para casar com o material."
            })
```

### 2. Service de resolução

```python
# apps/pricing_tech/services.py

from dataclasses import dataclass
from decimal import Decimal

@dataclass
class FichaResolvida:
    ficha_id: int
    versao: int
    maos_obra: list[dict]  # [{categoria_codigo, horas, afetada_por_tamanho}, ...]
    insumos: list[dict]    # [{material_codigo, quantidade, unidade_base, afetado_por_tamanho}, ...]


class FichaNaoEncontrada(Exception):
    pass


class FichaTecnicaService:
    @staticmethod
    def resolver(
        servico_id: int,
        tipo_pintura_codigo: str | None = None,
    ) -> FichaResolvida:
        """Ordem:
        1. Ficha ativa com tipo_pintura casando
        2. Ficha ativa genérica (tipo_pintura=NULL)
        3. Raise FichaNaoEncontrada
        """
        qs = FichaTecnicaServico.objects.filter(
            servico_id=servico_id,
            is_active=True,
        )

        # 1. tipo específico
        if tipo_pintura_codigo:
            especifica = qs.filter(tipo_pintura__codigo=tipo_pintura_codigo).first()
            if especifica:
                return _montar_resolvida(especifica)

        # 2. genérica
        generica = qs.filter(tipo_pintura__isnull=True).first()
        if generica:
            return _montar_resolvida(generica)

        raise FichaNaoEncontrada(
            f"servico={servico_id} tipo_pintura={tipo_pintura_codigo}"
        )

    @staticmethod
    def aplicar_multiplicadores(
        ficha: FichaResolvida,
        aplica_multiplicador_tamanho: bool,
        tamanho: "CategoriaTamanho",
    ) -> FichaResolvida:
        """Aplica multiplicador_insumos e multiplicador_horas apenas
        nos itens com afetado_por_tamanho=True, e só se o serviço tem flag True."""
        if not aplica_multiplicador_tamanho:
            return ficha

        mi = tamanho.multiplicador_insumos
        mh = tamanho.multiplicador_horas

        maos_ajustadas = [
            {**mo, "horas": mo["horas"] * (mh if mo["afetada_por_tamanho"] else Decimal("1"))}
            for mo in ficha.maos_obra
        ]
        ins_ajustados = [
            {**ins, "quantidade": ins["quantidade"] * (mi if ins["afetado_por_tamanho"] else Decimal("1"))}
            for ins in ficha.insumos
        ]

        return FichaResolvida(
            ficha_id=ficha.ficha_id,
            versao=ficha.versao,
            maos_obra=maos_ajustadas,
            insumos=ins_ajustados,
        )
```

### 3. Versionamento

#### Regra
Alteração em `FichaTecnicaServico` existente → **cria nova versão** e
desativa a anterior. Nunca `UPDATE` destrutivo.

#### Service

```python
class FichaTecnicaService:
    @staticmethod
    def criar_nova_versao(
        servico_id: int,
        tipo_pintura_id: int | None,
        maos_obra_data: list[dict],
        insumos_data: list[dict],
        motivo: str,
        user_id: str,
    ) -> FichaTecnicaServico:
        """Cria nova versão e desativa a anterior (mesmo servico+tipo_pintura).
        OSs com snapshot não são afetadas."""
        with transaction.atomic():
            anterior = FichaTecnicaServico.objects.filter(
                servico_id=servico_id,
                tipo_pintura_id=tipo_pintura_id,
                is_active=True,
            ).first()

            prox_versao = (anterior.versao + 1) if anterior else 1

            nova = FichaTecnicaServico.objects.create(
                servico_id=servico_id,
                tipo_pintura_id=tipo_pintura_id,
                versao=prox_versao,
                is_active=True,
                criada_por_id=user_id,
                motivo_nova_versao=motivo,
            )

            for mo in maos_obra_data:
                FichaTecnicaMaoObra.objects.create(ficha=nova, **mo)
            for ins in insumos_data:
                FichaTecnicaInsumo.objects.create(ficha=nova, **ins)

            if anterior:
                anterior.is_active = False
                anterior.save(update_fields=["is_active"])

            return nova
```

### 4. Endpoints

```
GET    /api/v1/pricing/fichas/?servico={id}&versao={v}        (MANAGER+)
GET    /api/v1/pricing/fichas/{id}/                            (MANAGER+)
POST   /api/v1/pricing/fichas/                                 (criar nova versão)
POST   /api/v1/pricing/fichas/resolver/                        (body: servico_id, tipo_pintura_codigo?)

GET    /api/v1/pricing/servicos/{id}/fichas/                   (histórico de versões)
POST   /api/v1/pricing/servicos/{id}/fichas/nova-versao/       (body: {tipo_pintura_id, maos_obra[], insumos[], motivo})
```

**Sem endpoint de PATCH/PUT direto na `FichaTecnicaServico`.** Edição =
criar nova versão. Apenas `is_active` pode ser alterado (para reativar
versão antiga como experimento).

### 5. Frontend

#### Página: `/cadastros/fichas-tecnicas`

- Lista de serviços com número de versões.
- Filtro por categoria de serviço.
- Clique abre detalhe.

#### Página: `/cadastros/fichas-tecnicas/{servico_id}`

Visualização estilo **editor de receita**:

```
Serviço: Pintura de para-choque traseiro
Aplica multiplicador de tamanho: ✓
Versão ativa: v3 · criada em 12/04/2026 por Thiago

[Variação: Metálica ▼]   [Criar variação por tipo de pintura]

─── Mão de obra ───────────────────────────────
Pintor                  3.0 h    ☑ afetada por tamanho
Auxiliar                1.0 h    ☑ afetada por tamanho
[+ Adicionar linha]

─── Insumos ───────────────────────────────────
Primer acrílico         0.20 L   ☑ afetado por tamanho
Tinta base              0.40 L   ☑ afetado por tamanho
Verniz alto sólido      0.30 L   ☑ afetado por tamanho
...
[+ Adicionar linha]

─── Histórico de versões ──────────────────────
v3 (ativa) · 12/04/2026 · Thiago · "Fornecedor de verniz trocou, rendimento 15% melhor"
v2 · 05/02/2026 · Mariana · "Corrigir thinner consumido"
v1 · 20/01/2026 · Mariana · "Ficha inicial"

[Salvar como nova versão (v4)]
```

Ao clicar **Salvar como nova versão**, abre dialog com campo "Motivo" obrigatório.

#### Página: `/cadastros/fichas-tecnicas/simular`

Debug tool:

- Select serviço + tipo de pintura + tamanho.
- Mostra ficha base.
- Mostra ficha com multiplicadores aplicados (coluna ao lado).
- Totais: horas × categoria + insumos × material.

Só visível para ADMIN.

#### Hook reutilizável

```typescript
// apps/dscar-web/src/hooks/useFichaTecnica.ts

export function useFichaResolver(servicoId: number, tipoPintura?: string) {
  return useQuery({
    queryKey: ['ficha-resolver', servicoId, tipoPintura],
    queryFn: () => api.post('/api/proxy/pricing/fichas/resolver/', {
      servico_id: servicoId,
      tipo_pintura_codigo: tipoPintura ?? null,
    }),
    enabled: !!servicoId,
  })
}
```

---

## Testes

```
apps/pricing_tech/tests/
  test_ficha_resolver.py
    — resolve específica quando tipo casa
    — resolve genérica quando tipo não casa
    — raise quando nenhuma existe
  test_ficha_versao.py
    — criar nova versão desativa anterior
    — versão numérica incrementa corretamente
    — atomic rollback em erro
  test_multiplicadores.py
    — aplica_multiplicador_tamanho=False ignora multipliers
    — itens com afetado=False mantêm
    — tamanho "médio" (1.00/1.00) não altera
    — tamanho "SUV/Grande" (1.25/1.10) produz resultado esperado
  test_validations.py
    — FichaTecnicaInsumo.unidade deve casar com material.unidade_base
    — horas/quantidade positivos
```

Golden test com fixtures: HR-V + pintura metálica + médio → deve gerar
ficha idêntica ao exemplo §6.3 da spec v3.0.

---

## Critérios de aceite

- [ ] `POST /fichas/resolver/` retorna ficha correta para 10 casos teste.
- [ ] `POST /fichas/` (nova versão) incrementa versão e desativa anterior.
- [ ] Validation impede mismatch de unidade (`L` vs `kg`).
- [ ] UI de edição exige "Motivo" ao salvar nova versão.
- [ ] Simulador mostra antes/depois com multiplicadores.
- [ ] Histórico de versões sempre visível.
- [ ] 10 fichas técnicas iniciais cadastradas (top-10 serviços DS Car).
- [ ] `make lint`, `make typecheck`, `make test-backend` passam.

---

## Armadilhas específicas desta sprint

### P1 · Edição destrutiva é proibida
A tentação é fazer PATCH nos `FichaTecnicaMaoObra`/`FichaTecnicaInsumo`.
Ficha é **imutável por design**. Qualquer mudança = nova versão.
ViewSet **não tem** `update`/`partial_update` em `FichaTecnicaMaoObra`
nem `FichaTecnicaInsumo`. Se precisar corrigir ficha v1 "errada", criar v2
com valor certo.

### P2 · `motivo_nova_versao` é obrigatório
Frontend Zod: `z.string().min(10)`. Sem isso, histórico vira lixo.

### P3 · `tipo_pintura=NULL` = "qualquer"
Cuidado com NULL em unique_together. Postgres trata NULL como distinto
em unique — permite múltiplas fichas com `tipo_pintura=NULL` no mesmo
serviço. **Validar no serializer:** só uma ficha ativa com `tipo_pintura=NULL`
por serviço.

### P4 · Flag `aplica_multiplicador_tamanho` vem do `ServicoCanonico`
Não duplicar na ficha. Motor em MO-6 lê do `ServicoCanonico` no momento do
cálculo. Se trocar flag no canônico, comportamento futuro muda — snapshots
antigos permanecem corretos porque já guardam o resultado.

### P5 · `afetada_por_tamanho` vs flag do serviço
Flag do serviço é o **gate geral** (se False, nenhum multiplicador aplica).
Flag da ficha é **fine-grained dentro** de serviço que tem flag True.
Ex: "Substituição de porta" tem flag True, mas reconexão elétrica (dentro
da mesma ficha) tem `afetada_por_tamanho=False` porque não varia.

### P6 · Ficha versionada não apaga FK
`ServicoCanonico.on_delete=PROTECT` evita deletar canônico com ficha.
`MaterialCanonico` e `CategoriaMaoObra` idem. Em contrapartida, soft
delete (`is_active=False`) é permitido.

### P7 · UI tem que ser amigável
Ficha técnica é editada por pintor sênior + funileiro + gestor, não só dev.
Evitar inputs numéricos crus sem máscara. Usar `NumberInput` com step
apropriado (0.01 para horas, 0.0001 para insumos).

---

## Handoff para MO-6

MO-6 assume:

- `FichaTecnicaService.resolver(servico_id, tipo_pintura_codigo)` retorna `FichaResolvida`.
- `FichaTecnicaService.aplicar_multiplicadores()` retorna `FichaResolvida` transformada.
- 10 fichas iniciais cadastradas para testes de ponta-a-ponta.
- Simulador de ficha pronto (útil para validar cálculo em MO-6).

---

## Checklist pós-sprint

CLAUDE.md ganha:

- App novo `apps.pricing_tech`.
- Padrão **imutabilidade por versão** — documentar como princípio.
- Validação de unidade entre `FichaTecnicaInsumo` e `MaterialCanonico`.
- UI de simulador.
