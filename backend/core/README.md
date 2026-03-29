# backend/core — API ERP DS Car

Django 5.2 + Django REST Framework + SimpleJWT + psycopg3.

## Rodar localmente

> Todos os comandos abaixo devem ser executados na raiz do monorepo (`grupo-dscar/`).

```bash
# 1. Subir banco de dados (Docker obrigatório)
make dev

# 2. Primeira execução — cria .venv, instala deps e roda migrations
make setup

# 3. Criar superusuário admin
make createsuperuser

# 4. Subir API
make runserver          # http://localhost:8000
```

## Variáveis de ambiente

Crie `backend/core/.env` (copiando de `.env.example`):

```env
DEBUG=True
SECRET_KEY=dev-secret-key-troque-em-prod
DATABASE_URL=postgres://paddock:paddock@localhost:5432/paddock_dev
REDIS_URL=redis://localhost:6379/0
PLATE_LOOKUP_URL=       # opcional — API de consulta de placa
PLATE_LOOKUP_KEY=       # opcional
```

## Endpoints

### Auth
```
POST /api/v1/auth/token/            # login → {access, refresh}
POST /api/v1/auth/token/refresh/    # renova access token
```

### Utilitário
```
GET /api/v1/health/                 # {"status": "ok"}
```

### Pessoas
```
GET    /api/v1/persons/             # lista (paginado, filtros: type, search)
POST   /api/v1/persons/             # cria pessoa
GET    /api/v1/persons/{id}/        # detalhe
PUT    /api/v1/persons/{id}/        # atualiza
```

### Ordens de Serviço
```
GET    /api/v1/service-orders/                    # lista (paginado)
POST   /api/v1/service-orders/                    # cria OS
GET    /api/v1/service-orders/{id}/               # detalhe
PATCH  /api/v1/service-orders/{id}/               # atualiza campos
POST   /api/v1/service-orders/{id}/change-status/ # muda status (valida VALID_TRANSITIONS)
```

### Veículos e FIPE
```
GET    /api/v1/vehicles/            # lista
POST   /api/v1/vehicles/            # cria
GET    /api/v1/vehicles/lookup/?plate=ABC1234   # consulta placa externa
GET    /api/v1/fipe/brands/         # marcas
GET    /api/v1/fipe/models/{brand}/ # modelos por marca
```

## Autenticação

Todas as rotas (exceto `/health/` e `/auth/token/`) exigem header:

```
Authorization: Bearer <access_token>
```

Access token expira em 5 minutos. Use o refresh token para renovar sem precisar re-autenticar.

## Estrutura

```
backend/core/
├── manage.py
├── requirements.txt
├── .env.example
├── config/
│   ├── settings.py          # Settings com variáveis de ambiente
│   └── urls.py              # URL raiz → /api/v1/
├── apps/
│   ├── persons/             # Person, Document, Category, Contact, Address
│   ├── vehicles/            # Vehicle, VehicleBrand, VehicleModel, VehicleVersion
│   └── service_orders/      # ServiceOrder, StatusHistory + VALID_TRANSITIONS
└── scripts/
    └── fipe_import.py       # Importação do catálogo FIPE (make fipe-import)
```

## Importar catálogo FIPE

```bash
make fipe-import                              # carros (~30 min)
# ou diretamente:
.venv/bin/python scripts/fipe_import.py --type all --dry-run   # simulação
.venv/bin/python scripts/fipe_import.py --type motorcycle       # só motos
```

O script é idempotente — pode ser re-executado sem criar duplicatas.
Salva progresso por marca em `scripts/fipe_cache.json` e retoma em caso de falha.

## Comandos úteis

```bash
make migrate                  # aplica migrations
make shell                    # Django shell
make lint                     # black + isort (check)
make format                   # aplica formatação
make typecheck                # mypy
make test-backend             # pytest
make test-cov                 # pytest + relatório HTML de cobertura
```

## Fluxo de status — OS

Transições inválidas são rejeitadas com HTTP 400.

```python
VALID_TRANSITIONS = {
    'reception':      ['initial_survey', 'cancelled'],
    'initial_survey': ['budget'],
    'budget':         ['waiting_parts', 'repair'],
    'waiting_parts':  ['repair'],
    'repair':         ['mechanic', 'bodywork', 'polishing'],
    'mechanic':       ['bodywork', 'polishing'],
    'bodywork':       ['painting'],
    'painting':       ['assembly'],
    'assembly':       ['polishing'],
    'polishing':      ['washing'],
    'washing':        ['final_survey'],
    'final_survey':   ['ready'],
    'ready':          ['delivered'],
    'delivered':      [],
    'cancelled':      [],
}
```
