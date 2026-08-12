import * as React from "react"
import { Input } from "./input"
// Mascaras vivem em @paddock/utils — este arquivo mantinha uma copia divergente.
import { formatPhone, formatCpfCnpj, formatCEP, formatDateBR, onlyDigits } from "@paddock/utils"

export { formatPhone, formatCpfCnpj, formatCEP, formatDateBR }

export interface MaskedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onValueChange?: (value: string) => void
}

export const PhoneInput = React.forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ onChange, onValueChange, value, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value
      const formatted = formatPhone(raw)
      e.target.value = formatted // Update DOM internally for cursors
      if (onChange) onChange(e)
      if (onValueChange) onValueChange(onlyDigits(formatted))
    }

    return <Input ref={ref} onChange={handleChange} value={value} placeholder="(00) 00000-0000" {...props} />
  }
)
PhoneInput.displayName = "PhoneInput"


export const CpfCnpjInput = React.forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ onChange, onValueChange, value, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value
      const formatted = formatCpfCnpj(raw)
      e.target.value = formatted
      if (onChange) onChange(e)
      if (onValueChange) onValueChange(onlyDigits(formatted)) // Retorna clean value para a lib
    }

    return <Input ref={ref} onChange={handleChange} value={value} placeholder="000.000.000-00" {...props} />
  }
)
CpfCnpjInput.displayName = "CpfCnpjInput"


export const DateInput = React.forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ onChange, onValueChange, value, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatDateBR(e.target.value)
      e.target.value = formatted
      if (onChange) onChange(e)
      // Data sai FORMATADA (dd/mm/aaaa) — os outros saem limpos. Contrato antigo.
      if (onValueChange) onValueChange(formatted)
    }
    return (
      <Input
        ref={ref}
        onChange={handleChange}
        value={value}
        placeholder="DD/MM/AAAA"
        inputMode="numeric"
        {...props}
      />
    )
  }
)
DateInput.displayName = "DateInput"


export const CepInput = React.forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ onChange, onValueChange, value, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatCEP(e.target.value)
      e.target.value = formatted
      if (onChange) onChange(e)
      if (onValueChange) onValueChange(onlyDigits(formatted))
    }
    return (
      <Input
        ref={ref}
        onChange={handleChange}
        value={value}
        placeholder="00000-000"
        inputMode="numeric"
        {...props}
      />
    )
  }
)
CepInput.displayName = "CepInput"


export const EmailInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>((props, ref) => (
  <Input ref={ref} type="email" placeholder="nome@exemplo.com.br" {...props} />
))
EmailInput.displayName = "EmailInput"


export type PixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "RANDOM" | ""

interface PixKeyInputProps extends MaskedInputProps {
  pixType?: PixKeyType
}

export const PixKeyInput = React.forwardRef<HTMLInputElement, PixKeyInputProps>(
  ({ pixType, onChange, onValueChange, value, ...props }, ref) => {
    const placeholder =
      pixType === "CPF" ? "000.000.000-00" :
      pixType === "CNPJ" ? "00.000.000/0000-00" :
      pixType === "EMAIL" ? "nome@exemplo.com.br" :
      pixType === "PHONE" ? "(00) 00000-0000" :
      "chave aleatória"

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let v = e.target.value
      if (pixType === "CPF" || pixType === "CNPJ") v = formatCpfCnpj(v)
      else if (pixType === "PHONE") v = formatPhone(v)
      e.target.value = v
      if (onChange) onChange(e)
      if (onValueChange) onValueChange(v.replace(/[^A-Za-z0-9@.\-]/g, ""))
    }

    return (
      <Input
        ref={ref}
        onChange={handleChange}
        value={value}
        placeholder={placeholder}
        {...props}
      />
    )
  }
)
PixKeyInput.displayName = "PixKeyInput"
