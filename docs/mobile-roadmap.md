# Roadmap Mobile — DS Car Centro Automotivo

**Produto:** App Mobile DS Car (React Native + Expo)
**Objetivo:** Aplicação operacional leve para consultores, mecânicos e gestores, focada em checklist de veículos, gestão de OS e vistorias — sem módulo fiscal.
**Timeline:** 8 sprints (~2 meses) — Sprints M1 a M8
**Stack:** React Native 0.83.4 · Expo SDK 55 · Expo Router v4 · WatermelonDB (offline) · Zustand + MMKV · expo-camera · expo-image-manipulator · react-native-svg · react-native-view-shot
**Distribuição:** Interna (APK direto + TestFlight) — sem publicação em App Store / Google Play
**Público:** ~30 colaboradores internos DS Car (consultores, mecânicos, gestores)

---

## Decisão: Distribuição Interna (não lojas)

O app é para uso exclusivo da equipe DS Car. Publicar nas lojas traria burocracia desproporcional (review Apple de 1-3 dias por update, risco de rejeição por "app de uso interno", custo anual Apple Developer). A distribuição interna permite deploy instantâneo, atualizações OTA sem review, e controle total.

**Android:** APK gerado via EAS Build, distribuído por link no grupo de WhatsApp da equipe ou QR Code na oficina. Instalação em 30 segundos (habilitar "fontes desconhecidas" uma vez).

**iOS:** TestFlight (até 10.000 testadores, builds duram 90 dias, review rápido ~1 dia). Convite por email — funcionário instala pelo app TestFlight.

**Atualizações:** 90% das mudanças via EAS Update (OTA) — automáticas, sem reinstalar. Builds nativos novos apenas ao mudar dependências nativas (~a cada 2-3 meses).

---

## Visão Geral das Fases

| Fase | Sprints | Tema | Status |
|------|---------|------|--------|
| **1 — Fundação** | M1–M2 | Infra, Auth, Navegação, OS read-only | ✅ Concluído |
| **2 — Checklist & Fotos** | M3–M4 | Checklist completo, câmera com marca d'água, anotações | ✅ Concluído |
| **2.5 — UX Polish** | pós-M4 | Nav/Header/Filtros redesign | ✅ Concluído (2026-04-12) |
| **3 — OS Completa** | M5–M6 | Abertura de OS, acompanhamento, vistorias | 🔄 Em andamento (M5) |
| **4 — Documentos & Polish** | M7–M8 | Assinatura digital, termos/recibos PDF, UX final | ⏳ Planejado |

---

## Sprint M1 — Fundação & Autenticação
**Duração:** ~1 semana
**Tema:** Estrutura do projeto, navegação e login

### Entregas

**Scaffold do Projeto Expo**
- Configurar Expo Router v4 com layout de tabs + stack
- Estrutura de pastas: `app/`, `src/components/`, `src/hooks/`, `src/lib/`, `src/stores/`
- Integrar `@paddock/types` do monorepo
- Configurar NativeWind (Tailwind para RN) ou StyleSheet centralizado
- Setup de linting (ESLint + Prettier) e TypeScript strict

**Autenticação**
- Tela de login com email + senha
- Integração OIDC via `expo-auth-session` (Keycloak prod / dev-credentials dev)
- Persistência de token com `expo-secure-store`
- Refresh token automático
- Store Zustand: `useAuthStore` (user, token, activeCompany, role)

**Navegação Animada (Pill Tab Bar)**
- Tab bar customizada estilo "floating pill" — barra preta arredondada flutuando sobre o conteúdo
- 5 ícones: Home (OS) | Busca | + Nova OS | Notificações | Perfil
- Ícone ativo com efeito glow (halo roxo/azul animado ao redor do ícone selecionado)
- Animações de transição entre tabs:
  - Glow: `react-native-reanimated` com `withSpring` — ícone ativo escala de 1→1.2 + blur glow aparece com fade
  - Transição de página: slide horizontal suave (shared element transitions via `react-native-reanimated`)
  - Botão central "+" com animação de press (scale down + haptic feedback)
