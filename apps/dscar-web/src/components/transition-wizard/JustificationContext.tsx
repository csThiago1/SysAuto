"use client"

import { createContext, useContext } from "react"

interface JustificationContextValue {
  justification: string
  setJustification: (next: string) => void
}

const JustificationContext = createContext<JustificationContextValue>({
  justification: "",
  setJustification: () => {},
})

export const JustificationProvider = JustificationContext.Provider

export function useJustification(): JustificationContextValue {
  return useContext(JustificationContext)
}
