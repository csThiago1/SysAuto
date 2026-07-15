# PWA Modo Operação — Design

**Data:** 2026-07-15 · **Status:** aprovado em brainstorming
**Objetivo:** transformar a experiência mobile do dscar-web num "modo operação" enxuto
(dashboard, kanban, detalhe de OS, apontamento, vistoria, cadastro de OS via wizard, agenda),
mantendo o desktop intocado.

## Decisões de escopo (aprovadas)

| Decisão | Escolha |
|---|---|
| Corte de funções | Por dispositivo **e** por papel: mobile mostra só o modo operação; MANAGER+ ganha menu "Mais" com a navegação completa |
| Cadastro de OS | Wizard enxuto de recepção (placa → cliente → fotos → criar em `reception`); formulário completo continua no desktop |
| Apontamento | Timer + lançamento manual; tempo sempre derivado de `iniciado_em` no servidor |
| Vistoria | Fotos entrada/saída + checklist + assinatura do cliente, em tela dedicada |
| Menu "Mais" | Reusa `nav-config.ts` filtrado por role — sem segunda fonte de verdade |
| Login p/ apontar | Híbrido: sessão logada seleciona o técnico (FK `tecnico` → GlobalUser) |
| Arquitetura | **Abordagem A** — shell responsivo no mesmo `(app)`: tab bar substitui DockNav no mobile (<`md`); rotas e páginas existentes reusadas |

## 1. Shell mobile e navegação

- `components/mobile/MobileTabBar.tsx`: fixa no rodapé, `md:hidden`,
  `padding-bottom: env(safe-area-inset-bottom)` (+ `viewport-fit=cover` no layout raiz).
- Tabs: Início (`/dashboard`), OS (`/os/kanban`), Agenda (`/agenda`),
  Apontamento (`/apontamento`); "Mais" (sheet) apenas MANAGER+.
- FAB "Nova OS" flutuante acima da tab bar → `/recepcao`; escondido em sub-rotas de fluxo
  (wizard, vistoria) via lista de subpaths (padrão HIDDEN_SUBPATHS do app RN).
- Sheet "Mais": renderiza seções do `nav-config.ts` filtradas por role.
- Definição das tabs vive no próprio `nav-config.ts` (array `MOBILE_TABS`).
- DockNav ganha `hidden md:*`; desktop inalterado.
- O corte é navegacional: rotas continuam acessíveis por URL, RBAC segue sendo a régua
  de segurança. Sem bloqueio por viewport.

## 2. Wizard de recepção (`/recepcao`)

4 passos, RHF + Zod, estado em memória até o submit:

1. **Placa** — consulta placa-fipe pré-preenche marca/modelo/ano/cor; falha → entrada
   manual com selects do `vehicle_catalog`. Placa com OS aberta → aviso + link.
2. **Cliente** — busca por nome/telefone; não achou → quick-create mínimo (nome +
   telefone, PF). Sem CPF/endereço no wizard (LGPD: menos PII no pátio).
3. **Fotos de entrada** — captura pela câmera, preview em grid, fotos locais até o
   submit. Mesmo componente de captura da tela de vistoria.
4. **Confirmar** — cria OS em `reception` (número gerado no backend, nunca enviado) →
   upload sequencial das fotos com progresso → redireciona pro detalhe com CTA
   "Completar vistoria".

**Offline:** criação e uploads via fila da Onda 5. **Erros:** falha de upload não perde
a OS; fotos pendentes ficam na fila com retry e o resumo mostra a contagem.

## 3. Apontamento (`/apontamento`)

Backend pronto: `ApontamentoHoras` (`iniciado_em`/`encerrado_em`, status
iniciado→encerrado→validado, action `POST /encerrar`, `client_uuid` p/ idempotência).

- Decorrido **sempre calculado de `iniciado_em`** — nunca contado no client. Ao abrir,
  query de apontamentos `status=iniciado` reidrata o timer.
- Fluxo: seleciona técnico (memorizado no device) → seleciona OS (busca placa/número em
  etapas produtivas) e intervenção opcional → Iniciar → anel roxo → Finalizar
  (`/encerrar`). Sem botão pausar (pausa = finalizar + iniciar de novo).
- Manual: form OS/técnico/início/fim em `datetime-local` com conversão UTC→local correta.
- Lista "Hoje": apontamentos do dia do técnico selecionado.
- Offline: iniciar/encerrar na fila com `client_uuid`.
- Verificar na implementação: `create` do ViewSet aceita `tecnico` do payload.

## 4. Vistoria (`/os/[numero]/vistoria`)

Segmento Entrada/Saída no topo; acessada do detalhe da OS e do CTA final do wizard.

- **Fotos:** grid 3 colunas por seção, componente de captura compartilhado com o wizard;
  reusa infra da galeria (`ServiceOrderPhoto`, R2, soft delete, fotos imutáveis).
  Fotos ganham marcação entrada/saída — migration pequena se o campo não existir.
  Marca d'água: reusa se a galeria já fizer; senão canvas antes do upload.
- **Checklist:** itens do `ChecklistItem` como toggles por vistoria, persistidos na OS.
- **Assinatura:** canvas signature_pad, cliente assina na hora; salva no app
  `signatures` vinculada à vistoria (entrada/saída). Assinatura do funcionário vem do
  cadastro RH.
- **Header de pendências:** "8 fotos · checklist 12/14 · assinatura pendente".
- **Offline:** fotos e assinatura na fila da Onda 5.

## Testes

- Vitest: máquina de passos do wizard, cálculo de decorrido do apontamento, filtro de
  role da tab bar/MOBILE_TABS.
- pytest: campo categoria da foto (se houver migration) e create de apontamento com
  `tecnico` do payload (se precisar mexer no serializer).

## Fora de escopo

- Bloqueio de rotas por viewport; redesign das telas desktop; app nativo; pausa real no
  timer (estado adicional no backend); tela de configuração de checklist.