- Stack por tab (lista → detalhe) com transição push/pop animada
- Splash screen animada + ícone DS Car
- Proteção de rota por role (reuso de `ROLE_HIERARCHY` do `@paddock/types`)
- Tab bar oculta automaticamente ao rolar lista para baixo (reaparece ao rolar para cima)

**API Client**
- Instância Axios/fetch com interceptors (Bearer token, X-Tenant-Domain, trailing slash)
- Tipagem de respostas com types do `@paddock/types`
- Error handling centralizado (toast + retry)

### Critérios de Aceite ✅
- [x] Login funciona com dev-credentials
- [x] Token persiste entre sessões (SecureStore)
- [x] Pill tab bar com glow animado no ícone ativo
- [x] Transições de página suaves (slide horizontal)
- [x] Navegação tabs + stack sem flickering
- [x] TypeScript strict sem erros

---

## Sprint M2 — OS Read-Only + Offline Foundation
**Duração:** ~1 semana
**Tema:** Consulta de OS e infraestrutura offline

### Entregas

**Lista de OS**
- Tela com lista de OS em aberto (filtros: status, consultor, placa)
- Pull-to-refresh + paginação infinita
- Cards com: nº OS, placa, cliente, status (badge colorido), dias na oficina
- Busca por placa ou nº OS
- Filtros rápidos por status (chips horizontais)

**Detalhe da OS (read-only)**
- Header: nº, status, placa/modelo/ano/cor
- Tabs ou seções: Dados gerais | Fotos | Peças & Serviços | Histórico
- Galeria de fotos existentes (por pasta)
- Timeline de atividades (ActivityLog)
- Badge de valores (peças + serviços = total)

**WatermelonDB — Setup Inicial**
- Schema WatermelonDB espelhando `ServiceOrder`, `ServiceOrderPhoto`, `ActivityLog`
- Sync adapter: pull do backend → WatermelonDB local
- Indicador de conectividade (banner "Sem conexão — modo offline")
- Sync automático ao recuperar conexão
- MMKV para preferências rápidas (último filtro, tema)

### Critérios de Aceite ✅
- [x] Lista carrega OS do backend com paginação
- [x] Detalhe exibe todas as informações da OS
- [x] App funciona offline após primeiro sync (lista + detalhe)
- [x] Indicador visual de modo offline

---

## Sprint M3 — Checklist de Veículo (Fotos)
**Duração:** ~1.5 semana
**Tema:** Módulo de checklist fotográfico com silhuetas guia e marca d'água

### Entregas

**Template de Checklist Fotográfico**
- Tela com grid de slots de foto, cada um com silhueta guia semitransparente:
  - **Externo (6):** Frente, Traseira, Lateral Esquerda, Lateral Direita, Diagonal Dianteira Esquerda, Diagonal Traseira Direita
  - **Detalhes (6):** Chave/controle, Painel/odômetro, Motor (capô aberto), Step/estepe, Kit ferramentas, Nível combustível
  - **Extras (∞):** Slots adicionais para fotos livres (danos específicos, acessórios, etc.)
- Cada slot mostra: ícone silhueta + label + status (pendente/concluído/com observação)
- Progresso visual: barra de conclusão do checklist (ex: "8 de 12 fotos obrigatórias")
- Reordenação de fotos não bloqueante — pode pular e voltar

**Câmera com Marca d'Água**
- Captura via `expo-camera` com preview em tela cheia
- Flash toggle + câmera frontal/traseira
- Marca d'água aplicada automaticamente via `expo-image-manipulator` (no device, antes do upload):
  - **Topo:** Logo DS Car Centro Automotivo (semitransparente)
  - **Rodapé:** `DS Car · João Silva · 10/04/2026 14:32` (nome oficina, nome do usuário logado, data/hora)
  - Fonte branca com sombra preta (legível em qualquer fundo)
- Compressão inteligente: redimensionar para max 1920px no maior eixo, JPEG 80% — balanceia qualidade vs. tamanho para upload

**Fila de Upload Offline**
- Fotos salvas no filesystem local (expo-file-system)
- Fila de upload gerenciada por store Zustand
- Upload em background quando há conexão (chunks se > 5MB)
- Indicador por foto: ✓ enviado | ↻ enviando | ⏳ na fila | ✕ erro (retry)
- Metadata em MMKV: `{ photoId, osId, folder, slot, watermarked, uploadStatus, localUri, s3Key }`

