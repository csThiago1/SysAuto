import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { cn } from '../utils';

type Option = {
  value: string;
  label: string;
  subLabel?: string;
  disabled?: boolean;
};

type SearchableSelectProps = {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export function SearchableSelect({ options, value, onChange, placeholder = 'Selecione...', className }: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (opt.subLabel && opt.subLabel.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className={cn("relative", className)} ref={wrapperRef}>
      <div 
        className="w-full px-3 py-2 bg-page-bg border border-surface rounded-xl text-sm flex items-center justify-between cursor-pointer focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={selectedOption ? "text-slate-900" : "text-slate-500"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={16} className="text-slate-400" />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-surface rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-surface flex items-center gap-2">
            <Search size={14} className="text-slate-400" />
            <input
              type="text"
              className="w-full text-sm outline-none"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-sm text-slate-500 text-center">Nenhum resultado encontrado.</div>
            ) : (
              filteredOptions.map(opt => (
                <div
                  key={opt.value}
                  className={cn(
                    "px-3 py-2 text-sm transition-colors",
                    opt.disabled ? "opacity-50 cursor-not-allowed bg-slate-50" : "cursor-pointer hover:bg-slate-50",
                    value === opt.value ? "bg-primary/5 text-primary font-medium" : "text-slate-700"
                  )}
                  onClick={() => {
                    if (opt.disabled) return;
                    onChange(opt.value);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                >
                  <div>{opt.label}</div>
                  {opt.subLabel && <div className="text-xs text-slate-500 mt-0.5">{opt.subLabel}</div>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
