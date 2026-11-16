import Link from "next/link";
import { Button } from "@/components/ui/button"

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
      <Button asChild className="mt-6">
        <Link
          href="/dashboard"
        >
        Voltar ao início
        </Link>
      </Button>
    </div>
  );
}
