# Montar OC + Montador de Cotação WhatsApp — Design Spec

**Goal:** Conectar o botão "Montar OC" ao fluxo real de criação de OrdemCompra, e criar um montador de mensagem de cotação para copiar/colar no WhatsApp.

**Escopo:** 100% frontend (models já existem). 3 componentes novos + wiring na página de compras.

---

## 1. Montador de Cotação WhatsApp (`QuotationBuilder`)

### Trigger
Botão "Cotação WhatsApp" no card do pedido com status `em_cotacao` na página `/compras`.

### Modal
- **Presets rápidos:** 2 botões — "Concessionária" e "Loja independente" — que ativam/desativam checkboxes automaticamente.
- **Checkboxes de campos do veículo (selecionáveis):**

| Campo | Concessionária | Loja independente |
|-------|---------------|-------------------|
| Placa | ON | OFF |
| Chassi | ON | OFF |
| Marca/Modelo | ON | ON |
| Ano | ON | ON |
| Versão | ON | ON |
| Motor | ON | ON |
| Câmbio | ON | OFF |
| Combustível | ON | OFF |

- **Motor e Câmbio:** Pré-preenchidos por regex do `vehicle_version`/`model` da OS. Campos de texto editáveis pelo comprador.
  - Motor: regex extrai "1.0", "1.4", "2.0 T" etc. Concatena com `fuel_type` → "1.0 Flex"
  - Câmbio: regex busca "AT", "MT", "CVT", "AUT" no `vehicle_version`. Se não encontrar → vazio, comprador preenche.

- **Campos fixos (sempre incluídos, não desligáveis):**
  - Descrição da peça
  - Código de referência (se preenchido)
  - Quantidade

- **Campo opcional:**
  - Observações do pedido (checkbox, ON por padrão)

### Preview ao vivo
Atualiza em tempo real conforme checkboxes mudam:

```
Olá, preciso de cotação:

🚗 Chevrolet Onix LT1 2021
Motor: 1.0 Flex
Placa: QZA4C43
Chassi: 9BG5802...

📋 Para-choque dianteiro
Ref: 94703971
Qtd: 1

Obs: Lado direito, sem sensor

Aguardo retorno. Obrigado!
```

### Ações
- **Copiar** — copia texto para clipboard + toast "Copiado!"
- **Abrir WhatsApp** (opcional) — `https://wa.me/?text=<encoded>` abre WhatsApp Web/App com texto preenchido

### Dados necessários
O modal recebe o `PedidoCompra` (já tem descricao, codigo_referencia, tipo_qualidade, quantidade, observacoes) + dados do veículo da OS (plate, chassis, make, model, vehicle_version, year, fuel_type).

O endpoint `GET /api/v1/purchasing/pedidos/{id}/` já retorna `service_order` (UUID). Precisamos buscar os dados do veículo da OS. Duas opções:
- **Opção A:** Novo campo no serializer do PedidoCompra que inclui dados do veículo inline (evita request extra).
- **Opção B:** Frontend faz GET na OS separadamente.

**Decisão:** Opção A — adicionar campos do veículo no `PedidoCompraSerializer` via `SerializerMethodField`. Campos: `os_plate`, `os_chassis`, `os_make`, `os_model`, `os_vehicle_version`, `os_year`, `os_fuel_type`. Campos read-only, derivados de `service_order`.

---

## 2. Montar OC (`MontarOCModal`)

### Trigger
Botão "Montar OC" no card do pedido com status `em_cotacao` na página `/compras`.

### Lógica
1. Verifica se já existe OrdemCompra ativa para a mesma OS (`GET /api/v1/purchasing/ordens-compra/?service_order={os_id}&status=rascunho`)
2. Se existe → adiciona item na OC existente
3. Se não existe → cria OC nova (rascunho) + adiciona item

### Formulário (modal)
- **Fornecedor nome** (obrigatório, texto)
- **Fornecedor CNPJ** (opcional, texto com máscara)
- **Fornecedor contato** (opcional, texto — telefone/WhatsApp)
- **Preço unitário** (obrigatório, currency input)
- **Prazo de entrega** (texto livre, ex: "3 dias úteis")
- **Observações** (textarea, opcional)

### Após salvar
- `PedidoCompra.status` → `oc_pendente` (backend faz isso automaticamente via service)
- Toast: "Item adicionado à OC {numero}"
- Redirecionar para `/compras/ordens/{oc_id}` para revisar

### OC editável
A página `/compras/ordens/[id]` já existe. O comprador pode:
- Editar itens (preço, fornecedor, prazo)
- Adicionar mais itens
- Remover itens
- Enviar para aprovação (POST `/ordens-compra/{id}/enviar/`)

---

## 3. Página de Compras — Botões

### Status `solicitado`
- Botão: "Iniciar Cotação" → muda para `em_cotacao` ✅ (já funciona)

### Status `em_cotacao`
- Botão: "Cotação WhatsApp" → abre `QuotationBuilder`
- Botão: "Montar OC" → abre `MontarOCModal`

### Status `oc_pendente`
- Link: "Ver OC" → navega para `/compras/ordens/{oc_id}`

---

## 4. Backend — Mudanças mínimas

### PedidoCompraSerializer — adicionar campos veículo
```python
os_number = serializers.IntegerField(source="service_order.number", read_only=True)
os_plate = serializers.CharField(source="service_order.plate", read_only=True)
os_chassis = serializers.CharField(source="service_order.chassis", read_only=True)
os_make = serializers.CharField(source="service_order.make", read_only=True)
os_model = serializers.CharField(source="service_order.model", read_only=True)
os_vehicle_version = serializers.CharField(source="service_order.vehicle_version", read_only=True)
os_year = serializers.CharField(source="service_order.year", read_only=True)
os_fuel_type = serializers.CharField(source="service_order.fuel_type", read_only=True)
```

### PedidoCompraViewSet — select_related
Já faz `select_related("service_order")`, então os campos acima não geram queries extras.

### OrdemCompra — endpoint para buscar OC por OS
Já suportado: `GET /ordens-compra/?service_order={uuid}` (filtro já existe no `get_queryset`).

---

## 5. Arquivos

| Arquivo | Ação |
|---------|------|
| `backend/core/apps/purchasing/serializers.py` | Adicionar campos `os_*` no PedidoCompraSerializer |
| `apps/dscar-web/src/components/purchasing/QuotationBuilder.tsx` | CRIAR — modal montador cotação |
| `apps/dscar-web/src/components/purchasing/MontarOCModal.tsx` | CRIAR — modal criar OC + item |
| `apps/dscar-web/src/app/(app)/compras/page.tsx` | Conectar botões aos modais |
| `apps/dscar-web/src/hooks/usePurchasing.ts` | Adicionar `useCreateOrdemCompra`, `useAddItemOC` |
| `packages/types/src/purchasing.types.ts` | Adicionar campos `os_*` no tipo PedidoCompra |

---

*Spec escrita em 2026-05-13.*
