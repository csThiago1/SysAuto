import { CAR_MODELS, LICENSE_LABELS, LICENSE_URLS } from "@paddock/car-3d/core";
import { Info } from "lucide-react";
import type { ReactElement } from "react";

export const metadata = { title: "Créditos" };

/** Créditos dos modelos 3D do checklist (CC BY / CC BY-NC-SA exigem autor, link e licença). */
export default function CreditsPage(): ReactElement {
  const models = CAR_MODELS.filter((m) => m.license !== "PLACEHOLDER");
  return (
    <div className="px-0 py-3 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Info className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-lg font-semibold text-foreground">Créditos</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Modelos 3D usados no checklist de entrada. Em todos, a malha foi simplificada e os vidros, escurecidos.
          </p>
        </div>
      </div>
      <ul className="divide-y divide-border rounded-lg border border-border bg-muted/50">
        {models.map((m) => (
          <li key={m.key} className="p-4 space-y-1">
            <p className="text-sm font-semibold text-foreground">{m.title}</p>
            <p className="text-xs text-muted-foreground">
              Autor: {m.author} · Licença:{" "}
              {m.license !== "PLACEHOLDER" && (
                <a href={LICENSE_URLS[m.license]} target="_blank" rel="noreferrer" className="text-primary underline">
                  {LICENSE_LABELS[m.license]}
                </a>
              )}
            </p>
            {m.changes && <p className="text-xs text-muted-foreground">Modificações: {m.changes}.</p>}
            <a href={m.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline break-all">
              {m.sourceUrl}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
