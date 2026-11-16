"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { formatCPF, formatPhone, onlyDigits } from "@paddock/utils";
import { DsCarLogo } from "@/components/DsCarLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { isFormField, toFormErrors, type Errors } from "./form-errors";

const CNH_MAX_BYTES = 10 * 1024 * 1024;
const CNH_TYPES = ["application/pdf", "image/jpeg", "image/png"];

const inviteInfoSchema = z.object({ role_display: z.string(), expires_at: z.string() });

const formSchema = z
  .object({
    full_name: z.string().trim().refine((v) => v.split(/\s+/).length >= 2, "Informe o nome completo."),
    email: z.string().trim().email("E-mail inválido."),
    cpf: z.string().refine((v) => onlyDigits(v).length === 11, "CPF deve ter 11 dígitos."),
    phone: z.string().refine((v) => onlyDigits(v).length >= 10, "Informe o telefone com DDD."),
    password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
    confirm: z.string(),
    cnh: z
      .instanceof(File)
      .nullable()
      .refine((f) => !f || CNH_TYPES.includes(f.type), "Envie a CNH em PDF, JPG ou PNG.")
      .refine((f) => !f || f.size <= CNH_MAX_BYTES, "A CNH pode ter no máximo 10 MB."),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "As senhas não conferem." });

type FormValues = z.infer<typeof formSchema>;

const inputClass =
  "bg-secondary-950 border-secondary-700 text-foreground placeholder:text-secondary-600 focus-visible:ring-ring";

class GoneError extends Error {}

async function fetchInvite(token: string): Promise<z.infer<typeof inviteInfoSchema>> {
  const res = await fetch(`/api/proxy/auth/invites/token/${encodeURIComponent(token)}/`);
  if (res.status === 410 || res.status === 404) throw new GoneError();
  if (!res.ok) throw new Error("load_failed");
  return inviteInfoSchema.parse(await res.json());
}

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary-950 py-10">
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(192,18,18,0.18) 0%, transparent 70%)",
        }}
      />
      <div className="relative z-10 w-full max-w-md px-4 sm:px-6">
        <div className="mb-8 flex justify-center">
          <DsCarLogo variant="light" size={28} />
        </div>
        <Card className="w-full border-secondary-800 bg-secondary-900 shadow-dropdown">
          <CardHeader>
            <CardTitle className="text-foreground">{title}</CardTitle>
            <p className="text-sm text-secondary-400">{subtitle}</p>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ConvitePage({ params }: { params: Promise<{ token: string }> }): React.ReactElement {
  const { token } = React.use(params);
  const router = useRouter();
  const invite = useQuery({ queryKey: ["invite", token], queryFn: () => fetchInvite(token), retry: false });

  const [values, setValues] = useState<FormValues>({
    full_name: "",
    email: "",
    cpf: "",
    phone: "",
    password: "",
    confirm: "",
    cnh: null,
  });
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]): void {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined, detail: undefined }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    const parsed = formSchema.safeParse(values);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        if (isFormField(key)) next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }

    const body = new FormData();
    body.append("full_name", parsed.data.full_name);
    body.append("email", parsed.data.email);
    body.append("cpf", onlyDigits(parsed.data.cpf));
    body.append("phone", parsed.data.phone);
    body.append("password", parsed.data.password);
    if (parsed.data.cnh) body.append("cnh", parsed.data.cnh);

    setSending(true);
    try {
      const res = await fetch(`/api/proxy/auth/invites/token/${encodeURIComponent(token)}/accept/`, {
        method: "POST",
        body,
      });
      if (res.ok) {
        toast.success("Cadastro concluído. Entre com seu e-mail e senha.");
        router.push("/login");
        return;
      }
      if (res.status === 410) {
        await invite.refetch();
        return;
      }
      setErrors(toFormErrors(await res.json().catch(() => null)));
    } catch {
      setErrors({ detail: "Erro de conexão. Tente novamente." });
    } finally {
      setSending(false);
    }
  }

  if (invite.isLoading) {
    return (
      <Shell title="Cadastro" subtitle="Conferindo seu convite...">
        <div className="space-y-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </Shell>
    );
  }

  if (invite.isError) {
    const gone = invite.error instanceof GoneError;
    return (
      <Shell title="Convite indisponível" subtitle="">
        <p className="text-sm text-secondary-300">
          {gone
            ? "Este convite é inválido ou já venceu. Peça um novo ao responsável."
            : "Não foi possível abrir o convite agora. Tente novamente em instantes."}
        </p>
        {!gone && (
          <Button className="mt-4 w-full" onClick={() => void invite.refetch()}>
            Tentar novamente
          </Button>
        )}
      </Shell>
    );
  }

  const field = (
    key: "full_name" | "email" | "cpf" | "phone" | "password" | "confirm",
    label: string,
    props: React.ComponentProps<typeof Input>,
    format: (v: string) => string = (v) => v
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={key} className="text-secondary-300">
        {label}
      </Label>
      <Input
        id={key}
        value={values[key]}
        onChange={(e) => set(key, format(e.target.value))}
        aria-invalid={!!errors[key]}
        className={inputClass}
        {...props}
      />
      {errors[key] && <p className="text-xs text-error-400">{errors[key]}</p>}
    </div>
  );

  return (
    <Shell title="Cadastro de colaborador" subtitle={`Acesso como ${invite.data?.role_display ?? ""}`}>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4" noValidate>
        {field("full_name", "Nome completo", { autoComplete: "name", placeholder: "Como no documento" })}
        {field("email", "E-mail", { type: "email", autoComplete: "email", inputMode: "email" })}
        {field("cpf", "CPF", { inputMode: "numeric", placeholder: "000.000.000-00" }, formatCPF)}
        {field("phone", "Telefone (WhatsApp)", { type: "tel", autoComplete: "tel", placeholder: "(92) 99999-9999" }, formatPhone)}
        {field("password", "Senha", { type: "password", autoComplete: "new-password", placeholder: "Mínimo 8 caracteres" })}
        {field("confirm", "Confirmar senha", { type: "password", autoComplete: "new-password" })}

        <div className="space-y-1.5">
          <Label htmlFor="cnh" className="text-secondary-300">
            Cópia da CNH (opcional)
          </Label>
          <Input
            id="cnh"
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={(e) => set("cnh", e.target.files?.[0] ?? null)}
            className={`${inputClass} file:text-secondary-200`}
          />
          <p className="text-xs text-secondary-500">Para o termo do RH. PDF, JPG ou PNG até 10 MB.</p>
          {errors.cnh && <p className="text-xs text-error-400">{errors.cnh}</p>}
        </div>

        {errors.detail && <p className="text-sm text-error-400">{errors.detail}</p>}

        <Button type="submit" className="w-full" disabled={sending}>
          {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Concluir cadastro
        </Button>
      </form>
    </Shell>
  );
}
