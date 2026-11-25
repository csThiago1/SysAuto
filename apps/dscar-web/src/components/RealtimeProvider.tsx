"use client"

import { useEffect } from "react"
import { useQueryClient, type QueryKey } from "@tanstack/react-query"
import {
  REALTIME_INVALIDATIONS,
  RealtimeEventSchema,
  TicketResponseSchema,
  realtimeUrl,
  reconnectDelayMs,
} from "@/lib/realtime"

const AGRUPAR_MS = 300

// Mantém o websocket de tempo real aberto e invalida as queries quando o servidor avisa.
// Sem NEXT_PUBLIC_REALTIME_WS_URL não faz nada. Renderiza null.
export function RealtimeProvider(): null {
  const queryClient = useQueryClient()

  useEffect(() => {
    const url = realtimeUrl()
    if (!url) return

    let parado = false
    let tentativa = 0
    let jaConectou = false
    let socket: WebSocket | null = null
    let timerReconexao: ReturnType<typeof setTimeout> | undefined
    let timerRajada: ReturnType<typeof setTimeout> | undefined
    const pendentes = new Map<string, QueryKey>()

    // Qualquer falha (ticket ou close, inclusive o 1006 de handshake recusado) cai aqui.
    const reagendar = (): void => {
      if (parado) return
      timerReconexao = setTimeout(conectar, reconnectDelayMs(tentativa))
      tentativa += 1
    }

    const conectar = async (): Promise<void> => {
      try {
        const res = await fetch("/api/proxy/realtime/ticket/")
        if (!res.ok) throw new Error("ticket recusado")
        const { ticket } = TicketResponseSchema.parse(await res.json())
        if (parado) return
        const ws = new WebSocket(`${url}?ticket=${encodeURIComponent(ticket)}`)
        socket = ws
        ws.onopen = () => {
          tentativa = 0
          // Reconexão: eventos podem ter sido perdidos enquanto estava fora.
          if (jaConectou) void queryClient.invalidateQueries()
          jaConectou = true
        }
        ws.onmessage = (e: MessageEvent<string>) => {
          let dado: unknown
          try {
            dado = JSON.parse(e.data)
          } catch {
            return
          }
          const evento = RealtimeEventSchema.safeParse(dado)
          if (!evento.success) return
          for (const key of REALTIME_INVALIDATIONS[evento.data.entity]) {
            pendentes.set(JSON.stringify(key), key)
          }
          // Rajada (ex.: importação do Cilia): uma invalidação só, 300 ms após o primeiro evento.
          timerRajada ??= setTimeout(() => {
            timerRajada = undefined
            for (const queryKey of pendentes.values()) void queryClient.invalidateQueries({ queryKey })
            pendentes.clear()
          }, AGRUPAR_MS)
        }
        ws.onclose = reagendar
      } catch {
        reagendar()
      }
    }

    void conectar()

    return () => {
      parado = true
      clearTimeout(timerReconexao)
      clearTimeout(timerRajada)
      socket?.close()
    }
  }, [queryClient])

  return null
}
