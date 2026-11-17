import { describe, expect, it } from "vitest"

import { fitWithin, MAX_PHOTO_SIDE } from "./watermark"

describe("fitWithin", () => {
  it("reduz a foto de 12 MP para o lado maior caber no limite", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: MAX_PHOTO_SIDE, height: 1440 })
    expect(fitWithin(3024, 4032)).toEqual({ width: 1440, height: MAX_PHOTO_SIDE })
  })

  it("não amplia foto menor que o limite", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 })
  })
})
