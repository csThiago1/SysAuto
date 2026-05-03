"use client"

import { useEffect, useRef, useState } from "react"
import { Barcode } from "lucide-react"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface BarcodeScanInputProps {
  onScan: (code: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

/* ------------------------------------------------------------------ */
/*  BarcodeScanInput                                                   */
/*  Input that accepts typing or USB barcode scanner input.            */
/*  When Enter is pressed or after a short debounce (scanner sends     */
/*  Enter automatically), triggers onScan(code).                       */
/* ------------------------------------------------------------------ */

export function BarcodeScanInput({
  onScan,
  placeholder = "Bipe ou digite o codigo de barras...",
  disabled = false,
  className = "",
}: BarcodeScanInputProps) {
  const [value, setValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-focus on mount
  useEffect(() => {
    if (inputRef.current && !disabled) {
      inputRef.current.focus()
    }
  }, [disabled])

  function handleSubmit() {
    const trimmed = value.trim()
    if (!trimmed) return
    onScan(trimmed)
    setValue("")
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
      handleSubmit()
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newVal = e.target.value
    setValue(newVal)

    // Debounce for scanner (sends chars fast then Enter, but just in case)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      // Only auto-submit if value looks like a scanned barcode (long enough)
      if (newVal.trim().length >= 20) {
        const trimmed = newVal.trim()
        onScan(trimmed)
        setValue("")
      }
    }, 300)
  }

  return (
    <div className={`relative ${className}`}>
      <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full bg-white/5 border border-white/10 text-white rounded-md pl-10 pr-4 py-2 text-sm font-mono placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-40 disabled:cursor-not-allowed"
      />
    </div>
  )
}
