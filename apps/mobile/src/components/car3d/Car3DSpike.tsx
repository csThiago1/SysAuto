'use dom';

import { Component, Suspense, useRef, useState, type JSX, type ReactNode } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import type { Mesh } from 'three';

// Spike (Task 1): prova que R3F roda num Expo DOM component no iOS e que o .glb
// local carrega. O componente definitivo é o Car3DDom (Task 19).

interface Props {
  modelUri: string;
  onTap: (name: string) => Promise<void>;
  dom?: import('expo/dom').DOMProps;
}

function SpinningCube(): JSX.Element {
  const ref = useRef<Mesh>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta;
  });
  return (
    <mesh ref={ref} position={[0, 2.6, 0]}>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial color="#ea0e03" />
    </mesh>
  );
}

function Model({ uri, onTap }: { uri: string; onTap: (name: string) => Promise<void> }): JSX.Element {
  const { scene } = useGLTF(uri);
  const handleClick = (e: ThreeEvent<MouseEvent>): void => {
    e.stopPropagation();
    void onTap(e.object.name);
  };
  return <primitive object={scene} onClick={handleClick} />;
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
    return this.state.failed ? null : this.props.children;
  }
}

export default function Car3DSpike({ modelUri, onTap }: Props): JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const scheme = modelUri.slice(0, modelUri.indexOf(':'));
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#1a1a1a', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 8, left: 8, color: '#fff', font: '14px sans-serif', zIndex: 1 }}>
        {scheme}: {error ? `ERRO ${error}` : 'ok'}
      </div>
      <Canvas camera={{ position: [5, 3, 5], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 8, 5]} intensity={1.2} />
        <SpinningCube />
        <LoadBoundary
          onError={(msg) => {
            setError(msg);
            void onTap(`load-error:${msg}`);
          }}
        >
          <Suspense fallback={null}>
            <Model uri={modelUri} onTap={onTap} />
          </Suspense>
        </LoadBoundary>
        <OrbitControls />
      </Canvas>
    </div>
  );
}
