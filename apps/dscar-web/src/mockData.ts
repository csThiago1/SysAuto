import { Person, Part, ServiceOrder, OSStatus, FinancialStatus, OSType, InsuranceClaimType, PaymentMethod, Invoice, StatusHistory } from './types';

export const mockPeople: Person[] = [
  { id: 'p1', name: 'João Silva', type: 'Cliente', phone: '(11) 99999-1111', email: 'joao@email.com' },
  { id: 'p2', name: 'Maria Souza', type: 'Cliente', phone: '(11) 98888-2222', email: 'maria@email.com' },
  { id: 'p3', name: 'Carlos Mecânico', type: 'Colaborador', role: 'Mecânico', phone: '(11) 97777-3333', email: 'carlos@oficina.com' },
  { id: 'p4', name: 'Porto Seguro', type: 'Seguradora', phone: '(11) 3333-4444', email: 'contato@porto.com' },
  { id: 'p5', name: 'Roberto Corretor', type: 'Corretor', phone: '(11) 96666-5555', email: 'roberto@corretora.com' },
  { id: 'p6', name: 'Allianz Seguros', type: 'Seguradora', phone: '(11) 4444-5555', email: 'contato@allianz.com' },
  { id: 'p7', name: 'Pedro Santos', type: 'Cliente', phone: '(11) 95555-6666', email: 'pedro@email.com' },
  { id: 'p8', name: 'Ana Oliveira', type: 'Cliente', phone: '(11) 94444-7777', email: 'ana@email.com' },
  { id: 'p9', name: 'Tokio Marine', type: 'Seguradora', phone: '(11) 5555-6666', email: 'contato@tokio.com' },
  { id: 'p10', name: 'Lucas Costa', type: 'Cliente', phone: '(11) 93333-8888', email: 'lucas@email.com' },
  { id: 'p11', name: 'Ricardo Pintor', type: 'Colaborador', role: 'Pintor', phone: '(11) 92222-1111', email: 'ricardo@oficina.com' },
  { id: 'p12', name: 'Marcos Funileiro', type: 'Colaborador', role: 'Funileiro', phone: '(11) 91111-2222', email: 'marcos@oficina.com' },
  { id: 'p13', name: 'Sérgio Polidor', type: 'Colaborador', role: 'Polidor', phone: '(11) 90000-3333', email: 'sergio@oficina.com' },
  { id: 'p14', name: 'André Montador', type: 'Colaborador', role: 'Montador', phone: '(11) 98888-4444', email: 'andre@oficina.com' },
  { id: 'p15', name: 'Felipe Lavador', type: 'Colaborador', role: 'Lavador', phone: '(11) 97777-5555', email: 'felipe@oficina.com' },
  { id: 'p16', name: 'Juliana Consultora', type: 'Colaborador', role: 'Consultor', phone: '(11) 96666-6666', email: 'juliana@oficina.com' },
  { id: 'p17', name: 'Admin Master', type: 'Colaborador', role: 'Administrador', phone: '(11) 99999-9999', email: 'admin@oficina.com' },
];

export const mockParts: Part[] = [
  { id: 'pt1', name: 'Pastilha de Freio', sku: 'PF-001', quantity: 15, price: 120.0, cost: 60.0, supplier: 'Auto Peças Silva' },
  { id: 'pt2', name: 'Óleo de Motor 5W30', sku: 'OM-002', quantity: 50, price: 45.0, cost: 20.0, supplier: 'Distribuidora Lubrificantes' },
  { id: 'pt3', name: 'Filtro de Ar', sku: 'FA-003', quantity: 20, price: 35.0, cost: 15.0, supplier: 'Auto Peças Silva' },
  { id: 'pt4', name: 'Amortecedor Dianteiro', sku: 'AD-004', quantity: 8, price: 350.0, cost: 180.0, supplier: 'Suspensão & Cia' },
  { id: 'pt5', name: 'Vela de Ignição', sku: 'VI-005', quantity: 40, price: 25.0, cost: 10.0, supplier: 'Eletro Peças' },
  { id: 'pt6', name: 'Para-choque Dianteiro', sku: 'PC-006', quantity: 5, price: 800.0, cost: 400.0, supplier: 'Latarias Brasil' },
  { id: 'pt7', name: 'Farol Esquerdo', sku: 'FE-007', quantity: 10, price: 450.0, cost: 220.0, supplier: 'Iluminação Automotiva' },
  { id: 'pt8', name: 'Radiador', sku: 'RD-008', quantity: 3, price: 600.0, cost: 300.0, supplier: 'Refrigeração Auto' },
  { id: 'pt9', name: 'Capô', sku: 'CP-009', quantity: 2, price: 1200.0, cost: 650.0, supplier: 'Latarias Brasil' },
  { id: 'pt10', name: 'Retrovisor Direito', sku: 'RT-010', quantity: 6, price: 250.0, cost: 120.0, supplier: 'Acessórios Car' },
];

