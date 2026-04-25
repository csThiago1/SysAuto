import React, { useState, useRef, useEffect } from "react";
import { Search, UserPlus, X, Loader2 } from "lucide-react";
import { Input, Button, Label, Avatar, PhoneInput } from "@/components/ui";
import { useDebounce, usePersons, useCreatePerson } from "@/hooks";
import type { Person } from "@paddock/types";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api";

function getDocumentDisplay(person: Person): string {
  const primary = (person.documents ?? []).find((d) => d.is_primary) ?? (person.documents ?? [])[0];
  return primary ? primary.value_masked : "";
}


interface CustomerPickerProps {
  value: number;
  onChange: (personId: number, personName?: string) => void;
  error?: string;
}

export function CustomerPicker({ value, onChange, error }: CustomerPickerProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Person | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
  // Inline create
  const [showInline, setShowInline] = useState(false);
  const [inlineName, setInlineName] = useState("");
  const [inlinePhone, setInlinePhone] = useState("");
  const [inlineErrors, setInlineErrors] = useState<Record<string, string>>({});
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedSearch = useDebounce(search, 300);
  const { data: personsData, isFetching } = usePersons({
    role: "CLIENT",
    search: debouncedSearch || undefined,
  });
  
  const { mutate: createPerson, isPending: creating } = useCreatePerson();

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (person: Person) => {
    setSelected(person);
    setSearch(person.full_name);
    setDropdownOpen(false);
    onChange(person.id, person.full_name);
  };

  const handleClear = () => {
    setSelected(null);
    setSearch("");
    onChange(0);
  };

  const handleInlineCreate = () => {
    const name = inlineName.trim();
    const errs: Record<string, string> = {};
    if (!name || name.length < 2) errs.name = "Nome obrigatório";
    if (!inlinePhone || inlinePhone.replace(/\D/g, "").length < 10) {
      errs.phone = "Telefone inválido (mín. 10 dígitos)";
    }
    if (Object.keys(errs).length > 0) {
      setInlineErrors(errs);
      return;
    }

    createPerson(
      {
        person_kind: "PF",
        full_name: name,
        roles: ["CLIENT"],
        contacts: [{ contact_type: "CELULAR", value: inlinePhone.replace(/\D/g, ""), is_primary: true }],
        addresses: [],
      },
      {
        onSuccess: (created) => {
          handleSelect(created);
          setShowInline(false);
          setInlineName("");
          setInlinePhone("");
          setInlineErrors({});
        },
        onError: (err) => {
          if (err instanceof ApiError && err.fieldErrors) {
            const mapped: Record<string, string> = {};
            Object.entries(err.fieldErrors).forEach(([f, msgs]) => {
              mapped[f] = msgs[0] ?? "";
            });
            setInlineErrors(mapped);
          } else {
            setInlineErrors({ general: err.message });
          }
        },
      }
    );
  };

  if (selected) {
    const primaryContact = selected.primary_contact?.value ?? "";
    return (
      <div className="flex items-center justify-between rounded-md bg-white border border-neutral-200 p-3 shadow-sm">
        <div className="flex items-center gap-3">
          <Avatar name={selected.full_name} />
          <div>
            <p className="text-sm font-medium text-neutral-900">{selected.full_name}</p>
            <p className="text-xs text-neutral-500">
              {getDocumentDisplay(selected) ? `${getDocumentDisplay(selected)} · ` : ""}
              {primaryContact}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleClear} className="text-neutral-400 hover:text-error-600">
          Trocar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
        <Input
          ref={inputRef}
          placeholder="Digite o nome, documento ou contato..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setDropdownOpen(true);
            onChange(0);
          }}
          onFocus={() => setDropdownOpen(true)}
          className={cn("pl-9 bg-white", error && "border-error-400")}
          autoComplete="off"
        />
        {isFetching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-neutral-400" />
        )}

        {dropdownOpen && search.length > 0 && !showInline && (
          <div ref={dropdownRef} className="absolute left-0 top-full z-50 mt-1 w-full rounded-md border border-neutral-200 bg-white shadow-lg max-h-60 overflow-y-auto">
            {!personsData || personsData.results.length === 0 ? (
              <>
                <div className="px-4 py-3 text-sm text-neutral-500">Nenhum cliente encontrado</div>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-primary-600 hover:bg-primary-50 border-t border-neutral-100 font-medium transition-colors"
                  onClick={() => {
                    setInlineName(search);
                    setShowInline(true);
                    setDropdownOpen(false);
                  }}
                >
                  <UserPlus className="h-4 w-4" />
                  Cadastrar &quot;{search}&quot; como novo cliente
                </button>
              </>
            ) : (
              personsData.results.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  className="flex w-full flex-col px-4 py-3 text-left hover:bg-neutral-50 border-b border-neutral-50 last:border-0 transition-colors"
                  onClick={() => handleSelect(person)}
                >
                  <span className="text-sm font-medium text-neutral-900">{person.full_name}</span>
                  <span className="text-xs text-neutral-500">
                    {getDocumentDisplay(person) ? `${getDocumentDisplay(person)} · ` : ""}
                    {person.primary_contact?.value ?? "Sem contato"}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-error-600">{error}</p>}

      {showInline && (
        <div className="rounded-md border border-primary-200 bg-primary-50/50 p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-primary-800 flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Cadastrar novo cliente
            </p>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowInline(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="il-name">Nome <span className="text-error-500">*</span></Label>
              <Input
                id="il-name"
                value={inlineName}
                onChange={(e) => { setInlineName(e.target.value); setInlineErrors((p) => ({ ...p, name: "" })); }}
                placeholder="Nome completo"
                className={cn("bg-white", inlineErrors.name && "border-error-400")}
              />
              {inlineErrors.name && <p className="text-xs text-error-600">{inlineErrors.name}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="il-phone">Telefone <span className="text-error-500">*</span></Label>
              <PhoneInput
                id="il-phone"
                value={inlinePhone}
                onValueChange={(val) => { setInlinePhone(val); setInlineErrors((p) => ({ ...p, phone: "" })); }}
                placeholder="(00) 00000-0000"
                className={cn("bg-white", inlineErrors.phone && "border-error-400")}
              />
              {inlineErrors.phone && <p className="text-xs text-error-600">{inlineErrors.phone}</p>}
            </div>
          </div>
          {inlineErrors.general && <p className="text-xs text-error-600">{inlineErrors.general}</p>}

          <div className="flex justify-end pt-1">
            <Button type="button" size="sm" disabled={creating} onClick={handleInlineCreate}>
              {creating && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Salvar e Selecionar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
