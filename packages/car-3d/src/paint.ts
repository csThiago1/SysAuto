import { Color, Mesh, type Material, type Object3D } from "three";

type Paintable = Material & { color: Color };

function isPaintable(m: Material): m is Paintable {
  return "color" in m && m.color instanceof Color;
}

/**
 * Clona os materiais de lataria (por nome) e troca a cor. Clona para não alterar o
 * material compartilhado no cache do GLTF. Devolve os clones (para o shader de destaque).
 */
export function applyPaint(scene: Object3D, paintMaterials: string[], color: string): Paintable[] {
  const names = new Set(paintMaterials);
  const clones = new Map<Material, Paintable>();
  const paint = (m: Material): Material => {
    if (!names.has(m.name) || !isPaintable(m)) return m;
    let clone = clones.get(m);
    if (!clone) {
      clone = m.clone() as Paintable;
      clone.color.set(color);
      clones.set(m, clone);
    }
    return clone;
  };
  scene.traverse((obj) => {
    if (obj instanceof Mesh) {
      obj.material = Array.isArray(obj.material) ? obj.material.map(paint) : paint(obj.material);
    }
  });
  return [...clones.values()];
}
