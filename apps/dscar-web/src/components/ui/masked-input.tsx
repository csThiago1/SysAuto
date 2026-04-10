import * as React from "react"
import { Input } from "./input"

export interface MaskedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onValueChange?: (value: string) => void
}

/** Formata para (00) 00000-0000 ou (00) 0000-0000 */
export function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11)
  if (digits.length === 0) return ""
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

/** Formata para CPF (000.000.000-00) ou CNPJ (00.000.000/0000-00) */
export function formatCpfCnpj(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 14)
  if (digits.length === 0) return ""

  if (digits.length <= 11) {
    // Máscara de CPF
    let cpf = digits
    if (cpf.length > 3) cpf = cpf.replace(/^(\d{3})(\d)/, "$1.$2")
    if (cpf.length > 6) cpf = cpf.replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    if (cpf.length > 9) cpf = cpf.replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4")
    return cpf
  } else {
    // Máscara de CNPJ
    let cnpj = digits
    if (cnpj.length > 2) cnpj = cnpj.replace(/^(\d{2})(\d)/, "$1.$2")
    if (cnpj.length > 5) cnpj = cnpj.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    if (cnpj.length > 8) cnpj = cnpj.replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
    if (cnpj.length > 12) cnpj = cnpj.replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5")
    return cnpj
  }
}

export const PhoneInput = React.forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ onChange, onValueChange, value, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value
      const formatted = formatPhone(raw)
      e.target.value = formatted // Update DOM internally for cursors
      if (onChange) onChange(e)
      if (onValueChange) onValueChange(formatted.replace(/\D/g, ""))
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
      if (onValueChange) onValueChange(formatted.replace(/\D/g, "")) // Retorna clean value para a lib
    }

    return <Input ref={ref} onChange={handleChange} value={value} placeholder="000.000.000-00" {...props} />
  }
)
CpfCnpjInput.displayName = "CpfCnpjInput"
