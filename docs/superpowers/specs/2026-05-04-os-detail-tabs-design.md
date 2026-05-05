# OS Detail — Segmented Tabs + Header Compacto

**Data:** 2026-05-04

---

## Design

### Header Compacto
- Botão voltar + OS # (MonoLabel accent) no topo
- Placa badge + veículo + StatusDot pulsante + status badge lado a lado
- Background: LinearGradient #1c1c1e → #141414

### Segmented Control (5 tabs)
- Geral / Peças / Serviços / Fotos / Histórico
- Estilo iOS: pill background rgba(255,255,255,0.06), ativo com bg rgba(255,255,255,0.10) + shadow
- Fonte: 10px, weight 600

### Conteúdo por Tab

**Geral:** InfoRows em glass card (cliente, tipo, tipo OS, consultor, abertura, previsão) + SectionDivider "TOTAIS" + totais MonoLabel accent

**Peças:** Glass card com line items (descrição, qty, preço MonoLabel) + SectionDivider "TOTAL PEÇAS" + subtotal

**Serviços:** Mesmo layout que peças

**Fotos:** Grid de fotos por pasta (checklist entrada, acompanhamento, etc.) + botão upload acompanhamento

**Histórico:** Timeline com dots vermelhos + linha conectora + transições de status

### Componentes
- Glass cards com glint top (como OSCard)
- InfoRow, SectionDivider, MonoLabel, StatusDot (já existem)
- Novo: `SegmentedControl` genérico reutilizável
