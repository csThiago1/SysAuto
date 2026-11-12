"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, FileText, Link2Off, Loader2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

const ConfirmInfoSchema = z.object({
  placa: z.string(),
  modelo: z.string(),
  pdf_url: z.string().nullable(),
  version: z.number(),
});

const ConfirmedSchema = z.object({ signed_at: z.string() });

/** Status HTTP da resposta de erro — 404 e 410 têm mensagem própria. */
class LinkError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
  }
}

const EXPIRED = "Este link venceu ou já foi usado. Se precisar, peça um novo à DS Car.";
const INVALID = "Link inválido.";

/** 404/410 encerram o link; qualquer outro erro é transitório. */
function deadLinkMessage(error: unknown): string | null {
  if (!(error instanceof LinkError)) return null;
  if (error.status === 410) return EXPIRED;
  if (error.status === 404) return INVALID;
  return null;
}

// Sem sessão, pelo mesmo proxy de esqueci-senha/redefinir-senha (tenant pelo domínio padrão).
async function call<T>(url: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new LinkError(res.status);
  return schema.parse(await res.json());
}

/** pdf_url vem relativo à API (/api/v1/...); o navegador chega nele pelo proxy. */
const proxied = (apiPath: string): string => `/api/proxy${apiPath.replace("/api/v1/", "/")}`;

export default function ConfirmChecklistPage(): React.ReactElement {
  const { token } = useParams<{ token: string }>();
  const url = `/api/proxy/public/checklist-confirm/${encodeURIComponent(token)}/`;
  const [name, setName] = useState("");

  const info = useQuery({
    queryKey: ["public-checklist-confirm", token],
    queryFn: () => call(url, ConfirmInfoSchema),
    // Como o padrão do app (1 nova tentativa), mas link morto não se tenta de novo.
    retry: (count, error) => deadLinkMessage(error) === null && count < 1,
  });

  const confirm = useMutation({
    mutationFn: (signerName: string) =>
      call(url, ConfirmedSchema, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signer_name: signerName }),
      }),
  });

  if (confirm.isSuccess) {
    return (
      <StatusCard icon={<CheckCircle2 className="h-10 w-10 text-success-400" />}>
        Obrigado! Confirmação registrada.
      </StatusCard>
    );
  }

  const dead = deadLinkMessage(info.error) ?? deadLinkMessage(confirm.error);
  if (dead) {
    return <StatusCard icon={<Link2Off className="h-10 w-10 text-muted-foreground" />}>{dead}</StatusCard>;
  }

  if (info.isPending) {
    return (
      <Panel>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-12 w-44" />
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </Panel>
    );
  }

  if (info.isError) {
    return (
      <Panel>
        <p className="text-sm text-foreground/80">
          Não foi possível abrir o checklist. Verifique a conexão e tente de novo.
        </p>
        <Button variant="outline" onClick={() => void info.refetch()}>
          Tentar de novo
        </Button>
      </Panel>
    );
  }

  const { placa, modelo, pdf_url, version } = info.data;
  const canSubmit = name.trim().length > 0 && !confirm.isPending;

  return (
    <Panel>
      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        Checklist de entrada · versão {version}
      </p>
      <div className="flex flex-col items-start gap-2">
        <span
          data-plate
          className="rounded border-2 border-secondary-300 bg-secondary-100 px-3 py-1 text-2xl text-secondary-950"
        >
          {placa}
        </span>
        {modelo && <span className="text-base font-semibold text-foreground">{modelo}</span>}
      </div>

      <p className="text-sm text-foreground/80">
        Confira as fotos e as marcas registradas na entrada do veículo na oficina. Se estiver tudo
        certo, confirme abaixo.
      </p>

      {pdf_url ? (
        <Button variant="outline" asChild className="w-full">
          <a href={proxied(pdf_url)} target="_blank" rel="noopener noreferrer">
            <FileText className="h-4 w-4" aria-hidden />
            Ver checklist (PDF)
          </a>
        </Button>
      ) : (
        <p className="rounded border border-border px-3 py-2 text-sm text-muted-foreground">
          O PDF do checklist ainda não está disponível. Fale com a DS Car antes de confirmar.
        </p>
      )}

      <form
        className="flex flex-col gap-4 border-t border-border pt-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) confirm.mutate(name.trim());
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="signer-name" className="text-foreground/80">
            Seu nome
          </Label>
          <Input
            id="signer-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            maxLength={200}
            className="bg-background"
          />
        </div>
        <Button type="submit" disabled={!canSubmit} className="h-auto w-full whitespace-normal py-3">
          {confirm.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Confirmo que o veículo entrou nestas condições
        </Button>
        {confirm.isError && (
          <p role="alert" className="text-sm text-error-400">
            Não foi possível registrar a confirmação. Tente de novo.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Ao confirmar, registramos seu nome, a data, a hora e o endereço de rede deste aparelho.
        </p>
      </form>
    </Panel>
  );
}

function Panel({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <main className="flex w-full flex-col gap-5 rounded-lg border border-border bg-card p-6 shadow-dropdown">
      {children}
    </main>
  );
}

function StatusCard({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Panel>
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        {icon}
        <p className="text-base font-semibold text-foreground">{children}</p>
      </div>
    </Panel>
  );
}
