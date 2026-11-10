"use client";

import { OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import {
  forwardRef,
  Suspense,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type ComponentRef,
  type JSX,
  type MutableRefObject,
} from "react";
import { Box3, CanvasTexture, PerspectiveCamera, SRGBColorSpace, Vector3 } from "three";
import { poseFor } from "./cameras";
import { buildHighlightUniforms } from "./highlight";
import { applyPaint } from "./paint";
import type { CameraView, PanelKey } from "./panels";
import { createRegionUniforms, patchRegionHighlight, setRegionUniforms } from "./regionShader";
import { panelAt, type Regions, type Vec3 } from "./regions";

export type Car3DHandle = { snapshot(view: CameraView): Promise<string> }; // data URL PNG 1200×900

export type Car3DProps = {
  modelUrl: string;
  regions: Regions;
  color: string; // hex da lataria
  highlights?: { panel: PanelKey; color: string }[];
  pins?: { number: number; point: Vec3; color: string }[];
  view?: CameraView; // anima a câmera até a vista
  autoRotate?: boolean;
  showRegions?: boolean; // wireframe das caixas (calibração)
  onPanelTap?: (panel: PanelKey | null, point: Vec3) => void;
  className?: string;
};

const SNAPSHOT_W = 1200;
const SNAPSHOT_H = 900;
const TAP_SLOP_PX = 6;
const BRAND_PURPLE = "#ac27ce";

type Controls = ComponentRef<typeof OrbitControls>;
type SnapshotFn = (view: CameraView) => Promise<string>;

function Platform({ bbox }: { bbox: Box3 }): JSX.Element {
  const center = bbox.getCenter(new Vector3());
  const size = bbox.getSize(new Vector3());
  const r = Math.max(size.x, size.z) * 0.62;
  return (
    <group position={[center.x, bbox.min.y - 0.002 * r, center.z]} rotation-x={-Math.PI / 2}>
      <mesh>
        <circleGeometry args={[r, 96]} />
        <meshStandardMaterial color="#141414" transparent opacity={0.85} />
      </mesh>
      <mesh position-z={0.001 * r}>
        <ringGeometry args={[r * 0.975, r, 96]} />
        <meshBasicMaterial color={BRAND_PURPLE} />
      </mesh>
    </group>
  );
}

/** Marcador numerado desenhado num canvas 2D: entra no snapshot (um <Html> não entraria). */
function Pin({ number, color, position, scale }: { number: number; color: string; position: Vec3; scale: number }): JSX.Element {
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.beginPath();
      ctx.arc(64, 64, 56, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 8;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      ctx.fillStyle = "#111111";
      ctx.font = "bold 64px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(number), 64, 68);
    }
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    return t;
  }, [number, color]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite position={position} scale={scale} renderOrder={10}>
      <spriteMaterial map={texture} depthWrite={false} />
    </sprite>
  );
}

function RegionBoxes({ regions }: { regions: Regions }): JSX.Element {
  return (
    <>
      {Object.entries(regions.panels).flatMap(([key, boxes]) =>
        (boxes ?? []).map((box, i) => (
          <mesh key={`${key}-${i}`} position={box.center} rotation-y={box.rotationY ?? 0}>
            <boxGeometry args={box.size} />
            <meshBasicMaterial color="#00e5ff" wireframe />
          </mesh>
        )),
      )}
    </>
  );
}

type SceneProps = Omit<Car3DProps, "className"> & { snapRef: MutableRefObject<SnapshotFn | null> };

