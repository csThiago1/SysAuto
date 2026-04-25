# SCS — Padrões de Arquitetura e Desenvolvimento

> Sistema de Corretora de Seguros — Django 4.2 + Python

Este documento define os padrões arquiteturais, convenções de código e boas práticas adotadas no projeto. Deve ser consultado antes de qualquer implementação.

---

## Sumário

1. [Estrutura de Apps](#1-estrutura-de-apps)
2. [Models](#2-models)
3. [Views](#3-views)
4. [URLs](#4-urls)
5. [Forms](#5-forms)
6. [Templates](#6-templates)
7. [Autenticação e Permissões](#7-autenticação-e-permissões)
8. [QuerySets e ORM](#8-querysets-e-orm)
9. [Signals](#9-signals)
10. [Agente IA](#10-agente-ia)
11. [Exports e Relatórios](#11-exports-e-relatórios)
12. [Static e Frontend](#12-static-e-frontend)
13. [Configuração e Ambiente](#13-configuração-e-ambiente)

---

## 1. Estrutura de Apps

Cada domínio de negócio é um app Django independente. A responsabilidade de cada app é única e bem delimitada.

```
scs/
├── accounts/       # Usuários, autenticação, RBAC
├── clients/        # Clientes PF/PJ
├── policies/       # Propostas, apólices, coberturas, documentos
├── claims/         # Sinistros e timeline de auditoria
├── endorsements/   # Endossos e alterações
├── renewals/       # Gestão de renovações
├── crm/            # Pipeline, negociações, atividades
├── insurers/       # Seguradoras e ramos
├── coverages/      # Tipos de seguro e coberturas
├── dashboard/      # KPIs e métricas
├── reports/        # Relatórios gerenciais
├── ai_agent/       # Chat IA, resumos, insights
├── utils/          # Mixins, validators, template tags (código compartilhado)
└── core/           # Settings, URLs raiz, WSGI/ASGI
```

### Arquivos obrigatórios por app

```
app_name/
├── models.py
├── views.py
├── urls.py
├── forms.py        # se o app tem formulários
├── admin.py
├── signals.py      # se o app usa signals
└── apps.py
```

---

## 2. Models

### 2.1 Abstract Base — TimeStampedModel

**Todo model de domínio herda de `TimeStampedModel`.**

```python
# utils/models.py
class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
```

### 2.2 Choices como TextChoices

Sempre use `models.TextChoices` para campos de status/tipo. Nunca use tuplas soltas.

```python
class PolicyStatus(models.TextChoices):
    ACTIVE = 'active', 'Ativa'
    EXPIRED = 'expired', 'Expirada'
    CANCELLED = 'cancelled', 'Cancelada'
    SUSPENDED = 'suspended', 'Suspensa'
    PENDING = 'pending', 'Pendente'
```

### 2.3 Custom Manager

Sempre que o model tiver lógica de criação específica, use um `Manager` customizado.

```python
class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)
```

### 2.4 Propriedades calculadas

Use `@property` para lógica derivada dos campos, nunca campos calculados no banco.

```python
class Policy(TimeStampedModel):
    end_date = models.DateField()

    @property
    def is_expired(self):
        return self.end_date < date.today()

    @property
    def is_expiring_soon(self):
        return date.today() <= self.end_date <= date.today() + timedelta(days=30)
```

### 2.5 Geração automática de slugs

Use o método `save()` do model para auto-gerar slugs. Não use signals para isso.

```python
class InsuranceType(TimeStampedModel):
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)
```

### 2.6 Numeração automática de registros

Use signals `pre_save` para gerar números únicos (endossos, sinistros, etc).

```python
@receiver(pre_save, sender=Endorsement)
def generate_endorsement_number(sender, instance, **kwargs):
    if not instance.endorsement_number:
        last = Endorsement.objects.order_by('-id').first()
        next_id = (last.id + 1) if last else 1
        instance.endorsement_number = f'END-{next_id:06d}'
```

### 2.7 Validators de domínio

Validators de CPF/CNPJ ficam em `utils/validators.py` e são referenciados nos fields.

```python
# utils/validators.py
def validate_cpf(value): ...
def validate_cnpj(value): ...
def validate_cpf_cnpj(value): ...  # dispatch automático

# clients/models.py
cpf_cnpj = models.CharField(validators=[validate_cpf_cnpj])
```

---

## 3. Views

### 3.1 CBV como padrão

Sempre use Class-Based Views. FBVs são aceitos apenas para:
- Endpoints JSON/AJAX simples
- Exports CSV/PDF sem lógica de template

```python
# Padrão: CBV com mixins
class ClientListView(LoginRequiredMixin, BrokerFilterMixin, ListView):
    model = Client
    template_name = 'clients/client_list.html'
    context_object_name = 'clients'
    paginate_by = 20

# Exceção: FBV para AJAX
def chat_create_session(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    session = ChatSession.objects.create(user=request.user, title='Nova conversa')
    return JsonResponse({'session_id': session.id, 'title': session.title})
```

### 3.2 Composição de mixins

A ordem importa: `LoginRequiredMixin` sempre primeiro, depois mixins de permissão, depois mixins de queryset.

```python
class PolicyDetailView(LoginRequiredMixin, BrokerFilterMixin, DetailView):
    ...
```

### 3.3 Hierarquia de mixins de acesso

```python
# utils/mixins.py

class AdminRequiredMixin(LoginRequiredMixin, UserPassesTestMixin):
    def test_func(self):
        return self.request.user.role == 'admin'

class ManagerRequiredMixin(LoginRequiredMixin, UserPassesTestMixin):
    def test_func(self):
        return self.request.user.role in ('admin', 'manager')

class BrokerFilterMixin:
    """Filtra automaticamente o queryset pelo broker quando o usuário tem role broker."""
    broker_field = 'broker'

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.role == 'broker':
            return qs.filter(**{self.broker_field: self.request.user})
        return qs
```

### 3.4 get_context_data

Use sempre `super()` e adicione contexto sem reescrever o dicionário.

```python
def get_context_data(self, **kwargs):
    ctx = super().get_context_data(**kwargs)
    ctx['ai_summary'] = EntitySummary.objects.filter(
        entity_type='client', entity_id=self.object.pk
    ).first()
    return ctx
```

### 3.5 success_url

Prefira `reverse_lazy` ao `reverse` em atributos de classe.

```python
class ClientCreateView(LoginRequiredMixin, CreateView):
    success_url = reverse_lazy('clients:client_list')
```

---

## 4. URLs

### 4.1 Namespacing obrigatório

Todo app define `app_name` no `urls.py`.

```python
# clients/urls.py
app_name = 'clients'

urlpatterns = [
    path('', ClientListView.as_view(), name='client_list'),
    path('create/', ClientCreateView.as_view(), name='client_create'),
    path('<int:pk>/', ClientDetailView.as_view(), name='client_detail'),
    path('<int:pk>/edit/', ClientUpdateView.as_view(), name='client_update'),
    path('<int:pk>/delete/', ClientDeleteView.as_view(), name='client_delete'),
    path('export/', ClientExportView.as_view(), name='client_export'),
]
```

### 4.2 Convenção de nomes

| Padrão | View |
|--------|------|
| `module/` | ListView |
| `module/create/` | CreateView |
| `module/<int:pk>/` | DetailView |
| `module/<int:pk>/edit/` | UpdateView |
| `module/<int:pk>/delete/` | DeleteView |
| `module/export/` | ExportView |
| `module/<int:pk>/acao/` | View de ação específica |

### 4.3 Include no core

```python
# core/urls.py
urlpatterns = [
    path('admin/', admin.site.urls),
    path('accounts/', include('accounts.urls')),
    path('clients/', include('clients.urls')),
    ...
]
```

---

## 5. Forms

### 5.1 ModelForm com widgets estilizados

```python
class ClientForm(forms.ModelForm):
    class Meta:
        model = Client
        fields = ['client_type', 'name', 'cpf_cnpj', 'email', 'phone', 'broker']
        widgets = {
            'name': forms.TextInput(attrs={'class': 'form-control'}),
            'client_type': forms.Select(attrs={'class': 'form-select'}),
            'broker': forms.Select(attrs={'class': 'form-select'}),
        }
```

### 5.2 Customização de queryset no `__init__`

Quando um campo FK precisa de queryset filtrado, faça no `__init__`.

```python
class PolicyForm(forms.ModelForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['broker'].queryset = User.objects.filter(is_active=True)
```

### 5.3 Formulários com senha

Sempre use `set_password()` no `save()` e valide confirmação manualmente.

```python
class UserCreateForm(forms.ModelForm):
    password1 = forms.CharField(widget=forms.PasswordInput(attrs={'class': 'form-control'}))
    password2 = forms.CharField(widget=forms.PasswordInput(attrs={'class': 'form-control'}))

    def clean_password2(self):
        p1 = self.cleaned_data.get('password1')
        p2 = self.cleaned_data.get('password2')
        if p1 and p2 and p1 != p2:
            raise forms.ValidationError('As senhas não coincidem.')
        return p2

    def save(self, commit=True):
        user = super().save(commit=False)
        user.set_password(self.cleaned_data['password1'])
        if commit:
            user.save()
        return user
```

---

## 6. Templates

### 6.1 Herança de `base.html`

Todo template herda de `base.html` e preenche os blocos:

```html
{% extends 'base.html' %}

{% block title %}Clientes{% endblock %}
{% block page_title %}Gestão de Clientes{% endblock %}

{% block page_actions %}
  <a href="{% url 'clients:client_create' %}" class="btn btn-primary">Novo cliente</a>
{% endblock %}

{% block content %}
  ...
{% endblock %}
```

### 6.2 Partials reutilizáveis

Componentes repetidos ficam em `templates/partials/`:

```
templates/partials/
├── _sidebar.html
├── _topbar.html
├── _messages.html
├── _confirm_delete.html
└── _pagination.html
```

Uso nos templates:
```html
{% include 'partials/_pagination.html' with page_obj=page_obj %}
```

### 6.3 Template tags customizadas

Tags de formatação ficam em `utils/templatetags/utils_tags.py` e são carregadas no `base.html`.

---

## 7. Autenticação e Permissões

### 7.1 Custom User Model

```python
# accounts/models.py
class User(AbstractBaseUser, PermissionsMixin, TimeStampedModel):
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=150)

    class Role(models.TextChoices):
        ADMIN = 'admin', 'Administrador'
        MANAGER = 'manager', 'Gerente'
        BROKER = 'broker', 'Corretor'

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.BROKER)
    USERNAME_FIELD = 'email'
    objects = UserManager()
```

### 7.2 EmailBackend — login por e-mail

```python
# accounts/backends.py
class EmailBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        email = username or kwargs.get('email')
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            User().set_password(password)  # timing attack mitigation
            return None
        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
```

### 7.3 Controle de acesso por role

| Role | Acesso |
|------|--------|
| `admin` | Total, incluindo gestão de usuários |
| `manager` | Operações + relatórios + gestão de pipeline |
| `broker` | Apenas seus próprios dados (filtrado automaticamente) |

Nos templates:
```html
{% if request.user.role == 'admin' %}...{% endif %}
{% if request.user.is_manager %}...{% endif %}
```

---

## 8. QuerySets e ORM

### 8.1 select_related obrigatório em FKs

Sempre que a view ou template acessa FK, use `select_related()`.

```python
def get_queryset(self):
    return super().get_queryset().select_related(
        'client', 'insurer', 'insurance_type', 'broker'
    )
```

### 8.2 prefetch_related para M2M e reverse FK

```python
ctx['coverages'] = self.object.coverages.select_related('coverage').all()
```

### 8.3 Q objects para busca

```python
from django.db.models import Q

if query:
    qs = qs.filter(
        Q(name__icontains=query) |
        Q(email__icontains=query) |
        Q(cpf_cnpj__icontains=query)
    )
```

### 8.4 Agregações

```python
from django.db.models import Sum, Count

total_premium = policies.aggregate(total=Sum('premium_amount'))['total'] or 0
count_active = policies.filter(status='active').count()
```

### 8.5 get_object_or_404

Sempre use `get_object_or_404` em FBVs e views de recursos aninhados.

```python
policy = get_object_or_404(Policy, pk=pk)
```

---

## 9. Signals

### 9.1 Quando usar signals

- Auditoria automática de mudança de status
- Criação automática de registro relacionado (ex: Renewal ao salvar Policy)
- Geração de números únicos de documentos

### 9.2 Registro no AppConfig

```python
# claims/apps.py
class ClaimsConfig(AppConfig):
    name = 'claims'

    def ready(self):
        import claims.signals  # noqa
```

### 9.3 Padrão de signal para auditoria

```python
# claims/signals.py
from django.db.models.signals import pre_save
from django.dispatch import receiver

@receiver(pre_save, sender=Claim)
def track_claim_status_change(sender, instance, **kwargs):
    if not instance.pk:
        return
    try:
        old = Claim.objects.get(pk=instance.pk)
    except Claim.DoesNotExist:
        return
    if old.status != instance.status:
        ClaimTimeline.objects.create(
            claim=instance,
            action=f'Status alterado de {old.status} para {instance.status}',
            performed_by=instance.broker,
            old_status=old.status,
            new_status=instance.status,
        )
```

### 9.4 Padrão de signal para criação automática

```python
# renewals/signals.py
@receiver(post_save, sender=Policy)
def create_renewal_on_policy_save(sender, instance, created, **kwargs):
    if created:
        Renewal.objects.create(
            policy=instance,
            status=RenewalStatus.PENDING,
            due_date=instance.end_date,
            broker=instance.broker,
        )
```

---

## 10. Agente IA

### 10.1 Arquitetura do agente

```
ai_agent/agent/
├── core.py         # Inicialização do LLM e loop agentico
├── tools.py        # Ferramentas de busca com closure por usuário
├── prompts.py      # System prompts e templates de resumo
└── permissions.py  # Filtragem de queryset respeitando roles
```

### 10.2 Tools com closure de usuário

Sempre crie tools via closure para garantir que o contexto do usuário esteja embutido.

```python
def build_tools_for_user(user):
    @tool
    def search_clients(query: str = '') -> str:
        """Busca clientes acessíveis ao usuário."""
        qs = get_filtered_queryset(user, Client)
        if query:
            qs = qs.filter(Q(name__icontains=query) | Q(email__icontains=query))
        ...
    return [search_clients, search_policies, ...]
```

### 10.3 Loop agentico com limite de iterações

```python
max_iterations = 8
for _ in range(max_iterations):
    response = llm_with_tools.invoke(messages)
    if not response.tool_calls:
        return response.content
    # processa tool calls...
return 'Limite de iterações atingido.'
```

### 10.4 Filtragem de permissão no agente

```python
# ai_agent/agent/permissions.py
def get_filtered_queryset(user, model_class):
    qs = model_class.objects.all()
    if user.role == 'broker':
        if model_class is Endorsement:
            return qs.filter(requested_by=user)
        return qs.filter(broker=user)
    return qs
```

### 10.5 System prompt — regras do agente

```python
SYSTEM_PROMPT = """Você é um assistente de IA especializado em gestão de corretoras de seguros.
- Responda SOMENTE com base nos dados retornados pelas suas ferramentas.
- NUNCA invente dados, valores, nomes ou números.
- Use formatação Markdown para melhor legibilidade.
"""
```

---

## 11. Exports e Relatórios

### 11.1 CSV Export — padrão FBV

```python
class ClientExportView(LoginRequiredMixin, View):
    def get(self, request):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="clientes.csv"'
        writer = csv.writer(response)
        writer.writerow(['Nome', 'Tipo', 'CPF/CNPJ', 'E-mail', 'Telefone', 'Corretor'])
        qs = Client.objects.select_related('broker').filter(...)
        for client in qs:
            writer.writerow([client.name, client.get_client_type_display(), ...])
        return response
```

### 11.2 Relatórios gerenciais

- Base: `BaseReportView(ManagerRequiredMixin, FormView)`
- Bloqueados para role `broker` via `ManagerRequiredMixin`
- Suporte a exportação PDF via `xhtml2pdf`

---

## 12. Static e Frontend

### 12.1 Bibliotecas utilizadas

| Lib | Uso |
|-----|-----|
| Bootstrap 5 | CSS framework principal |
| DuralUX Theme | Admin template premium |
| Chart.js 4 | Gráficos no dashboard |
| SortableJS | Kanban drag-and-drop |
| Feather Icons | Ícones SVG na navegação |

### 12.2 Estrutura

```
static/
├── css/
│   ├── bootstrap.min.css
│   ├── vendors.min.css
│   └── theme.min.css
└── js/
    ├── vendors.min.js
    ├── common-init.min.js
    └── theme-customizer-init.min.js
```

### 12.3 Sem build pipeline

O projeto usa distribuições já minificadas. Não há Webpack, Vite ou similar.

---

## 13. Configuração e Ambiente

### 13.1 Variáveis de ambiente obrigatórias

```env
SECRET_KEY=...
DEBUG=False
ALLOWED_HOSTS=meudominio.com
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
DATABASE_URL=postgres://...
```

### 13.2 Settings via `python-dotenv`

```python
# core/settings.py
from dotenv import load_dotenv
load_dotenv()

SECRET_KEY = os.environ.get('SECRET_KEY')
DEBUG = os.environ.get('DEBUG', 'False') == 'True'
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')
```

### 13.3 Database

- **Desenvolvimento:** SQLite3
- **Produção:** PostgreSQL (obrigatório para concorrência e integridade)

### 13.4 Management Commands

```bash
# Gerar insights de dashboard para todos os usuários
python manage.py generate_insights

# Popular banco com dados de demonstração
python manage.py seed_demo
python manage.py seed_demo --clear  # limpa antes de popular
```

---

## Checklist para nova feature

Ao adicionar uma nova funcionalidade, verifique:

- [ ] Model herda de `TimeStampedModel`
- [ ] Choices definidos como `TextChoices`
- [ ] Campos FK com `select_related` nas views
- [ ] View usa mixin de permissão adequado (`LoginRequired`, `ManagerRequired`, `BrokerFilter`)
- [ ] URL registrada no `urls.py` do app com `app_name` definido
- [ ] URL incluída no `core/urls.py`
- [ ] Form como `ModelForm` com widgets Bootstrap
- [ ] Template herda de `base.html`
- [ ] Admin registrado em `admin.py`
- [ ] Se usa signal: registrado no `AppConfig.ready()`
- [ ] Se é dado sensível por role: `BrokerFilterMixin` ou `get_filtered_queryset` no agente IA