const today = new Date();
const getPastDate = (days: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() - days);
  return d.toISOString();
};

const vehicles = [
  'Honda Civic 2020', 'Toyota Corolla 2018', 'VW Gol 2015', 'Jeep Compass 2022', 'Fiat Argo 2021',
  'Chevrolet Onix 2019', 'Hyundai HB20 2020', 'Renault Kwid 2021', 'Ford Ka 2018', 'Nissan Kicks 2022'
];

const plates = [
  'ABC-1234', 'XYZ-9876', 'DEF-5678', 'GHI-9012', 'JKL-3456',
  'MNO-7890', 'PQR-1234', 'STU-5678', 'VWX-9012', 'YZA-3456'
];

const statuses: OSStatus[] = ['Em vistoria', 'Aguardando Liberação', 'Aguardando Peças', 'Em serviço', 'Veículo Pronto', 'Veículo Entregue'];
const financialStatuses: FinancialStatus[] = ['A Faturar', 'Faturado', 'Em aberto', 'Parcialmente Pago', 'Pago'];
const osTypes: OSType[] = ['Particular', 'Seguradora'];
const claimTypes: InsuranceClaimType[] = ['Segurado', 'Terceiro'];
const paymentMethods: PaymentMethod[] = ['Débito em conta', 'Pix', 'Boleto', 'Cartão 1x', 'Cartão 2x', 'Cartão 3x', 'Cartão 4x', 'Cartão 5x', 'Cartão 6x', 'Cartão 10x', 'Cartão 12x'];

const clients = mockPeople.filter(p => p.type === 'Cliente');
const insurances = mockPeople.filter(p => p.type === 'Seguradora');
const employees = mockPeople.filter(p => p.type === 'Colaborador');

