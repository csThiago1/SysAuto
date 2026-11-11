import { describe, expect, it, vi } from "vitest";

// auth(handler) devolve o próprio handler: testamos a regra, não o NextAuth.
vi.mock("@/lib/auth", () => ({ auth: (handler: unknown) => handler }));

import { config } from "./middleware";

// O matcher é um padrão do path-to-regexp cujo grupo é uma regex JS comum.
const matches = (path: string): boolean =>
  config.matcher.some((m) => new RegExp(`^${m}$`).test(path));

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