function Scene({
  modelUrl,
  regions,
  color,
  highlights,
  pins,
  view,
  autoRotate,
  showRegions,
  onPanelTap,
  snapRef,
}: SceneProps): JSX.Element {
  const gltf = useGLTF(modelUrl);
  const { gl, camera, scene: root, size } = useThree();
  const controls = useRef<Controls>(null);
  const goal = useRef<{ position: Vector3; target: Vector3 } | null>(null);
  const down = useRef<{ x: number; y: number; point: Vec3 } | null>(null);

  // cópia própria: o cache do useGLTF é compartilhado entre instâncias
  const model = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const bbox = useMemo(() => new Box3().setFromObject(model), [model]);
  const uniforms = useMemo(() => createRegionUniforms(), []);

  // chave em string: um `regions` recriado a cada render não reclona os materiais
  const paintKey = regions.paintMaterials.join("\n");
  const painted = useMemo(() => {
    const mats = applyPaint(model, paintKey ? paintKey.split("\n") : [], color);
    for (const m of mats) patchRegionHighlight(m, uniforms);
    return mats;
  }, [model, paintKey, color, uniforms]);
  useEffect(() => () => painted.forEach((m) => m.dispose()), [painted]);

  useEffect(() => {
    setRegionUniforms(uniforms, buildHighlightUniforms(highlights ?? [], regions));
  }, [uniforms, highlights, regions]);

  // primeira pose sem animação; depois, cada troca de `view` anima até a nova vista
  const placed = useRef(false);
  useEffect(() => {
    const target = view && view !== "free" ? view : placed.current ? null : "front34";
    if (!target) return;
    const pose = poseFor(target, bbox);
    const next = { position: new Vector3(...pose.position), target: new Vector3(...pose.target) };
    if (placed.current) {
      goal.current = next;
    } else {
      camera.position.copy(next.position);
      controls.current?.target.copy(next.target);
      camera.lookAt(next.target);
      controls.current?.update();
      placed.current = true;
    }
  }, [view, bbox, camera]);

  useFrame((_, delta) => {
    const g = goal.current;
    const c = controls.current;
    if (!g || !c) return;
    const k = 1 - Math.exp(-delta * 6);
    camera.position.lerp(g.position, k);
    c.target.lerp(g.target, k);
    c.update();
    if (camera.position.distanceTo(g.position) < 1e-3 * bbox.getSize(new Vector3()).length()) goal.current = null;
  });

  useEffect(() => {
    snapRef.current = async (snapView) => {
      if (!(camera instanceof PerspectiveCamera)) throw new Error("car-3d: snapshot exige câmera perspectiva");
      const saved = { position: camera.position.clone(), aspect: camera.aspect, ratio: gl.getPixelRatio() };
      const savedTarget = controls.current?.target.clone();
      try {
        if (snapView !== "free") {
          const pose = poseFor(snapView, bbox);
          camera.position.set(...pose.position);
          camera.lookAt(...pose.target);
        }
        camera.aspect = SNAPSHOT_W / SNAPSHOT_H;
        camera.updateProjectionMatrix();
        gl.setPixelRatio(1);
        gl.setSize(SNAPSHOT_W, SNAPSHOT_H, false);
        gl.render(root, camera);
        return gl.domElement.toDataURL("image/png");
      } finally {
        camera.position.copy(saved.position);
        camera.aspect = saved.aspect;
        camera.updateProjectionMatrix();
        if (savedTarget) camera.lookAt(savedTarget);
        gl.setPixelRatio(saved.ratio);
        gl.setSize(size.width, size.height, false);
      }
    };
    return () => {
      snapRef.current = null;
    };
  }, [snapRef, camera, gl, root, size, bbox]);

  const toModel = (e: ThreeEvent<PointerEvent>): Vec3 => {
    const p = model.worldToLocal(e.point.clone());
    return [p.x, p.y, p.z];
  };
  const handleDown = (e: ThreeEvent<PointerEvent>): void => {
    e.stopPropagation();
    down.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, point: toModel(e) };
  };
  const handleUp = (e: ThreeEvent<PointerEvent>): void => {
    e.stopPropagation();
    const d = down.current;
    down.current = null;
    // arrastar (girar a câmera) não conta como toque
    if (!d || Math.hypot(e.nativeEvent.clientX - d.x, e.nativeEvent.clientY - d.y) > TAP_SLOP_PX) return;
    onPanelTap?.(panelAt(d.point, regions), d.point);
  };

  const bboxCenter = bbox.getCenter(new Vector3());
  const pinSize = bbox.getSize(new Vector3()).length() * 0.012;
  return (
    <>
      <primitive object={model} onPointerDown={handleDown} onPointerUp={handleUp} />
      <Platform bbox={bbox} />
      {showRegions && <RegionBoxes regions={regions} />}
      {(pins ?? []).map((pin) => {
        // empurra o marcador para fora da lataria, a partir do centro do carro
        const p = new Vector3(...pin.point).sub(bboxCenter).setLength(pinSize).add(new Vector3(...pin.point));
        return <Pin key={pin.number} number={pin.number} color={pin.color} position={[p.x, p.y, p.z]} scale={pinSize * 4} />;
      })}
      <OrbitControls
        ref={controls}
        makeDefault
        enablePan={false}
        autoRotate={autoRotate}
        autoRotateSpeed={1.2}
        onStart={() => {
          goal.current = null; // o usuário pegou a câmera: para a animação
        }}
      />
    </>
  );
}

export const Car3D = forwardRef<Car3DHandle, Car3DProps>(function Car3D({ className, ...props }, ref) {
  const snapRef = useRef<SnapshotFn | null>(null);
  useImperativeHandle(ref, () => ({
    snapshot: (view) =>
      snapRef.current ? snapRef.current(view) : Promise.reject(new Error("car-3d: modelo ainda não carregou")),
  }));
  return (
    <div className={className}>
      <Canvas gl={{ preserveDrawingBuffer: true, alpha: true }} camera={{ fov: 35, near: 0.05, far: 200 }} dpr={[1, 2]}>
        <ambientLight intensity={0.55} />
        <hemisphereLight args={["#ffffff", "#303030", 0.6]} />
        <directionalLight position={[5, 8, 6]} intensity={1.4} />
        <directionalLight position={[-6, 4, -5]} intensity={0.6} />
        <Suspense fallback={null}>
          <Scene {...props} snapRef={snapRef} />
        </Suspense>
      </Canvas>
    </div>
  );
});
