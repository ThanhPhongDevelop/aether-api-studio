/**
 * The landing page's full-bleed scene: the signal core above a platform that
 * catches its shadow, inside a drifting particle nebula. The camera follows the
 * pointer (parallax) and the page scroll (dolly and descent); bloom, depth of
 * field and a vignette finish the image. Quality steps down on slow devices.
 *
 * Loaded lazily so three.js and the post-processing stack stay out of the main bundle.
 */
import { Float, PerformanceMonitor } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, DepthOfField, EffectComposer, Vignette } from '@react-three/postprocessing';
import type { MotionValue } from 'framer-motion';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import { CoreLights, Crystal, Orbits, PulseWaves, StudioEnvironment } from './core-parts';
import { FLUX, ION } from './palette';
import type { CorePulse } from './types';

export interface HeroSceneProps {
  pulse: CorePulse | null;
  /** 0 while the hero fills the screen, 1 once it has scrolled out of view. */
  scroll: MotionValue<number>;
  theme: 'dark' | 'light';
  reducedMotion: boolean;
  onCoreClick?: () => void;
}

const THEMES = {
  dark: {
    background: '#070b1a',
    platform: '#121a3d',
    particlesA: ION,
    particlesB: FLUX,
    blending: THREE.AdditiveBlending,
    bloom: 0.85,
  },
  light: {
    background: '#eef1fa',
    platform: '#d7ddf2',
    particlesA: '#0379a0',
    particlesB: '#6d3fd6',
    blending: THREE.NormalBlending,
    bloom: 0.25,
  },
} as const;

// ─── Particle nebula ──────────────────────────────────────────────────────────

const particleVertex = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  attribute float aScale;
  attribute float aPhase;
  varying float vAlpha;
  varying float vMix;

  void main() {
    vec3 p = position;
    p.y += sin(uTime * 0.25 + aPhase * 6.2831) * 0.18;
    p.x += cos(uTime * 0.18 + aPhase * 12.566) * 0.12;
    vec4 view = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = uSize * aScale * uPixelRatio / -view.z;
    vAlpha = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 1.1 + aPhase * 40.0));
    vMix = aPhase;
  }
`;

const particleFragment = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  varying float vAlpha;
  varying float vMix;

  void main() {
    float distanceToCenter = length(gl_PointCoord - 0.5);
    if (distanceToCenter > 0.5) discard;
    float strength = pow(1.0 - distanceToCenter * 2.0, 1.8);
    gl_FragColor = vec4(mix(uColorA, uColorB, smoothstep(0.35, 0.95, vMix)), strength * vAlpha * uOpacity);
  }
`;

/** Small seeded PRNG (mulberry32): the same nebula on every render, and rendering stays pure. */
function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A flattened shell of points around the core: dense at middle distances, sparse far out. */
function createNebulaGeometry(count: number): THREE.BufferGeometry {
  const random = seededRandom(20261106);
  const positions = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const phases = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const radius = 3.2 + Math.pow(random(), 0.65) * 13;
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi) * 0.55;
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta) - 2;
    scales[i] = 0.4 + random() * 1.6;
    phases[i] = random();
  }
  const buffer = new THREE.BufferGeometry();
  buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  buffer.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
  buffer.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  return buffer;
}