### Critérios de Aceite ✅
- [x] Grid de checklist exibe silhuetas corretas para cada slot
- [x] Câmera captura e aplica marca d'água automaticamente
- [x] Fotos aparecem no slot correto após captura
- [x] Funciona 100% offline — fotos ficam na fila e enviam quando reconectar
- [x] Barra de progresso reflete fotos obrigatórias vs. capturadas

---

## Sprint M4 — Checklist de Veículo (Itens + Anotações nas Fotos)
**Duração:** ~1.5 semana
**Tema:** Checklist de itens (checkboxes), editor de anotações nas fotos

### Entregas

**Checklist de Itens (não-fotográfico)**
- Lista de categorias com itens checkbox:
  - **Lataria/Pintura:** Amassados, Riscos, Ferrugem, Pintura descascando
  - **Vidros:** Para-brisa, Traseiro, Laterais, Retrovisores
  - **Iluminação:** Faróis, Lanternas, Setas, Luz de freio, Luz de ré
  - **Pneus:** Dianteiro E/D, Traseiro E/D (estado: bom/regular/ruim/ausente)
  - **Interior:** Bancos, Painéis, Tapetes, Ar-condicionado, Rádio/Multimídia
  - **Acessórios:** Macaco, Chave de roda, Triângulo, Extintor, Documentos no porta-luvas
  - **Mecânico Visual:** Vazamentos, Correias aparentes, Nível de óleo, Bateria
- Cada item: checkbox + opção de gravidade (OK / Atenção / Crítico) + campo de observação
- Template configurável por tipo de OS (bodywork vs. mechanical vs. aesthetic)
- Resumo: contadores de OK / Atenção / Crítico

**Editor de Anotações nas Fotos**
- Ao tocar numa foto capturada, abre editor básico com:
  - **Seta:** toque no ponto de origem + arraste até destino (cor vermelha, ponta sólida)
  - **Círculo:** toque e arraste para definir raio (borda vermelha, preenchimento transparente)
  - **Texto livre:** caixa de texto posicionável sobre a foto
  - **Cores:** vermelho (padrão), amarelo, branco — seletor simples
  - **Desfazer/Refazer:** até 10 ações
  - **Salvar:** gera nova imagem com anotações "flattenizadas" (preserva original sem anotação no S3)
- Campo de observação geral da foto (texto, abaixo da imagem)
- Anotações salvas como JSON no metadata da foto (para replay no web)

**Vinculação Checklist ↔ OS**
- Checklist sempre vinculado a uma OS existente (ou recém-criada)
- Ao concluir checklist, atualiza folder `checklist_entrada` na OS
- Status do checklist: Rascunho → Concluído → Enviado
- Checklist concluído é imutável (pode adicionar complemento, nunca editar)

### Critérios de Aceite ✅
- [x] Checklist de itens com 7 categorias funciona e persiste offline
- [x] Editor de anotações funciona com seta, círculo e texto
- [x] Anotações salvas como layer separada (original preservada)
- [x] Checklist vinculado à OS e visível na web após sync (bulk endpoint disponível)
- [x] Resumo de gravidade (OK/Atenção/Crítico) exibido corretamente

---

## Refinamentos UX pós-M4 — Nav/Header/Filtros ✅
**Entregues em 2026-04-12 (sessão dedicada)**

### FrostedNavBar
- Reescrita completa: T2 dark pill `#141414`, sem BlurView
- `activeLine` vermelha com glow (3px) abaixo do ícone ativo
- Botão central `+` vermelho (red pill com shadow)
- Correções: HIDDEN_ROUTES removeu `'os'`; TAB_CONFIG `routeName: 'os' → 'index'`
- Busca → Agenda (calendar icon); Perfil → Config (settings icon)

