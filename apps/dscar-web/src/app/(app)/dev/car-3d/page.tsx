import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { CarCalibrator } from "./_components/CarCalibrator";

/**
 * Tela interna de calibração das caixas das peças (regions.json). Só por URL, fora do menu.
 * Em dev abre sempre; no build de produção só com NEXT_PUBLIC_ENABLE_DEV_TOOLS=true.
 */
export default function Car3DCalibrationPage(): ReactElement {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS !== "true") {
    notFound();
  }
  return <CarCalibrator />;
}
