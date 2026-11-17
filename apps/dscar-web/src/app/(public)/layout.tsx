import type { Metadata } from "next";

export const metadata: Metadata = { title: "Confirmação de checklist" };

/** Casca das páginas abertas pelo cliente (sem login): só o logo, sem dock nem sidebar. */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="relative flex min-h-dvh flex-col items-center bg-background px-4 py-10">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-80"
        style={{
          background:
            "radial-gradient(ellipse 70% 100% at 50% 0%, rgba(192,18,18,0.16) 0%, transparent 70%)",
        }}
      />
      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-dscar.png"
          alt="DS Car Centro Automotivo"
          width={1312}
          height={685}
          className="h-auto w-40 brightness-0 invert"
        />
        {children}
      </div>
    </div>
  );
}
