# Smoke Ciclo 03B — Frontend

## Setup

1. Backend rodando: `cd backend/core && python manage.py runserver`
2. Frontend: `cd apps/dscar-web && npm run dev`
3. Browser: http://localhost:3000

## Pré-requisitos

- Banco populado com seeds (`python manage.py seed_all` ou equivalente)
- Variável `VITE_API_URL=http://localhost:8000/api/v1` configurada em `.env`
- Usuário de teste criado com permissões de Administrador

## Fluxo a validar

1. [ ] Login JWT funciona (credenciais válidas retornam token, tela de login some)
2. [ ] Lista de Orçamentos carrega via sidebar "Orçamentos" (vazia OK, sem erro 5xx)
3. [ ] Criar novo Orçamento clicando "Novo Orçamento" (formulário abre)
4. [ ] Abrir detalhe de um orçamento existente — ver versão v1 com status "Rascunho"
5. [ ] Adicionar item com descrição, quantidade e preço — item aparece na tabela
6. [ ] Enviar ao cliente (botão "Enviar") — status muda para "Enviado", PDF gerado no backend
7. [ ] Abrir PDF em nova aba via botão "Ver PDF" — download real (WeasyPrint)
8. [ ] Aprovar orçamento com campo "Aprovado por" preenchido — cria OS automaticamente
9. [ ] Ver OS V2 criada automaticamente (sidebar ou link direto)
10. [ ] Timeline da OS mostra eventos `BUDGET_LINKED` e `VERSION_CREATED` em ordem cronológica
11. [ ] Mover OS no KanbanV2 (arrastar ou menu de status) — timeline atualizada com `STATUS_CHANGE`
12. [ ] Registrar pagamento na aba "Pagamentos" — aparece na lista com valor e método corretos
13. [ ] TanStack DevTools aberto (canto inferior direito) mostra queries ativas e mutations executadas

## Verificações adicionais

- [ ] Componentes exibem skeleton durante loading (não tela branca)
- [ ] Erros de API (4xx, 5xx) são exibidos no componente, não travam a aplicação
- [ ] Campo de busca no KanbanV2 filtra por OS number, placa ou nome do cliente
- [ ] Complemento particular só aparece em OS de tipo SEGURADORA (aba "Complemento")
- [ ] Hot-reload do Vite funciona ao editar arquivos (sem perder estado da query)

## Critérios de sucesso

Todos os 13 passos do fluxo principal marcados como concluídos.
Zero erros no console do browser de origem React/TypeScript (warnings de deps OK).
