import { afterEach, describe, expect, it, vi } from "vitest";

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({ notFound }));
vi.mock("./_components/CarCalibrator", () => ({ CarCalibrator: () => null }));

import Car3DCalibrationPage from "./page";

describe("gate da tela de calibração", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    notFound.mockClear();
  });

  it("abre em dev mesmo sem NEXT_PUBLIC_ENABLE_DEV_TOOLS", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_DEV_TOOLS", "");
    expect(() => Car3DCalibrationPage()).not.toThrow();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("dá 404 em produção sem a env", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_DEV_TOOLS", "");
    expect(() => Car3DCalibrationPage()).toThrow("NEXT_NOT_FOUND");
  });

  it("abre em produção com a env = true", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_DEV_TOOLS", "true");
    expect(() => Car3DCalibrationPage()).not.toThrow();
  });
});
