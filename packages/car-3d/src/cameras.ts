import { Vector3, type Box3 } from "three";
import type { CameraView } from "./panels";
import type { Vec3 } from "./regions";

export type CameraPose = { position: Vec3; target: Vec3 };

/**
 * Poses para um carro de comprimento 1 centrado na origem (convenção do regions.json:
 * frente = +z, lado esquerdo = -x, y para cima). poseFor escala pelo bbox do modelo.
 */
export const CAMERA_POSES: Record<Exclude<CameraView, "free">, CameraPose> = {
  front: { position: [0, 0.2, 1.3], target: [0, 0, 0] },
  rear: { position: [0, 0.2, -1.3], target: [0, 0, 0] },
  left: { position: [-1.4, 0.15, 0], target: [0, 0, 0] },
  right: { position: [1.4, 0.15, 0], target: [0, 0, 0] },
  top: { position: [0, 1.6, 0.001], target: [0, 0, 0] },
  front34: { position: [0.9, 0.45, 0.95], target: [0, 0, 0] },
  rear34: { position: [-0.9, 0.45, -0.95], target: [0, 0, 0] },
};

export function poseFor(view: Exclude<CameraView, "free">, bbox: Box3): CameraPose {
  const center = bbox.getCenter(new Vector3());
  const size = bbox.getSize(new Vector3());
  const length = Math.max(size.x, size.y, size.z) || 1;
  const at = ([x, y, z]: Vec3): Vec3 => [center.x + x * length, center.y + y * length, center.z + z * length];
  const pose = CAMERA_POSES[view];
  return { position: at(pose.position), target: at(pose.target) };
}