function ParticleNebula({
  count,
  theme,
  scroll,
  reducedMotion,
}: {
  count: number;
  theme: 'dark' | 'light';
  scroll: MotionValue<number>;
  reducedMotion: boolean;
}) {
  const points = useRef<THREE.Points>(null);
  const pixelRatio = useThree((state) => state.viewport.dpr);
  const palette = THEMES[theme];

  const geometry = useMemo(() => createNebulaGeometry(count), [count]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: particleVertex,
        fragmentShader: particleFragment,
        transparent: true,
        depthWrite: false,
        blending: palette.blending,
        uniforms: {
          uTime: { value: 0 },
          uSize: { value: 26 },
          uPixelRatio: { value: pixelRatio },
          uOpacity: { value: theme === 'dark' ? 0.9 : 0.6 },
          uColorA: { value: new THREE.Color(palette.particlesA) },
          uColorB: { value: new THREE.Color(palette.particlesB) },
        },
      }),
    [palette, pixelRatio, theme],
  );

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame(({ clock }, delta) => {
    if (!points.current) return;
    // Uniforms are updated through the rendered object, never the memoised value.
    const shader = points.current.material as THREE.ShaderMaterial;
    if (!reducedMotion) shader.uniforms.uTime!.value = clock.elapsedTime;
    const progress = scroll.get();
    const spin = reducedMotion ? 0 : delta * 0.012;
    points.current.rotation.y += spin;
    points.current.rotation.x = THREE.MathUtils.damp(points.current.rotation.x, progress * 0.35, 3, delta);
  });

  return <points ref={points} geometry={geometry} material={material} />;
}

// ─── Platform that catches the core's shadow ──────────────────────────────────

