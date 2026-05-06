import Link from "next/link";

export default function NotFound(): React.ReactElement {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <p className="text-7xl font-bold text-primary">404</p>
      <h1 className="mt-4 text-xl font-semibold text-foreground">
        Página não encontrada
      </h1>
      <p className="mt-2 text-sm text-muted-foreground text-center max-w-md">
        A página que você procura não existe ou foi movida.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Voltar ao início
      </Link>
    </div>
  );
}