const generateMockOrders = (count: number): ServiceOrder[] => {
  const orders: ServiceOrder[] = [];
  
  for (let i = 0; i < count; i++) {
    const isSeguradora = Math.random() > 0.4; // 60% chance of being Seguradora
    const osType: OSType = isSeguradora ? 'Seguradora' : 'Particular';
    
    const client = clients[Math.floor(Math.random() * clients.length)];
    const vehicle = vehicles[Math.floor(Math.random() * vehicles.length)];
    const plate = plates[Math.floor(Math.random() * plates.length)];
    const employee = employees[Math.floor(Math.random() * employees.length)];
    
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    
    // Logic for financial status based on OS status
    let financialStatus: FinancialStatus = 'A Faturar';
    if (status === 'Veículo Entregue') {
      const rand = Math.random();
      if (rand > 0.6) financialStatus = 'Pago';
      else if (rand > 0.4) financialStatus = 'Parcialmente Pago';
      else if (rand > 0.2) financialStatus = 'Em aberto';
      else financialStatus = 'Faturado';
    } else if (status === 'Veículo Pronto') {
      financialStatus = Math.random() > 0.5 ? 'Em aberto' : 'A Faturar';
    }

    const pastDays = Math.floor(Math.random() * 60); // Up to 60 days ago
    const createdAt = getPastDate(pastDays);
    const updatedAt = getPastDate(Math.floor(Math.random() * pastDays));
    
    let insuranceCompanyId;
    let insuranceClaimType;
    let deductibleAmount = 0;
    let deductiblePaid = false;

    if (osType === 'Seguradora') {
      insuranceCompanyId = insurances[Math.floor(Math.random() * insurances.length)].id;
      insuranceClaimType = claimTypes[Math.floor(Math.random() * claimTypes.length)];
      
      if (insuranceClaimType === 'Segurado') {
        deductibleAmount = Math.floor(Math.random() * 1500) + 500; // Franquia between 500 and 2000
        if (financialStatus === 'Pago' || financialStatus === 'Parcialmente Pago' || financialStatus === 'Faturado' || financialStatus === 'Em aberto') {
          deductiblePaid = Math.random() > 0.2; // 80% chance of having paid the deductible if billed
        }
      }
    }

    // Generate random services and parts
    const services = [
      { name: 'Funilaria e Pintura', price: Math.floor(Math.random() * 2000) + 500 },
      { name: 'Mão de obra mecânica', price: Math.floor(Math.random() * 1000) + 200 }
    ].slice(0, Math.floor(Math.random() * 2) + 1);

    const partsList = [];
    const numParts = Math.floor(Math.random() * 3);
    for (let j = 0; j < numParts; j++) {
      const part = mockParts[Math.floor(Math.random() * mockParts.length)];
      partsList.push({ partId: part.id, quantity: Math.floor(Math.random() * 2) + 1, price: part.price });
    }

    const totalValue = services.reduce((acc, s) => acc + s.price, 0) + partsList.reduce((acc, p) => acc + (p.price * p.quantity), 0);
    
    const statusHistory: StatusHistory[] = [
      { status: 'Em vistoria' as OSStatus, changedBy: 'Juliana Consultora', changedAt: createdAt },
    ];
    
    if (status !== 'Em vistoria') {
      statusHistory.push({ 
        status: status, 
        changedBy: employee.name, 
        changedAt: updatedAt,
        notes: 'Atualização de status via sistema'
      });
    }

    let amountPaid = 0;
    let invoiceNumber;
    let billedAt;
    let paymentMethod;

    if (financialStatus === 'Pago') {
      amountPaid = totalValue;
      invoiceNumber = `NF-2023-${1000 + i}`;
      billedAt = getPastDate(Math.floor(Math.random() * pastDays));
      paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
    } else if (financialStatus === 'Parcialmente Pago') {
      amountPaid = Math.floor(totalValue * (Math.random() * 0.5 + 0.2)); // 20% to 70% paid
      invoiceNumber = `NF-2023-${1000 + i}`;
      billedAt = getPastDate(Math.floor(Math.random() * pastDays));
      paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
    } else if (financialStatus === 'Faturado' || financialStatus === 'Em aberto') {
      amountPaid = 0;
      invoiceNumber = `NF-2023-${1000 + i}`;
      billedAt = getPastDate(Math.floor(Math.random() * pastDays));
      paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
    }

    const priorities: ('Baixa' | 'Média' | 'Alta' | 'Urgente')[] = ['Baixa', 'Média', 'Alta', 'Urgente'];
    const priority = priorities[Math.floor(Math.random() * priorities.length)];

    orders.push({
      id: `OS-${1000 + i}`,
      clientId: client.id,
      assignedEmployeeId: employee.id,
      osType,
      priority,
      insuranceCompanyId,
      insuranceClaimType,
      deductibleAmount,
      deductiblePaid,
      vehicle,
      plate,
      status,
      statusHistory,
      financialStatus,
      invoiceNumber,
      billedAt,
      amountPaid,
      paymentMethod,
      services,
      parts: partsList,
      totalValue,
      createdAt,
      updatedAt,
    });
  }
  
  return orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const mockOrders: ServiceOrder[] = generateMockOrders(50);

export const mockInvoices: Invoice[] = [
  {
    id: 'inv-1',
    number: '1234',
    series: '1',
    type: 'NFSe',
    direction: 'Emitida',
    status: 'Autorizada',
    issuerName: 'Oficina Master Car',
    issuerCnpj: '12.345.678/0001-90',
    receiverName: 'João Silva',
    receiverCnpj: '111.222.333-44',
    value: 1500.00,
    issueDate: getPastDate(5),
    danfeUrl: '#',
    orderId: 'OS-1000'
  },
  {
    id: 'inv-2',
    number: '5678',
    series: '1',
    type: 'NF',
    direction: 'Recebida',
    status: 'Autorizada',
    issuerName: 'Distribuidora de Peças XYZ',
    issuerCnpj: '98.765.432/0001-10',
    receiverName: 'Oficina Master Car',
    receiverCnpj: '12.345.678/0001-90',
    value: 850.50,
    issueDate: getPastDate(2),
    xmlUrl: '#'
  },
  {
    id: 'inv-3',
    number: '1235',
    series: '1',
    type: 'NFSe',
    direction: 'Emitida',
    status: 'Pendente',
    issuerName: 'Oficina Master Car',
    issuerCnpj: '12.345.678/0001-90',
    receiverName: 'Maria Souza',
    receiverCnpj: '222.333.444-55',
    value: 2200.00,
    issueDate: getPastDate(1),
    orderId: 'OS-1001'
  }
];
