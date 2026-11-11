import { describe, expect, it, vi } from "vitest";

// auth(handler) devolve o próprio handler: testamos a regra, não o NextAuth.
vi.mock("@/lib/auth", () => ({ auth: (handler: unknown) => handler }));

import middleware, { config } from "./middleware";

type Handler = (req: { auth: unknown; nextUrl: URL; url: string }) => Response | undefined;

function run(path: string, loggedIn: boolean): Response | undefined {
  const url = `http://localhost:3000${path}`;
  return (middleware as unknown as Handler)({
    auth: loggedIn ? { role: "CONSULTANT", permissions: [] } : null,
    nextUrl: new URL(url),
    url,
  });
}

// O matcher é um padrão do path-to-regexp cujo grupo é uma regex JS comum.
const matches = (path: string): boolean =>
  config.matcher.some((m) => new RegExp(`^${m}$`).test(path));

describe("middleware — rotas públicas", () => {
  it("confirmar-checklist abre sem sessão", () => {
    expect(run("/confirmar-checklist/abc123", false)).toBeUndefined();
  });

  it("confirmar-checklist não manda quem está logado para o dashboard", () => {
    expect(run("/confirmar-checklist/abc123", true)).toBeUndefined();
  });

  it("rota interna sem sessão continua indo para o login", () => {
    expect(run("/os", false)?.headers.get("Location")).toBe("http://localhost:3000/login");
  });
});

describe("middleware — matcher", () => {
  it("assets do carro 3D ficam fora do middleware (mobile baixa sem cookie)", () => {
    expect(matches("/car-3d/placeholder-hatch.glb")).toBe(false);
    expect(matches("/car-3d/regions/placeholder-hatch.json")).toBe(false);
  });

  it("páginas continuam passando pelo middleware", () => {
    expect(matches("/os")).toBe(true);
    expect(matches("/dev/car-3d")).toBe(true);
    expect(matches("/confirmar-checklist/abc123")).toBe(true);
  });
});
