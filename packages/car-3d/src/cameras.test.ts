import { Box3, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { poseFor } from "./cameras";

// carro de 4 m de comprimento (z), 1,8 m de largura (x), 1,5 m de altura, centro fora da origem
const bbox = new Box3(new Vector3(-0.9, 0, -2), new Vector3(0.9, 1.5, 2)).translate(new Vector3(1, 0, 3));
const center: [number, number, number] = [1, 0.75, 3];

describe("poseFor", () => {
  // convenção glTF (destro, y para cima, frente = +z): esquerda do carro = +x
  it("left: câmera em x > centro (lado esquerdo = +x) olhando para o centro do bbox", () => {
    const { position, target } = poseFor("left", bbox);
    expect(position[0]).toBeGreaterThan(center[0]);
    expect(position[2]).toBeCloseTo(center[2]);
    expect(target).toEqual(center);
  });

  it("right: câmera em x < centro (lado direito = -x)", () => {
    const { position } = poseFor("right", bbox);
    expect(position[0]).toBeLessThan(center[0]);
    expect(position[2]).toBeCloseTo(center[2]);
  });

  it("rear34: traseira-direita, câmera com z < centro e x < centro", () => {
    const { position } = poseFor("rear34", bbox);
    expect(position[0]).toBeLessThan(center[0]);
    expect(position[2]).toBeLessThan(center[2]);
  });

  it("front34: frente-esquerda (lado do motorista), câmera com z > 0 e x > 0", () => {
    const { position } = poseFor("front34", bbox);
    expect(position[0]).toBeGreaterThan(center[0]);
    expect(position[2]).toBeGreaterThan(center[2]);
    expect(position[0]).toBeGreaterThan(0);
    expect(position[2]).toBeGreaterThan(0);
  });

  it("escala pelo comprimento do carro", () => {
    const small = new Box3(new Vector3(-0.225, 0, -0.5), new Vector3(0.225, 0.375, 0.5));
    const big = poseFor("front", bbox);
    const ref = poseFor("front", small);
    expect(big.position[2] - center[2]).toBeCloseTo((ref.position[2] - ref.target[2]) * 4);
  });
});
