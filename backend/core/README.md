# Backend Core - ERP DS Car

Base inicial do backend Django/DRF para o MVP do ERP DS Car.

## Objetivo deste pacote

- Estruturar a API do monorepo em `backend/core`.
- Iniciar módulos de Fase 1: `persons` e `service_orders`.
- Preparar o terreno para multitenancy (`django-tenants`) e integrações futuras.

## Estrutura inicial

- `manage.py`
- `config/`: settings e urls da API.
- `apps/persons/`: cadastro base de pessoas.
- `apps/service_orders/`: ordens de serviço e transições de status.

## Como rodar localmente (MVP)

1. Criar ambiente virtual Python:
   - `python3 -m venv .venv`
   - `source .venv/bin/activate`
2. Instalar dependências:
   - `pip install -r requirements.txt`
3. Rodar migrações:
   - `python manage.py migrate`
4. Subir API:
   - `python manage.py runserver 0.0.0.0:8000`

## Endpoints iniciais

- `GET /api/v1/health/`
- `GET /api/v1/persons/`
- `POST /api/v1/persons/`
- `GET /api/v1/service-orders/`
- `POST /api/v1/service-orders/`
- `POST /api/v1/service-orders/{id}/change-status/`

## Observações importantes

- Esta base é o primeiro passo do MVP backend.
- Regras de LGPD, fiscal e multitenancy ainda serão aprofundadas nas próximas iterações.
- O fluxo de status de OS segue as transições obrigatórias definidas no projeto.