### OSHeader
- LinearGradient `#1c1c1e → #141414`
- Layout DubiCars: `[spacer][logo DS Car centralizado][bell]`
- Sem saudação, sem nome de usuário
- Removido header nativo duplicado "Ordens de Serviço"
- `headerBackTitle: 'Voltar'` no detalhe da OS
- Removido botão de voltar customizado em `OSDetailHeader`

### Busca (useServiceOrders.ts)
- Expandida: `vehicle_plate`, `customer_name`, `vehicle_model`, `vehicle_brand` + `number`

### Filtros por status
- Removed: ScrollView horizontal com chips
- Adicionado: botão `options-outline` ao lado da busca → bottom-sheet modal com todos os status
- Active filter label bar com × para limpar

---

## Sprint M5 — Abertura de OS no Mobile
**Duração:** ~1 semana
**Tema:** Criação de OS completa pelo celular

### Entregas

**Fluxo de Abertura**
- Wizard em 4 steps:
  1. **Veículo:** Consulta por placa (API placa-fipe) → auto-fill marca/modelo/ano/cor/chassi. Campo manual se offline.
  2. **Cliente:** Busca por nome/CPF/telefone. Cadastro rápido inline (nome + telefone + CPF). LGPD consent checkbox.
  3. **Tipo de OS:** customer_type (Seguradora/Particular), os_type, seguradora (se aplicável), número sinistro, franquia.
  4. **Revisão:** Resumo de tudo antes de confirmar. Botão "Criar OS e Iniciar Checklist" (atalho direto).
- Número da OS gerado automaticamente (MAX + 1, no backend)
- Status inicial: `reception`
- Funciona offline: cria OS local no WatermelonDB, sincroniza quando conectar

**Consulta de Placa Offline**
- Cache de placas recentes no MMKV (últimas 50)
- Fallback para digitação manual quando offline
- Indicador claro: "Dados da placa buscados automaticamente" vs. "Preenchimento manual"

**Atalho Checklist Pós-Abertura**
- Ao criar OS, oferece "Iniciar Checklist Agora" → abre direto no módulo de checklist com a OS vinculada
- Também acessível depois pela tela de detalhe da OS

### Critérios de Aceite
- [ ] Wizard de 4 steps completo e funcional
- [ ] Consulta de placa funciona online e fallback manual offline
- [ ] OS criada com todos os campos obrigatórios
- [ ] Transição direta para checklist após criação
- [ ] Criação offline sincroniza corretamente

---

## Sprint M6 — Acompanhamento de Reparos + Vistorias
**Duração:** ~1 semana
**Tema:** Atualização de status, fotos de acompanhamento e vistorias de entrada/saída

### Entregas

