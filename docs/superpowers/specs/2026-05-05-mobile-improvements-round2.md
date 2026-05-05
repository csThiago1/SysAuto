# Mobile Improvements Round 2

**Data:** 2026-05-05

---

## Sprint A — Splash Screen Neon
- Splash screen com fundo #141414, NeonLines animadas, logo DS Car branca centralizada
- Substituir a splash genérica atual
- Usar expo-splash-screen para controlar exibição

## Sprint B — Funcionalidade
- Pull-to-refresh na lista de OS (FlatList refreshControl)
- Indicador de connectivity global (banner sutil no topo quando offline)
- Tab Fotos no OS detail: grid de fotos agrupadas por pasta + upload acompanhamento

## Sprint C — Telas Secundárias
- Agenda: redesign com glass cards, eventos mais visuais, empty state
- Notificações: glass cards, ícones por tipo, empty state com ícone
- Perfil: layout mais rico, seções com SectionDivider, versão do app

## Sprint D — Animações e Transições
- Tab switch no SegmentedControl: animação de slide/fade
- Skeleton loading com shimmer animado (gradiente que viaja)
- Transições entre telas (fade/slide via expo-router)
