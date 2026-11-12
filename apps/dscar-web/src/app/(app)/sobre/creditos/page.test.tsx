import { render, screen } from "@testing-library/react";
import { CAR_MODELS } from "@paddock/car-3d/core";
import { describe, expect, it } from "vitest";
import CreditsPage from "./page";

describe("página de créditos", () => {
  it("lista os modelos 3D reais com título, autor, licença e link; os provisórios não", () => {
    render(<CreditsPage />);
    const real = CAR_MODELS.filter((m) => m.license !== "PLACEHOLDER");
    expect(real.length).toBeGreaterThan(0);
    for (const m of real) {
      const row = screen.getByText(m.title).closest("li");
      expect(row, m.key).not.toBeNull();
      expect(row?.textContent).toContain(m.author);
      expect(row?.querySelector(`a[href="${m.sourceUrl}"]`)).not.toBeNull();
    }
    expect(screen.getAllByText("CC BY-NC-SA 4.0").length).toBeGreaterThan(0);
    expect(screen.getByText("CC BY 4.0").getAttribute("href")).toBe("https://creativecommons.org/licenses/by/4.0/");
    expect(screen.getAllByText("CC BY-NC-SA 4.0")[0]?.getAttribute("href")).toBe("https://creativecommons.org/licenses/by-nc-sa/4.0/");
    expect(screen.getByText(/interior mantido/).closest("li")?.textContent).toContain("chevrolet onix");
    expect(screen.queryByText(/provisório/)).toBeNull();
  });
});
