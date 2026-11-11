/**
 * The interactive signal core used beside forms and on the status screens:
 * drag to rotate, zoom when engaged, click the crystal to send a request.
 *
 * Loaded lazily (see CoreStage) so three.js stays out of the main bundle.
 */
import { Float, OrbitControls, PerformanceMonitor } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useState } from 'react';
import { CoreLights, Crystal, Orbits, PulseWaves, StudioEnvironment } from './core-parts';
import type { CorePulse } from './types';

interface SignalCoreProps {
  pulse: CorePulse | null;
  reducedMotion: boolean;
  /** Mouse-wheel / pinch zoom (only while the person is engaged with the scene). */
  zoomEnabled: boolean;
  /** Mount orbit controls (off on touch screens until tapped, so page scrolling keeps working). */
  controlsEnabled: boolean;
  onCoreClick?: () => void;
}

export default function SignalCore({
  pulse,
  reducedMotion,
  zoomEnabled,
  controlsEnabled,
  onCoreClick,
}: SignalCoreProps) {
  const [dpr, setDpr] = useState(1.5);

  return (
    <Canvas
      dpr={dpr}
      camera={{ position: [0, 0.35, 6.9], fov: 38 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
    >
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.75)} />
      <CoreLights reducedMotion={reducedMotion} />

      <Float
        speed={reducedMotion ? 0 : 1.3}
        rotationIntensity={reducedMotion ? 0 : 0.35}
        floatIntensity={reducedMotion ? 0 : 0.7}
      >
        <group scale={0.86}>
          <Crystal pulse={pulse} reducedMotion={reducedMotion} onClick={onCoreClick} />
          <Orbits reducedMotion={reducedMotion} />
        </group>
      </Float>
      {/* With reduced motion the core still glows on each response, but no rings expand. */}
      {reducedMotion ? null : <PulseWaves pulse={pulse} />}

      <StudioEnvironment />

      {controlsEnabled ? (
        <OrbitControls
          enablePan={false}
          enableZoom={zoomEnabled}
          minDistance={4.2}
          maxDistance={10}
          autoRotate={!reducedMotion}
          autoRotateSpeed={0.45}
          enableDamping
          dampingFactor={0.08}
        />
      ) : null}
    </Canvas>
  );
}
