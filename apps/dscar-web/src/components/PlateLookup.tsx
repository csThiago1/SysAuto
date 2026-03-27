import { useState } from 'react';
import { Search, Car, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { PlateLookupResult } from '../types';
import { lookupPlate } from '../api/vehicles';
import { cn } from '../utils';

type Props = {
  onFound: (result: PlateLookupResult) => void;
  className?: string;
};

export function PlateLookup({ onFound, className }: Props) {
  const [plate, setPlate] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PlateLookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const formatPlate = (value: string) => {
    // Suporte Mercosul (ABC1D23) e antigo (ABC-1234)
    const clean = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 7);
    if (clean.length > 3) return `${clean.slice(0, 3)}-${clean.slice(3)}`;
    return clean;
  };

  const handleSearch = async () => {
    const clean = plate.replace('-', '').trim();
    if (clean.length < 7) {
      setError('Informe a placa completa (ex: ABC-1234 ou ABC1D23).');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await lookupPlate(clean);
      if (!data) {
        setError('Veículo não encontrado para essa placa.');
      } else {
        setResult(data);
        onFound(data);
      }
    } catch (err: any) {
      setError(err.message ?? 'Erro ao consultar a placa.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
        Consultar Placa
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={plate}
          onChange={(e) => {
            setPlate(formatPlate(e.target.value));
            setError(null);
            setResult(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="ABC-1234 ou ABC1D23"
          maxLength={8}
          className="flex-1 px-4 py-2.5 bg-page-bg border border-surface rounded-xl text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
        />
        <button
          onClick={handleSearch}
          disabled={loading || plate.length < 7}
          className="px-4 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          Buscar
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {result && (
        <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <Car size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Veículo identificado</span>
            </div>
            <p className="text-sm font-semibold text-slate-900 truncate">{result.full_name}</p>
            <div className="flex gap-3 mt-1">
              {result.year_model && (
                <span className="text-xs text-slate-500">Ano: {result.year_model}</span>
              )}
              {result.fuel && (
                <span className="text-xs text-slate-500">Combustível: {result.fuel}</span>
              )}
              {result.color && (
                <span className="text-xs text-slate-500">Cor: {result.color}</span>
              )}
            </div>
            <span className="text-[10px] text-slate-400 font-mono">{result.fipe_code}</span>
          </div>
        </div>
      )}
    </div>
  );
}
