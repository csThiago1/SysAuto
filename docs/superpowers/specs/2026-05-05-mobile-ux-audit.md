# Auditoria UX/UI — DS Car Mobile

**Data:** 2026-05-05
**Decisão de design:** App é dark-only (sem tema claro). Decisão intencional — ERP profissional automotivo.

---

## CRÍTICO (7 itens)

1. **`checklist/[osId].tsx:142-147`** — Texto invisível no header. `color: Colors.bg` (#141414) sobre `backgroundColor: Colors.surface` (#1c1c1e). Contraste ~1:1. **Fix:** usar `Colors.textPrimary`.

2. **`login.tsx:90,109`** — Placeholder invisível. `placeholderTextColor="#333"` sobre fundo quase preto. **Fix:** usar `Colors.textTertiary` (#6b7280).

3. **`SegmentedControl.tsx:54-57`** — Texto inativo abaixo de WCAG AA. `rgba(255,255,255,0.35)` em fontSize 10. **Fix:** `rgba(255,255,255,0.55)` e fontSize 11.

4. **`os/[id].tsx:~1000`** — Touch target botão voltar ~30px. **Fix:** adicionar `hitSlop={{ top: 11, bottom: 11, left: 11, right: 11 }}`.

5. **`OSDetailHeader.tsx:94-97`** — Touch target botão voltar insuficiente. **Fix:** `padding: Spacing.md` (12px).

6. **`busca/index.tsx:220-232`** — Botão limpar busca é letra "x" sem ícone. **Fix:** `Ionicons close-circle` + hitSlop 12px. Mesmo em histórico linha 172.

7. **`busca/index.tsx:217`** — `autoCapitalize="characters"` força tudo maiúsculo. **Fix:** `autoCapitalize="none"`.

## IMPORTANTE (15 itens)

1. **`theme.ts:67-73`** — `Colors.success` (#16a34a) vs `SemanticColors.success.color` (#4ade80) — dois verdes diferentes. **Fix:** deprecar `Colors.success/warning/error/info`, usar apenas `SemanticColors.*`.

2. **`FrostedNavBar.tsx:211-225`** — Pill sem borda glass. **Fix:** adicionar `borderWidth: 1, borderColor: Colors.border, borderTopColor: Colors.borderGlintTop`.

3. **`FrostedNavBar.tsx:127`** — Ícones inativos 28% opacidade (contraste <2:1). **Fix:** `rgba(255,255,255,0.45)`.

4. **`agenda/index.tsx` e `notificacoes/index.tsx`** — Importam `Text` do RN em vez de `@/components/ui/Text`. **Fix:** trocar imports.

5. **`Card.tsx`** — Sem glint glass (flat vs OSCard). **Fix:** adicionar `borderTopColor: Colors.borderGlintTop`.

6. **`InfoRow.tsx:47-49`** — Divider opacity 0.04 invisível. **Fix:** usar `Colors.divider` (0.06).

7. **`notificacoes/index.tsx:137`** — Texto "tenant" exposto ao usuário. **Fix:** "Atualizações de status das ordens de serviço".

8. **`OSStatusBadge`** — Sem borda, inconsistente com SemanticBadge. **Fix:** adicionar `borderWidth: 1`.

9. **3 tab bars diferentes** — checklist, vistoria entrada, vistoria saída. **Fix:** criar componente compartilhado ou usar SegmentedControl.

10. **`agenda/index.tsx:388`** — Seleção de data invisível. **Fix:** `backgroundColor: Colors.brandTint, borderColor: Colors.brand`.

11. **`perfil/index.tsx:103-109`** — Avatar sem borda/sombra glass. **Fix:** adicionar border + Shadow.sm.

12. **`os/index.tsx:469`** — Cor hardcoded `#fff1f1`. **Fix:** usar token.

13. **`checklist/index.tsx:54-58`** — Placa sem estilo mono/plate. **Fix:** usar `Typography.plate`.

14. **`nova-os/index.tsx:188-192`** — Barra progresso cor inativa errada (`Colors.cardTop`). **Fix:** `Colors.borderSubtle`.

15. **`os/[id].tsx`** — Header reimplementado inline. **Fix:** usar `OSDetailHeader` existente.

## POLISH (14 itens)

1. **`login.tsx:164`** — Fundo #0a0a0a diferente de Colors.bg #141414. **Fix:** unificar.
2. **`Typography.mono`** — Sem fontSize. **Fix:** adicionar 14.
3. **`Button.tsx` ghost** — Label muito opaca. **Fix:** `Colors.textSecondary`.
4. **`SemanticBadge.tsx`** — letterSpacing 0.3 apertado. **Fix:** 0.8 mínimo.
5. **`SectionDivider.tsx`** — hairlineWidth pode ser 0 em Android. **Fix:** `Math.max(hairlineWidth, 0.5)`.
6. **`NeonLines.tsx`** — Cores hardcoded fora do tema.
7. **`StatusDot.tsx`** — Retorna `<View />` vazio. **Fix:** retornar `null`.
8. **`os/index.tsx`** — Empty state sem ícone. **Fix:** adicionar Ionicons.
9. **`os/[id].tsx` LineItemRow** — Total em textSecondary. **Fix:** MonoLabel accent.
10. **`os/[id].tsx` totais** — Hierarquia fraca subtotais. **Fix:** variant mono.
11. **`agenda/index.tsx`** — Day headers sem Typography.labelMono.
12. **`OSCard.tsx:80`** — insurerAbbr sobrescreve brandColor.
13. **`nova-os/index.tsx`** — Sem nome da etapa no wizard.
14. **`os/[id].tsx`** — `Colors.success` em texto (contraste ruim). **Fix:** `SemanticColors.success.color`.