**Acompanhamento de Reparos**
- Mecânico/técnico pode:
  - Atualizar status da OS (validação `VALID_TRANSITIONS` client-side + backend)
  - Adicionar fotos na pasta `acompanhamento` (com marca d'água)
  - Adicionar observação/nota à OS
- Timeline visual de progresso (status atual + próximos passos)
- Notificação push (Expo Notifications) quando OS muda de status

**Vistoria Inicial**
- Fluxo dedicado acessível pela OS em status `initial_survey`
- Inclui: checklist fotográfico completo + checklist de itens + observações gerais
- Ao concluir, marca vistoria como realizada e sugere transição para `budget`
- Fotos vão para pasta `vistoria_inicial`

**Vistoria Final**
- Fluxo similar à vistoria inicial, acessível em status `final_survey`
- Foco em comparação: mostra foto da vistoria inicial lado a lado (antes/depois)
- Checklist reduzido: confirmar que reparos foram realizados
- Ao concluir, sugere transição para `ready`
- Fotos vão para pasta `vistoria_final`

**Comparativo Visual**
- Tela de comparação antes/depois (split view ou swipe)
- Mesma posição/slot da vistoria inicial vs. final
- Útil para apresentar ao cliente e à seguradora

### Critérios de Aceite
- [ ] Status da OS pode ser atualizado respeitando VALID_TRANSITIONS
- [ ] Fotos de acompanhamento com marca d'água e upload
- [ ] Vistoria inicial completa (fotos + checklist + transição)
- [ ] Vistoria final com comparativo antes/depois
- [ ] Push notifications funcionando para mudança de status

---

## Sprint M7 — Assinatura Digital + Termos e Recibos
**Duração:** ~1 semana
**Tema:** Captura de assinatura na tela, geração de PDFs de termos e comprovantes

### Entregas

**Componente de Assinatura Digital**
- Canvas de assinatura via `react-native-signature-canvas` ou implementação custom com `react-native-svg`
- Captura a assinatura do cliente com o dedo na tela
- Preview antes de confirmar
- Exporta como PNG transparente (para embutir em PDFs)
- Salva: imagem da assinatura + timestamp + geolocalização (opcional) + IP

**Termos e Documentos**
- **Termo de Recebimento de Veículo:** Gerado automaticamente com dados da OS + checklist. Cliente assina na tela. PDF gerado e salvo no S3 (pasta `documentos`).
- **Termo de Entrega de Veículo:** Similar, com dados de saída (KM saída, estado final). Assinatura do cliente. Comparativo resumido da vistoria.
- **Autorização de Serviço:** Para OS de particular — descreve orçamento e serviços aprovados. Assinatura autoriza execução.
- **Comprovante de OS:** Resumo da OS com QR Code para consulta online.

**Geração de PDF no Device**
- Gerar PDFs via `react-native-html-to-pdf` (HTML template → PDF)
- Templates HTML com branding DS Car (logo, cores, fontes)
- Assinatura embutida como imagem no PDF
- Compartilhamento: WhatsApp, e-mail ou impressão (via AirPrint/Google Cloud Print)

**Histórico de Documentos**
- Lista de todos os termos/comprovantes gerados para a OS
- Preview do PDF inline
- Reenvio por WhatsApp (deep link Evolution API)

### Critérios de Aceite
- [ ] Assinatura capturada na tela com boa qualidade
- [ ] PDFs gerados corretamente com branding DS Car
- [ ] Assinatura embutida no PDF
- [ ] Compartilhamento funciona (WhatsApp + email)
- [ ] Documentos persistem offline e sincronizam

---

## Sprint M8 — Polish, Performance & Preparação para Lançamento
**Duração:** ~1 semana
**Tema:** UX polish, testes, performance e build de produção

### Entregas

**UX & Performance**
- Skeleton loaders em todas as listas
- Animações suaves de transição (Reanimated)
- Otimização de imagens: thumbnails para lista, full-size sob demanda
- Teste de performance com 100+ OS e 500+ fotos
- Memory profiling (fotos grandes não devem causar OOM)
- Haptic feedback em ações críticas (foto capturada, assinatura salva, status alterado)

**Sync & Conflitos**
- Resolução de conflitos: "last write wins" com aviso ao usuário
- Retry exponencial para uploads falhados
- Dashboard de sync: "X fotos pendentes, última sync há Y minutos"
- Wipe de dados local ao trocar de tenant/empresa

**Testes**
- Testes unitários: stores, hooks, utils (Jest)
- Testes de integração: fluxos de checklist e OS (Detox ou Maestro)
- Teste de offline: simular desconexão em cada fluxo crítico
- Teste de permissões: cada role vê apenas o que deve

**Build & Distribuição Interna**
- Configuração EAS Build (Expo Application Services)
- Perfis: `development` (dev local), `preview` (TestFlight + APK interno), `production` (release final)
- OTA updates via EAS Update — mudanças de JS/assets chegam automaticamente, sem reinstalar
- Builds nativos assinados (iOS: provisioning profile ad-hoc / TestFlight, Android: keystore próprio)
- CI/CD: GitHub Actions → EAS Build → link de download automático
- Canal de distribuição: página interna simples (`app.dscar.paddock.solutions`) com:
  - Botão "Baixar para Android" (link direto pro APK)
  - Botão "Baixar para iPhone" (link do TestFlight)
  - QR Code para ambos
  - Versão atual e changelog resumido
- QR Code impresso na recepção e no refeitório da oficina

**Monitoramento**
- Sentry React Native (crash reporting + performance)
- Analytics básico: telas mais acessadas, tempo no checklist, taxa de conclusão
- Health check de sync no Grafana (métricas do backend)
- Dashboard de adoção: quantos funcionários instalaram, última atividade por usuário

### Critérios de Aceite
- [ ] App roda sem crash em 24h de uso contínuo
- [ ] Build de produção (iOS + Android) gerado com sucesso
- [ ] Sentry capturando erros corretamente
- [ ] Fluxo completo testado: login → criar OS → checklist → vistoria → assinatura → entrega
- [ ] Performance: lista de OS carrega em < 500ms, câmera abre em < 1s
- [ ] Página de distribuição interna funcionando com links e QR Code

---

## Plano de Adoção e Rollout

A introdução do app na rotina da oficina é tão importante quanto o desenvolvimento. Segue o plano em 3 ondas, alinhado com as fases de entrega.

### Onda 1 — Piloto com Recepção (ao final da Fase 2, Sprint M4)
**Quem:** 3-4 consultores/recepcionistas (os mais abertos a tecnologia)
**O quê:** Usar o app para fazer o checklist de entrada de veículos em paralelo com o processo atual (papel/web)
**Objetivo:** Validar que o fluxo de fotos + checklist funciona no dia a dia real, coletar feedback de UX
**Duração:** 1-2 semanas de uso paralelo
**Ações:**
- Sessão de 30 minutos presencial: instalar o app, explicar o fluxo, fazer um checklist juntos num veículo de teste
- Criar grupo de WhatsApp "App DS Car — Piloto" para feedback rápido e bugs
- Checklist no papel continua valendo — o app é complementar, não substitui ainda
- No fim da semana, reunião de 15 min: "o que funcionou, o que travou, o que falta"
- Ajustes de UX baseados no feedback antes de expandir

### Onda 2 — Expansão para Oficina (ao final da Fase 3, Sprint M6)
**Quem:** Todos os consultores + mecânicos/técnicos (15-20 pessoas)
**O quê:** App vira ferramenta oficial para checklist e acompanhamento de OS
**Objetivo:** Substituir processos manuais de checklist e atualização de status
**Ações:**
- Workshop de 1 hora por turno (manhã e tarde) — presencial na oficina
- Demonstração prática: abrir OS, fazer checklist completo, atualizar status
- Material de apoio: guia rápido de 1 página plastificado no posto de cada mecânico
- Definir "campeões" por setor — 1 pessoa de referência que ajuda os colegas
- Processo antigo (planilha/papel) desligado gradualmente: 1ª semana paralelo, 2ª semana só app
- Acompanhamento diário na 1ª semana: verificar se todos estão usando, resolver dúvidas

### Onda 3 — Operação Completa (ao final da Fase 4, Sprint M8)
**Quem:** Toda a equipe incluindo gestores
**O quê:** App é a ferramenta padrão para todo o ciclo da OS (abertura → checklist → acompanhamento → vistoria → assinatura → entrega)
**Objetivo:** 100% das OS passam pelo app, papel eliminado
**Ações:**
- Gestores recebem treinamento focado em acompanhamento (não operação)
- Assinatura digital do cliente passa a ser o padrão na entrega de veículos
- Indicadores de adoção no dashboard: % de OS com checklist mobile, % de fotos com marca d'água, tempo médio de checklist
- Reunião mensal de retrospectiva: melhorias solicitadas viram itens do backlog
- Meta: 90% das OS com checklist completo no mobile em 30 dias

### Gestão de Dispositivos
**Celulares pessoais vs. corporativos:**
- Fase inicial: usar celulares pessoais dos funcionários (mais prático, menos custo)
- Se necessário: 2-3 celulares Android básicos compartilhados na recepção (para quem não quer usar o pessoal)
- Modelo sugerido para compartilhados: qualquer Android com 4GB+ RAM e câmera de 12MP+ (custo ~R$ 800-1.200)
- O app não acessa dados pessoais do celular — só usa câmera, storage local isolado e internet

### Comunicação Interna
- Antes do lançamento: comunicado do gestor/dono explicando o porquê do app (não é controle, é facilitar o trabalho e proteger a empresa com fotos)
- Enfatizar benefícios para o funcionário: menos papel, checklist mais rápido, foto como prova que o carro já veio com o dano
- Evitar tom de imposição — posicionar como ferramenta que facilita, não que fiscaliza
- Celebrar marcos: "100ª OS com checklist mobile" no grupo da equipe

---

## Sugestões Adicionais (Backlog Pós-MVP)

### Scanner de Documentos
Usar a câmera para escanear documentos (CRLV, CNH, apólice) com crop automático e OCR. Associar à OS automaticamente.

### Leitor de QR/Barcode
Ler código de barras de peças para busca rápida no estoque. Vincular peça à OS direto pelo celular.

### Modo Perito
Acesso limitado para peritos externos: vêem apenas a OS designada, podem adicionar fotos e observações na vistoria, mas não alteram status nem vêem valores. (Backlog — você mencionou que vistorias são internas por agora, mas o modelo já comporta.)

### Painel de Gestão no Mobile
Dashboard com indicadores: OS por status, gargalos (tempo médio por etapa), ocupação da oficina. Para o gestor acompanhar sem abrir o computador.

### Integração WhatsApp
Botão "Enviar atualização ao cliente" que manda mensagem template via Evolution API com status da OS + link de acompanhamento.

### Checklist por Tipo de Serviço
Templates de checklist diferenciados: chapeação tem foco em lataria, mecânica em motor e suspensão, estética em pintura e acabamento. O tipo de OS seleciona o template automaticamente.

### Vídeo Curto de Vistoria
Gravar vídeo de até 30s durante vistoria (walkthrough do veículo). Comprimido e enviado para S3 com marca d'água.

---

## Dependências Técnicas

| Dependência | Sprint | Descrição |
|-------------|--------|-----------|
| Backend: API de checklist items | M3 | Novo endpoint para salvar itens do checklist (não existe ainda) |
| Backend: API de assinatura | M7 | Endpoint para salvar PNG da assinatura vinculada à OS |
| Backend: Template de PDF | M7 | Templates HTML dos termos (pode ser no mobile ou no backend) |
| Backend: Push notifications | M6 | Celery task que dispara push via Expo Push API ao mudar status |
| Backend: Sync endpoint | M2 | Endpoint otimizado para sync incremental (WatermelonDB protocol) |
| Infra: Expo Push Service | M6 | Configurar credenciais FCM (Android) e APNS (iOS) |
| Design: Silhuetas de veículo | M3 | Assets SVG das silhuetas (frente, traseira, laterais, etc.) |
| Design: Templates de termos | M7 | Layout HTML dos 4 tipos de documento |
| Infra: Página de distribuição | M8 | Landing page interna com links de download e QR Code |
| Infra: Apple Developer Account | M1 | Necessário para TestFlight (iOS) — US$99/ano |
| Gestão: Comunicado interno | M4 | Comunicação do gestor à equipe antes do piloto |
| Gestão: Guia rápido impresso | M6 | 1 página plastificada com fluxo básico do app |

---

## Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| WatermelonDB complexo de sincronizar com Django | Alto | Começar simples (pull-only M2), bidirecional apenas M5+ |
| Marca d'água pesada no device | Médio | Benchmark no Sprint M3, fallback para server-side se performance ruim |
| Fotos grandes enchem storage do celular | Médio | Compressão agressiva + limpeza automática de fotos já sincronizadas |
| Assinatura juridicamente frágil | Baixo | Capturar timestamp + geolocalização + IP — não é assinatura qualificada ICP-Brasil, mas é prova documental válida |
| Offline-first gera conflitos | Médio | "Last write wins" + notificação ao usuário + log de conflitos |
| Resistência da equipe ao app | Alto | Rollout em 3 ondas, piloto com voluntários, comunicação positiva, não impositiva |
| Celulares pessoais com pouco espaço | Médio | Compressão agressiva de fotos, limpeza automática de cache após sync, app < 50MB |
| Funcionário sem smartphone adequado | Baixo | 2-3 celulares Android compartilhados na recepção (custo ~R$ 2.400-3.600 total) |
| TestFlight expira a cada 90 dias (iOS) | Baixo | CI/CD gera build automaticamente a cada release — sempre renovado |

---

*Paddock Solutions · paddock.solutions · Manaus, AM*
*Documento criado em: Abril 2026*
