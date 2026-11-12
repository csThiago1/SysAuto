'use dom';

import { Component, type JSX, type ReactNode } from 'react';
import { Car3D, type CameraView, type PanelKey, type Regions, type Vec3 } from '@paddock/car-3d';

// Roda num Expo DOM component (webview): o único lugar do mobile que importa o <Car3D> (three/fiber/drei).
// O resto do app importa @paddock/car-3d/core. Props precisam ser serializáveis; funções são assíncronas.

interface Props {
  /** `data:model/gltf-binary;base64,…` (o DOM component não lê file://, ver spike da Task 1). */
  modelUri: string;
  regions: Regions;
  color: string;
  highlights: { panel: PanelKey; color: string }[];
  view: CameraView;
  /** Peças tocáveis desta parada; toque fora delas é ignorado. */
  panels: PanelKey[];
  onPanelTap: (panel: PanelKey, point: Vec3) => Promise<void>;
  onError: (message: string) => Promise<void>;
  dom?: import('expo/dom').DOMProps;
}

class LoadBoundary extends Component<{ children: ReactNode; onError: (msg: string) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  componentDidCatch(error: unknown): void {
    this.props.onError(error instanceof Error ? error.message : String(error));
  }
  render(): ReactNode {
    return this.state.failed ? <p className="car3d-error">3D indisponível. Use a lista de peças.</p> : this.props.children;
  }
}

const CSS =
  'html,body{margin:0;height:100%;background:transparent;overflow:hidden}' +
  '.car3d{width:100vw;height:100vh}' +
  '.car3d-error{margin:0;padding:16px;color:#9ca3af;font:14px -apple-system,sans-serif;text-align:center}';

export default function Car3DDom({ modelUri, regions, color, highlights, view, panels, onPanelTap, onError }: Props): JSX.Element {
  return (
    <>
      <style>{CSS}</style>
      <LoadBoundary onError={(msg) => void onError(msg)}>
        <Car3D
          modelUrl={modelUri}
          regions={regions}
          color={color}
          highlights={highlights}
          view={view}
          className="car3d"
          onPanelTap={(panel, point) => {
            if (panel && panels.includes(panel)) void onPanelTap(panel, point);
          }}
        />
      </LoadBoundary>
    </>
  );
}
