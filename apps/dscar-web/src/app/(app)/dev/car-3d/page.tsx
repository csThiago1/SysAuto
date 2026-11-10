import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { CarCalibrator } from "./_components/CarCalibrator";

/** Tela interna de calibração das caixas das peças (regions.json). Só por URL, fora do menu. */
export default function Car3DCalibrationPage(): ReactElement {
  if (process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS !== "true") notFound();
  return <CarCalibrator />;
}