function Platform({ theme, scroll }: { theme: 'dark' | 'light'; scroll: MotionValue<number> }) {
  const rings = useMemo(() => [1.6, 2.4, 3.2], []);
  const group = useRef<THREE.Group>(null);

  // Fades away with the hero so it never sits under the page content.
  useFrame(() => {
    const visibility = 1 - Math.min(1, scroll.get() * 1.6);
    group.current?.traverse((object) => {
      const material = (object as THREE.Mesh).material as THREE.Material & { userData: { baseOpacity?: number } };
      if (!material || Array.isArray(material)) return;
      material.userData.baseOpacity ??= material.opacity;
      material.opacity = material.userData.baseOpacity * visibility;
    });
    if (group.current) group.current.visible = visibility > 0.01;
  });

  return (
    <group ref={group} position={[0, -2.35, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh receiveShadow>
        <circleGeometry args={[3.6, 96]} />
        <meshStandardMaterial
          color={THEMES[theme].platform}
          roughness={0.92}
          metalness={0.15}
          transparent
          opacity={0.7}
        />
      </mesh>
      {rings.map((radius) => (
        <mesh key={radius} position={[0, 0, 0.002]}>
          <ringGeometry args={[radius - 0.006, radius, 128]} />
          <meshBasicMaterial color={ION} transparent opacity={theme === 'dark' ? 0.18 : 0.35} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Camera ───────────────────────────────────────────────────────────────────

function CameraRig({
  scroll,
  pointer,
  focus,
  reducedMotion,
}: {
  scroll: MotionValue<number>;
  pointer: RefObject<{ x: number; y: number }>;
  focus: THREE.Vector3;
  reducedMotion: boolean;
}) {
  const lookAt = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    const progress = scroll.get();
    const p = reducedMotion ? { x: 0, y: 0 } : pointer.current;
    const camera = state.camera;
    // Pointer parallax on top of a scroll-driven dolly: back and down as the page scrolls.
    camera.position.x = THREE.MathUtils.damp(camera.position.x, p.x * 0.6, 2.5, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, 0.55 + p.y * 0.35 + progress * 0.6, 2.5, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, 7.6 + progress * 5.5, 2.5, delta);
    // Look almost straight ahead (not at the core) so the core keeps its place beside the headline.
    lookAt.set(focus.x * 0.12, focus.y * 0.5 + progress * 0.7, focus.z);
    camera.lookAt(lookAt);
  });
  return null;
}

// ─── Scene ────────────────────────────────────────────────────────────────────

function Scene({
  pulse,
  scroll,
  theme,
  reducedMotion,
  onCoreClick,
  quality,
  pointer,
}: HeroSceneProps & { quality: 'high' | 'low'; pointer: RefObject<{ x: number; y: number }> }) {
  const aspect = useThree((state) => state.viewport.aspect);
  // Beside the headline on wide screens; centred behind it on narrow ones.
  const focus = useMemo(() => new THREE.Vector3(aspect > 1.15 ? 2.75 : 0, aspect > 1.15 ? 0 : 0.9, 0), [aspect]);
  const palette = THEMES[theme];
  const coreGroup = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!coreGroup.current) return;
    const progress = scroll.get();
    // As the hero scrolls away the core rises and drifts aside, making room for the content.
    coreGroup.current.position.x = THREE.MathUtils.damp(
      coreGroup.current.position.x,
      focus.x + progress * 0.5,
      4,
      delta,
    );
    coreGroup.current.position.y = THREE.MathUtils.damp(
      coreGroup.current.position.y,
      focus.y + progress * 1.8,
      4,
      delta,
    );
    coreGroup.current.rotation.y = THREE.MathUtils.damp(
      coreGroup.current.rotation.y,
      progress * Math.PI * 0.9,
      3,
      delta,
    );
  });

  return (
    <>
      <color attach="background" args={[palette.background]} />
      <fog attach="fog" args={[palette.background, 9, 26]} />
      <CoreLights reducedMotion={reducedMotion} />
      <spotLight
        position={[0.6, 6.5, 1.2]}
        angle={0.55}
        penumbra={0.85}
        intensity={theme === 'dark' ? 90 : 60}
        color="#dfe6ff"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
      />
      <StudioEnvironment />

      <group ref={coreGroup}>
        <Float
          speed={reducedMotion ? 0 : 1.2}
          rotationIntensity={reducedMotion ? 0 : 0.3}
          floatIntensity={reducedMotion ? 0 : 0.6}
        >
          <group scale={0.9}>
            <Crystal pulse={pulse} reducedMotion={reducedMotion} onClick={onCoreClick} castShadow />
            <Orbits reducedMotion={reducedMotion} />
          </group>
        </Float>
        {reducedMotion ? null : <PulseWaves pulse={pulse} />}
        <Platform theme={theme} scroll={scroll} />
      </group>

      <ParticleNebula
        count={quality === 'high' ? 2200 : 900}
        theme={theme}
        scroll={scroll}
        reducedMotion={reducedMotion}
      />
      <CameraRig scroll={scroll} pointer={pointer} focus={focus} reducedMotion={reducedMotion} />

      {/* Two fixed effect chains: depth of field is the first thing dropped on slower devices. */}
      {quality === 'high' ? (
        <EffectComposer multisampling={4} enableNormalPass={false}>
          <Bloom mipmapBlur luminanceThreshold={0.55} luminanceSmoothing={0.25} intensity={palette.bloom} />
          <DepthOfField
            target={focus.toArray() as [number, number, number]}
            focalLength={0.035}
            bokehScale={2.4}
            height={480}
          />
          <Vignette eskil={false} offset={0.2} darkness={theme === 'dark' ? 0.7 : 0.25} />
        </EffectComposer>
      ) : (
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <Bloom mipmapBlur luminanceThreshold={0.55} luminanceSmoothing={0.25} intensity={palette.bloom} />
          <Vignette eskil={false} offset={0.2} darkness={theme === 'dark' ? 0.7 : 0.25} />
        </EffectComposer>
      )}
    </>
  );
}

export default function HeroScene(props: HeroSceneProps) {
  const [quality, setQuality] = useState<'high' | 'low'>(() =>
    typeof window !== 'undefined' && (window.innerWidth < 768 || (navigator.hardwareConcurrency ?? 8) <= 4)
      ? 'low'
      : 'high',
  );
  const [dpr, setDpr] = useState(quality === 'high' ? 1.5 : 1);
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -((event.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  return (
    <Canvas
      shadows
      dpr={dpr}
      camera={{ position: [0, 0.55, 7.6], fov: 40, near: 0.1, far: 60 }}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
    >
      <PerformanceMonitor
        onDecline={() => {
          setQuality('low');
          setDpr(1);
        }}
        onIncline={() => setDpr(quality === 'high' ? 1.75 : 1.25)}
      />
      <Scene {...props} quality={quality} pointer={pointer} />
    </Canvas>
  );
}
