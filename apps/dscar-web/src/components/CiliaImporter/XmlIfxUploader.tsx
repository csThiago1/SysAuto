import { useRef, useState } from 'react';
import { CheckCircle, FileUp, Upload, XCircle } from 'lucide-react';
import { useUploadXmlIfx } from '../../hooks/useImports';

type Insurer = 'porto' | 'azul' | 'itau';

type Props = {
  onOpenServiceOrder?: (osId: number) => void;
};

export function XmlIfxUploader({ onOpenServiceOrder }: Props) {
  const upload = useUploadXmlIfx();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [insurer, setInsurer] = useState<Insurer>('porto');

  const submit = () => {
    if (!file) return;
    upload.mutate({ file, insurer_code: insurer });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <h2 className="text-lg font-semibold text-slate-800 mb-1">
        Upload XML IFX (Porto / Azul / Itaú)
      </h2>
      <p className="text-sm text-slate-500 mb-4">
        Faça upload do XML da finalização de orçamento. O sistema detecta peças
        trocadas, recuperadas, overlap e serviços terceiros.
      </p>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Seguradora</label>
          <select
            value={insurer}
            onChange={(e) => setInsurer(e.target.value as Insurer)}
            className="w-full px-3 py-2 border border-slate-300 rounded"
          >
            <option value="porto">Porto Seguro</option>
            <option value="azul">Azul Seguros</option>
            <option value="itau">Itaú Seguros</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Arquivo XML</label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="file"
              accept=".xml,application/xml,text/xml"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
            <button
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 px-3 py-2 border border-slate-300 rounded hover:bg-slate-50 text-sm"
            >
              <FileUp size={16} />
              {file ? file.name : 'Escolher arquivo'}
            </button>
          </div>
        </div>
      </div>

      <button
        onClick={submit}
        disabled={upload.isPending || !file}
        className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
      >
        <Upload size={16} />
        {upload.isPending ? 'Enviando…' : 'Importar XML'}
      </button>

      {upload.error && (
        <div className="mt-3 flex items-start gap-2 text-sm text-red-600">
          <XCircle size={16} className="mt-0.5 flex-shrink-0" />
          <span>Erro: {(upload.error as Error).message}</span>
        </div>
      )}

      {upload.data && upload.data.parsed_ok && (
        <div className="mt-3 flex items-start gap-2 text-sm text-green-700">
          <CheckCircle size={16} className="mt-0.5 flex-shrink-0" />
          <span>
            XML importado! OS #{upload.data.service_order}, versão #
            {upload.data.version_created}.
            {onOpenServiceOrder && upload.data.service_order && (
              <button
                onClick={() => onOpenServiceOrder(upload.data!.service_order!)}
                className="ml-2 underline hover:text-green-900"
              >
                Abrir OS →
              </button>
            )}
          </span>
        </div>
      )}

      {upload.data && !upload.data.parsed_ok && (
        <div className="mt-3 flex items-start gap-2 text-sm text-red-600">
          <XCircle size={16} className="mt-0.5 flex-shrink-0" />
          <span>
            {upload.data.error_type}: {upload.data.error_message}
          </span>
        </div>
      )}
    </div>
  );
}
