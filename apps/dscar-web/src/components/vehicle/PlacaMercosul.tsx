import { cn } from "@/lib/utils"

const SIZES = {
  sm: { band: "h-[5px]", text: "px-1.5 text-[15px]" },
  md: { band: "h-2", text: "px-2.5 text-[22px]" },
  lg: { band: "h-3", text: "px-4 text-[40px]" },
} as const

interface PlacaMercosulProps {
  plate: string
  size?: keyof typeof SIZES
  className?: string
}

/**
 * Placa no desenho Mercosul (sem hífen, faixa azul em cima, caracteres pretos no branco):
 * é como o pátio reconhece o carro, antes de ler qualquer outro dado.
 */
export function PlacaMercosul({ plate, size = "md", className }: PlacaMercosulProps): React.ReactElement {
  const s = SIZES[size]
  return (
    <span
      className={cn(
        "inline-flex shrink-0 flex-col overflow-hidden rounded-[3px] border-2 border-neutral-900 bg-white leading-none text-neutral-950",
        className,
      )}
    >
      <span aria-hidden className={cn("block bg-[#1d3a8a]", s.band)} />
      <span className={cn("font-plate font-bold tracking-[0.08em]", s.text, size === "lg" ? "py-1" : "py-0.5")}>
        {plate.replace(/[^A-Za-z0-9]/g, "").toUpperCase()}
      </span>
    </span>
  )
}
