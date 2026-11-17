import type { Material } from "three";
import { MAX_HIGHLIGHT_BOXES, type HighlightUniforms } from "./highlight";

export type RegionShaderUniforms = {
  uHlCenters: { value: Float32Array };
  uHlSizes: { value: Float32Array };
  uHlRotY: { value: Float32Array };
  uHlColors: { value: Float32Array };
  uHlCount: { value: number };
};

const N = MAX_HIGHLIGHT_BOXES;

/** Uniforms compartilhados por todos os materiais de lataria (nada aceso); atualizar com setRegionUniforms. */
export function createRegionUniforms(): RegionShaderUniforms {
  return {
    uHlCenters: { value: new Float32Array(N * 3) },
    uHlSizes: { value: new Float32Array(N * 3) },
    uHlRotY: { value: new Float32Array(N) },
    uHlColors: { value: new Float32Array(N * 3) },
    uHlCount: { value: 0 },
  };
}

export function setRegionUniforms(u: RegionShaderUniforms, h: HighlightUniforms): void {
  u.uHlCenters.value = h.centers;
  u.uHlSizes.value = h.sizes;
  u.uHlRotY.value = h.rotY;
  u.uHlColors.value = h.colors;
  u.uHlCount.value = h.count;
}

// ponytail: vModelPos usa modelMatrix (mundo) porque a raiz do modelo não é transformada no
// Car3D (mundo = espaço do modelo). Se um dia a raiz for movida, passar o inverso dela aqui.
const VERT_DECL = "#include <common>\nvarying vec3 vModelPos;";
const VERT_BODY = "#include <project_vertex>\nvModelPos = (modelMatrix * vec4(transformed, 1.0)).xyz;";

const FRAG_DECL = `#include <common>
varying vec3 vModelPos;
uniform vec3 uHlCenters[${N}];
uniform vec3 uHlSizes[${N}];
uniform float uHlRotY[${N}];
uniform vec3 uHlColors[${N}];
uniform int uHlCount;`;

// mesmo teste de regions.ts/contains: gira o ponto por -rotationY em torno do centro da caixa
const FRAG_BODY = `#include <color_fragment>
for (int i = 0; i < ${N}; i++) {
  if (i >= uHlCount) break;
  vec3 d = vModelPos - uHlCenters[i];
  float c = cos(uHlRotY[i]);
  float s = sin(uHlRotY[i]);
  vec3 l = vec3(d.x * c - d.z * s, d.y, d.x * s + d.z * c);
  if (all(lessThanEqual(abs(l), uHlSizes[i] * 0.5))) {
    diffuseColor.rgb = mix(diffuseColor.rgb, uHlColors[i], 0.6);
    break;
  }
}`;

/** Acende na cor do volume (60%) os fragmentos da lataria dentro de alguma das `count` caixas. */
export function patchRegionHighlight(material: Material, uniforms: RegionShaderUniforms): void {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", VERT_DECL)
      .replace("#include <project_vertex>", VERT_BODY);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", FRAG_DECL)
      .replace("#include <color_fragment>", FRAG_BODY);
  };
  material.needsUpdate = true;
}
