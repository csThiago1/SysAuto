import { useState } from 'react';
import { Invoice, Person, ServiceOrder } from '../types';
import { formatCurrency, cn } from '../utils';
import { 
  FileText, 
  Plus, 
  Search, 
  Download, 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  Filter
} from 'lucide-react';

type InvoicingProps = {
  invoices: Invoice[];
  people: Person[];
  orders: ServiceOrder[];
  addInvoice?: (invoice: Omit<Invoice, 'id' | 'issueDate' | 'status'>) => void;
};

export function Invoicing({ invoices, people, orders, addInvoice }: InvoicingProps) {
  const [activeTab, setActiveTab] = useState<'Emitidas' | 'Recebidas'>('Emitidas');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);

  // Form State - Emitir
  const [emitType, setEmitType] = useState<'NF' | 'NFSe'>('NFSe');
  const [emitOrderId, setEmitOrderId] = useState('');
  const [emitReceiverId, setEmitReceiverId] = useState('');
  const [emitValue, setEmitValue] = useState('');

  // Form State - Receber
  const [receiveType, setReceiveType] = useState<'NF' | 'NFSe'>('NF');
  const [receiveIssuerName, setReceiveIssuerName] = useState('');
  const [receiveIssuerCnpj, setReceiveIssuerCnpj] = useState('');
  const [receiveValue, setReceiveValue] = useState('');
  const [receiveNumber, setReceiveNumber] = useState('');
  const [receiveSeries, setReceiveSeries] = useState('1');

  const handleEmit = () => {
    if (!addInvoice || !emitReceiverId || !emitValue) return;

    const receiver = people.find(p => p.id === emitReceiverId);
    if (!receiver) return;

    addInvoice({
      number: Math.floor(100000 + Math.random() * 900000).toString(),
      series: '1',
      type: emitType,
      direction: 'Emitida',
      issuerName: 'AutoTech Oficina',
      issuerCnpj: '12.345.678/0001-90',
      receiverName: receiver.name,
      receiverCnpj: '00.000.000/0000-00', // Mock
      value: Number(emitValue),
      orderId: emitOrderId || undefined,
    });

    setIsModalOpen(false);
    setEmitOrderId('');
    setEmitReceiverId('');
    setEmitValue('');
  };

  const handleReceive = () => {
    if (!addInvoice || !receiveIssuerName || !receiveValue || !receiveNumber) return;

    addInvoice({
      number: receiveNumber,
      series: receiveSeries,
      type: receiveType,
      direction: 'Recebida',
      issuerName: receiveIssuerName,
      issuerCnpj: receiveIssuerCnpj || '00.000.000/0000-00',
      receiverName: 'AutoTech Oficina',
      receiverCnpj: '12.345.678/0001-90',
      value: Number(receiveValue),
    });

    setIsReceiveModalOpen(false);
    setReceiveIssuerName('');
    setReceiveIssuerCnpj('');
    setReceiveValue('');
    setReceiveNumber('');
    setReceiveSeries('1');
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesTab = inv.direction === (activeTab === 'Emitidas' ? 'Emitida' : 'Recebida');
    const matchesSearch = 
      inv.number.includes(searchTerm) || 
      inv.issuerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.receiverName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const getStatusIcon = (status: Invoice['status']) => {
    switch (status) {
      case 'Autorizada': return <CheckCircle2 size={16} className="text-emerald-500" />;
      case 'Pendente': return <Clock size={16} className="text-amber-500" />;
      case 'Cancelada': return <XCircle size={16} className="text-slate-400" />;
      case 'Erro': return <AlertCircle size={16} className="text-red-500" />;
    }
  };

  const getStatusColor = (status: Invoice['status']) => {
    switch (status) {
      case 'Autorizada': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'Pendente': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'Cancelada': return 'bg-slate-50 text-slate-600 border-slate-200';
      case 'Erro': return 'bg-red-50 text-red-700 border-red-100';
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-primary tracking-tight">Faturamento & Notas Fiscais</h1>
          <p className="text-slate-500 text-sm mt-1">Gestão de NF-e, NFS-e e recepção de documentos.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus size={18} />
          Emitir Nova Nota
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex bg-page-bg p-1 rounded-xl w-fit border border-surface">
          <button
            onClick={() => setActiveTab('Emitidas')}
            className={cn(
              "px-6 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
              activeTab === 'Emitidas' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <ArrowUpRight size={16} />
            Emitidas (Vendas/Serviços)
          </button>
          <button
            onClick={() => setActiveTab('Recebidas')}
            className={cn(
              "px-6 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
              activeTab === 'Recebidas' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <ArrowDownLeft size={16} />
            Recebidas (Compras/Despesas)
          </button>
        </div>

        {activeTab === 'Recebidas' && (
          <div className="flex gap-2">
            <button 
              onClick={() => setIsReceiveModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-surface text-slate-700 rounded-xl text-sm font-medium hover:bg-page-bg transition-colors shadow-sm"
            >
              <Plus size={16} />
              Registrar Nota
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-xl text-sm font-medium hover:bg-secondary/90 transition-colors shadow-sm">
              <Clock size={16} />
              Sincronizar SEFAZ
            </button>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-surface rounded-2xl p-4 flex items-center gap-6 shadow-sm mb-6 flex-wrap">
        <div className="flex items-center gap-2 text-slate-700 font-medium">
          <Filter size={18} className="text-primary" />
          Filtros:
        </div>
        
        <div className="flex items-center gap-4 flex-1 flex-wrap">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por número, emitente ou destinatário..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-page-bg border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-surface shadow-sm flex-1 flex flex-col overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-page-bg text-slate-500 font-medium border-b border-surface">
              <tr>
                <th className="px-6 py-4">Número / Série</th>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4">{activeTab === 'Emitidas' ? 'Destinatário' : 'Emitente'}</th>
                <th className="px-6 py-4">Data Emissão</th>
                <th className="px-6 py-4 text-right">Valor</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center sticky right-0 bg-page-bg shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface">
              {filteredInvoices.map(inv => (
                <tr key={inv.id} className="hover:bg-page-bg/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{inv.number}</div>
                    <div className="text-xs text-slate-500">Série {inv.series}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                      inv.type === 'NF' ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary"
                    )}>
                      {inv.type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">
                      {activeTab === 'Emitidas' ? inv.receiverName : inv.issuerName}
                    </div>
                    <div className="text-xs text-slate-500 font-mono">
                      {activeTab === 'Emitidas' ? inv.receiverCnpj : inv.issuerCnpj}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {new Date(inv.issueDate).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-slate-900">
                    {formatCurrency(inv.value)}
                  </td>
                  <td className="px-6 py-4">
                    <div className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
                      getStatusColor(inv.status)
                    )}>
                      {getStatusIcon(inv.status)}
                      {inv.status}
                    </div>
                  </td>
                  <td className="px-6 py-4 sticky right-0 bg-white group-hover:bg-page-bg/50 shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)] transition-colors">
                    <div className="flex items-center justify-center gap-2">
                      <button className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Ver DANFE/PDF">
                        <FileText size={16} />
                      </button>
                      <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="Download XML">
                        <Download size={16} />
                      </button>
                      <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="Ver no Portal">
                        <ExternalLink size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    Nenhuma nota fiscal encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Emissão Manual */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-surface flex justify-between items-center">
              <h2 className="text-xl font-bold text-primary">Emissão de Nota Fiscal</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                &times;
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Tipo de Nota</label>
                  <select 
                    value={emitType}
                    onChange={(e) => setEmitType(e.target.value as 'NF' | 'NFSe')}
                    className="w-full px-3 py-2 bg-page-bg border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="NFSe">NFS-e (Serviços)</option>
                    <option value="NF">NF-e (Produtos)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Vincular a O.S (Opcional)</label>
                  <select 
                    value={emitOrderId}
                    onChange={(e) => {
                      const orderId = e.target.value;
                      setEmitOrderId(orderId);
                      const order = orders.find(o => o.id === orderId);
                      if (order) {
                        setEmitValue(order.totalValue.toString());
                        setEmitReceiverId(order.clientId);
                      }
                    }}
                    className="w-full px-3 py-2 bg-page-bg border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="">Nenhuma</option>
                    {orders.filter(o => o.financialStatus === 'A Faturar').map(o => (
                      <option key={o.id} value={o.id}>{o.id} - {o.vehicle} ({formatCurrency(o.totalValue)})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Destinatário</label>
                  <select 
                    value={emitReceiverId}
                    onChange={(e) => setEmitReceiverId(e.target.value)}
                    className="w-full px-3 py-2 bg-page-bg border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="">Selecione um cliente ou seguradora</option>
                    {people.filter(p => p.type === 'Cliente' || p.type === 'Seguradora').map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Valor Total (R$)</label>
                  <input 
                    type="number" 
                    value={emitValue}
                    onChange={(e) => setEmitValue(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-page-bg border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl">
                <div className="flex gap-3">
                  <AlertCircle className="text-primary shrink-0" size={20} />
                  <div>
                    <h4 className="text-sm font-semibold text-primary">Integração ERP</h4>
                    <p className="text-xs text-primary/80 mt-1">
                      Ao clicar em "Transmitir", os dados serão enviados para a SEFAZ/Prefeitura. 
                      Certifique-se de que o certificado digital A1 está configurado.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-surface bg-page-bg flex justify-end gap-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-slate-600 font-medium hover:bg-surface rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleEmit}
                disabled={!emitReceiverId || !emitValue}
                className="px-4 py-2 bg-primary text-white font-medium hover:bg-primary/90 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Transmitir Nota
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Registrar Nota Recebida */}
      {isReceiveModalOpen && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-surface flex justify-between items-center">
              <h2 className="text-xl font-bold text-primary">Registrar Nota Recebida</h2>
              <button onClick={() => setIsReceiveModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                &times;
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Tipo de Nota</label>
                  <select 
                    value={receiveType}
                    onChange={(e) => setReceiveType(e.target.value as 'NF' | 'NFSe')}
                    className="w-full px-3 py-2 bg-page-bg border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="NF">NF-e (Produtos)</option>
                    <option value="NFSe">NFS-e (Serviços)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Número</label>
                  <input 
                    type="text" 
                    value={receiveNumber}
                    onChange={(e) => setReceiveNumber(e.target.value)}
                    placeholder="Ex: 12345"
                    className="w-full px-3 py-2 bg-page-bg border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Série</label>
                  <input 
                    type="text" 
                    value={receiveSeries}
                    onChange={(e) => setReceiveSeries(e.target.value)}
                    placeholder="Ex: 1"
                    className="w-full px-3 py-2 bg-page-bg border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Nome do Emitente (Fornecedor)</label>
                  <input 
                    type="text" 
                    value={receiveIssuerName}
                    onChange={(e) => setReceiveIssuerName(e.target.value)}
                    placeholder="Razão Social"
                    className="w-full px-3 py-2 bg-page-bg border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">CNPJ do Emitente</label>
                  <input 
                    type="text" 
                    value={receiveIssuerCnpj}
                    onChange={(e) => setReceiveIssuerCnpj(e.target.value)}
                    placeholder="00.000.000/0000-00"
                    className="w-full px-3 py-2 bg-page-bg border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Valor Total (R$)</label>
                <input 
                  type="number" 
                  value={receiveValue}
                  onChange={(e) => setReceiveValue(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-page-bg border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>
            <div className="p-6 border-t border-surface bg-page-bg flex justify-end gap-3">
              <button 
                onClick={() => setIsReceiveModalOpen(false)}
                className="px-4 py-2 text-slate-600 font-medium hover:bg-surface rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleReceive}
                disabled={!receiveIssuerName || !receiveValue || !receiveNumber}
                className="px-4 py-2 bg-primary text-white font-medium hover:bg-primary/90 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Registrar Nota
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
