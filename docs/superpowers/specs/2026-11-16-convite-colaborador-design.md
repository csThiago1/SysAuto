# Convite de colaborador — design

Data: 16/11/2026 · Aprovado pelo Thiago na conversa (link por pessoa, papel escolhido ao gerar o convite).

## Intenção

O Thiago quer que a própria pessoa se cadastre: ele gera um convite, manda o link pelo WhatsApp, e a pessoa preenche
nome completo, e-mail, CPF, telefone, cria a senha e, se quiser, anexa a CNH (cópia para o termo do RH).
Toda conta vira usuário (GlobalUser) **e** funcionário (Employee). O papel de cada um é controlado pelo Thiago
na tela Configurações → Usuários.

## Objetivos

- Botão "Convidar" em Configurações → Usuários: escolhe o papel e gera um link copiável.
- Link de uso único, válido por 7 dias, revogável.
- Página pública `/convite/<token>` com o formulário; ao enviar cria GlobalUser + Employee (+ Person, CPF, contatos) e,
  se houver arquivo, `EmployeeDocument` do tipo CNH.
- Usuários de produção sem perfil de funcionário (Thiago, Gabriel, Chrystyan, admin) ganham o perfil.

## Fora do escopo

- Envio do convite por e-mail (produção talvez não tenha Resend configurado; o link vai por WhatsApp).
- Gerar o termo do RH em PDF — a CNH só fica anexada.
- Etapa de aprovação: o link é individual e já carrega o papel.

## Anti-objetivos

- Link reaproveitável criando várias contas.
- CPF, telefone ou e-mail em texto claro no banco ou nos logs.
- Senha = CPF (o fluxo de admissão atual faz isso; o convite não pode).
- Apagar arquivo de CNH do S3 (soft delete apenas).

## Abordagens consideradas

1. **Tabela `Invite` (escolhida).** Token aleatório guardado só como hash, papel, validade, quem criou, quando usou,
   revogado. Uso único e revogação garantidos pelo banco.
2. Link assinado sem tabela (`django.core.signing`): menos código, mas o mesmo link cria contas até expirar e não
   dá para revogar.
3. Reaproveitar `EmailVerificationToken`/`PasswordResetToken`: exigem o usuário criado antes; aqui a pessoa é quem cria.

## Desenho

### Backend (`apps/authentication`, schema public)

- Model `Invite(PaddockBaseModel)`: `token_hash` (sha256, único), `role` (GlobalUser.Role), `tenant_schema`
  (schema de quem gerou — o Employee mora no tenant), `expires_at`, `created_by` (FK GlobalUser), `used_at`,
  `used_by` (FK GlobalUser, null), `revoked_at`. Propriedade `is_usable`.
- `POST /api/v1/auth/invites/` (IsAdminOrAbove): `{role}` → `{id, url, expires_at}`. URL = `FRONTEND_URL/convite/<token>`.
  O token cru só aparece nessa resposta.
- `GET /api/v1/auth/invites/` (IsAdminOrAbove): convites pendentes (não usados, não revogados, não vencidos).
- `DELETE /api/v1/auth/invites/<id>/` (IsAdminOrAbove): revoga (marca `revoked_at`).
- `GET /api/v1/auth/invites/token/<token>/` (público, throttled): `{role_display, expires_at}` ou 404/410.
- `POST /api/v1/auth/invites/token/<token>/accept/` (público, throttled, multipart): `full_name, email, cpf, phone,
  password, cnh (arquivo opcional)`.
  - Valida: convite utilizável; e-mail ainda sem GlobalUser; CPF válido e sem Employee; senha pelos validadores do Django;
    CNH até 10 MB, PDF/JPEG/PNG.
  - Dentro de `transaction.atomic()` + `select_for_update` no convite: cria GlobalUser (senha escolhida, papel do convite),
    roda a criação de Employee + Person + CPF + contatos reaproveitando a lógica do `EmployeeCreateSerializer`
    (extraída para uma função de serviço, sem o "senha = CPF"), marca o convite usado.
  - Employee: `role` = papel do convite, `department="administrative"`, `position="administrative"` (ajustáveis depois no RH),
    matrícula `EMP-AAAAMM-NNN` como o `RegisterView` já gera, `hire_date` = hoje.
  - CNH: sobe para o S3 em `hr/employees/<id>/cnh/<uuid>.<ext>` e cria `EmployeeDocument(document_type="cnh")`.
    Se o upload falhar, a transação inteira volta e a pessoa vê "não foi possível enviar a CNH; tente de novo ou envie sem ela".
- Tudo que toca Employee/Person roda em `schema_context(invite.tenant_schema)`.

### Frontend (`apps/dscar-web`)

- Configurações → Usuários: botão "Convidar" abre diálogo com o papel → gera → mostra link com botão Copiar e
  "Enviar no WhatsApp" (`https://wa.me/?text=`). Lista de convites pendentes com Revogar.
- Página pública `/convite/[token]` (fora do login no middleware): mesmo visual da tela de login; formulário com
  máscara de CPF e telefone, Zod, estados de carregando/erro/convite inválido; sucesso → `/login`.

### Usuários já existentes

- Comando `ensure_employee_profiles` (idempotente) cria Employee para todo GlobalUser ativo sem perfil no tenant,
  com o mesmo papel do usuário. Roda uma vez na produção no deploy.

## O que fica com quem implementa

- Nomes de arquivos/funções, forma exata do serviço extraído, testes (pytest por app, conforme a suíte lenta).
- Conferir se as variáveis AWS existem no `.env` da Oracle antes de prometer o upload da CNH em produção.
