/**
 * Building blocks of the Aether "signal core": an iridescent crystal (thin-film
 * interference — light behaving in a medium) inside a wireframe lattice, with
 * requests orbiting as packets. Every real API response makes the core glow and
 * emit a wave in the colour of its status class (green 2xx, amber 4xx, rose 5xx).
 *
 * Shared by the interactive stage (SignalCore) and the landing hero (HeroScene).
 */
import { Billboard, Environment, Lightformer, useCursor } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { FLUX, ION } from './palette';
import type { CorePulse } from './types';

const GLOW_SECONDS = 1.1;
const WAVE_SECONDS = 1.5;
const ECHO_DELAY = 0.22;
/** Two rings per pulse (wave + echo), room for three overlapping pulses. */
const WAVE_POOL = 6;

export function CoreLights({ reducedMotion }: { reducedMotion: boolean }) {
  const ion = useRef<THREE.PointLight>(null);
  const flux = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const t = clock.elapsedTime * 0.35;
    ion.current?.position.set(Math.cos(t) * 4.2, 2.2, Math.sin(t) * 4.2);
    flux.current?.position.set(Math.cos(t + Math.PI) * 4.2, -1.6, Math.sin(t + Math.PI) * 4.2);
  });

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[3, 5, 4]} intensity={1.2} />
      <pointLight ref={ion} color={ION} intensity={22} distance={14} position={[4.2, 2.2, 0]} />
      <pointLight ref={flux} color={FLUX} intensity={18} distance={14} position={[-4.2, -1.6, 0]} />
    </>
  );
}

interface CrystalProps {
  pulse: CorePulse | null;
  reducedMotion: boolean;
  onClick?: () => void;
  /** Cast shadows onto receiving surfaces (the hero's platform). */
  castShadow?: boolean;
}

export function Crystal({ pulse, reducedMotion, onClick, castShadow = false }: CrystalProps) {
  const core = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshPhysicalMaterial>(null);
  const lattice = useRef<THREE.LineSegments>(null);
  // Animations start on the next frame actually drawn, never at the possibly stale
  // clock time of the last frame (a busy main thread or hidden tab would skip them).
  const glow = useRef({ pending: false, startedAt: Number.NEGATIVE_INFINITY });
  const [hovered, setHovered] = useState(false);
  useCursor(hovered && Boolean(onClick));

  const latticeGeometry = useMemo(() => new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.8, 1)), []);
  useEffect(() => () => latticeGeometry.dispose(), [latticeGeometry]);

  useEffect(() => {
    if (!pulse) return;
    glow.current.pending = true;
    material.current?.emissive.set(pulse.color);
  }, [pulse]);

  useFrame(({ clock }, delta) => {
    if (!core.current || !lattice.current || !material.current) return;
    if (!reducedMotion) {
      core.current.rotation.y += delta * 0.22;
      core.current.rotation.x += delta * 0.06;
      lattice.current.rotation.y -= delta * 0.1;
      lattice.current.rotation.z += delta * 0.04;
    }
    core.current.scale.setScalar(THREE.MathUtils.damp(core.current.scale.x, hovered ? 1.08 : 1, 8, delta));

    if (glow.current.pending) {
      glow.current.pending = false;
      glow.current.startedAt = clock.elapsedTime;
    }
    const t = (clock.elapsedTime - glow.current.startedAt) / GLOW_SECONDS;
    material.current.emissiveIntensity = t >= 0 && t <= 1 ? (1 - t) ** 2 * 0.7 : 0;
  });

  return (
    <group>
      <mesh
        ref={core}
        castShadow={castShadow}
        onClick={(event) => {
          event.stopPropagation();
          onClick?.();
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <icosahedronGeometry args={[1.12, 1]} />
        <meshPhysicalMaterial
          ref={material}
          color="#c3cdff"
          emissive="#000000"
          emissiveIntensity={0}
          metalness={0.55}
          roughness={0.14}
          clearcoat={1}
          clearcoatRoughness={0.08}
          iridescence={1}
          iridescenceIOR={1.7}
          iridescenceThicknessMinimum={160}
          iridescenceThicknessMaximum={560}
          envMapIntensity={1.5}
          flatShading
        />
      </mesh>
      <lineSegments ref={lattice} geometry={latticeGeometry}>
        <lineBasicMaterial color={ION} transparent opacity={0.28} />
      </lineSegments>
    </group>
  );
}

const ORBITS: { radius: number; tilt: [number, number, number]; speed: number; color: string }[] = [
  { radius: 2.35, tilt: [1.25, 0.15, 0], speed: 0.7, color: ION },
  { radius: 2.75, tilt: [1.95, -0.45, 0.5], speed: -0.45, color: FLUX },
  { radius: 2.95, tilt: [0.55, 0.6, -0.3], speed: 0.3, color: '#e8ecff' },
];

export function Orbits({ reducedMotion }: { reducedMotion: boolean }) {
  const carriers = useRef<(THREE.Group | null)[]>([]);

  useFrame((_, delta) => {
    if (reducedMotion) return;
    carriers.current.forEach((carrier, index) => {
      if (carrier) carrier.rotation.z += delta * (ORBITS[index]?.speed ?? 0);
    });
  });

  return ORBITS.map((orbit, index) => (
    <group key={orbit.radius} rotation={orbit.tilt}>
      <mesh>
        <torusGeometry args={[orbit.radius, 0.0075, 6, 192]} />
        <meshBasicMaterial color={orbit.color} transparent opacity={0.22} />
      </mesh>
      <group
        ref={(group) => {
          carriers.current[index] = group;
        }}
        rotation={[0, 0, index * 2.1]}
      >
        <mesh position={[orbit.radius, 0, 0]}>
          <sphereGeometry args={[0.055, 16, 16]} />
          <meshBasicMaterial color={orbit.color} toneMapped={false} />
        </mesh>
      </group>
    </group>
  ));
}

/** Expanding rings (a wave and its echo) from a reused pool — no allocations per response. */
export function PulseWaves({ pulse }: { pulse: CorePulse | null }) {
  const rings = useRef<(THREE.Mesh | null)[]>([]);
  const startedAt = useRef<number[]>(Array.from({ length: WAVE_POOL }, () => Number.NEGATIVE_INFINITY));
  const pendingDelay = useRef<(number | null)[]>(Array.from({ length: WAVE_POOL }, () => null));
  const strength = useRef<number[]>(Array.from({ length: WAVE_POOL }, () => 1));
  const nextSlot = useRef(0);

  useEffect(() => {
    if (!pulse) return;
    [
      { delay: 0, intensity: 0.95 },
      { delay: ECHO_DELAY, intensity: 0.5 },
    ].forEach(({ delay, intensity }) => {
      const slot = nextSlot.current % WAVE_POOL;
      nextSlot.current += 1;
      pendingDelay.current[slot] = delay;
      strength.current[slot] = intensity;
      const ring = rings.current[slot];
      if (ring) (ring.material as THREE.MeshBasicMaterial).color.set(pulse.color);
    });
  }, [pulse]);

  useFrame(({ clock }) => {
    rings.current.forEach((ring, slot) => {
      if (!ring) return;
      const delay = pendingDelay.current[slot];
      if (delay !== null && delay !== undefined) {
        pendingDelay.current[slot] = null;
        startedAt.current[slot] = clock.elapsedTime + delay;
      }

      const progress = (clock.elapsedTime - (startedAt.current[slot] ?? Number.NEGATIVE_INFINITY)) / WAVE_SECONDS;
      if (progress < 0 || progress > 1) {
        ring.visible = false;
        return;
      }
      // Grow from just outside the crystal to the lattice edge, staying inside the view.
      const eased = 1 - (1 - progress) ** 2;
      const fade = progress < 0.12 ? progress / 0.12 : (1 - (progress - 0.12) / 0.88) ** 1.5;
      ring.visible = true;
      ring.scale.setScalar(1.05 + eased * 1.25);
      (ring.material as THREE.MeshBasicMaterial).opacity = fade * (strength.current[slot] ?? 1);
    });
  });

  return (
    <Billboard>
      {Array.from({ length: WAVE_POOL }, (_, slot) => (
        <mesh
          key={slot}
          visible={false}
          ref={(mesh) => {
            rings.current[slot] = mesh;
          }}
        >
          <ringGeometry args={[0.965, 1, 160]} />
          <meshBasicMaterial transparent opacity={0} toneMapped={false} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </Billboard>
  );
}

/** Procedural studio lighting for reflections — no HDR download needed. */
export function StudioEnvironment() {
  return (
    <Environment resolution={256} frames={1}>
      <Lightformer form="rect" intensity={3} color={ION} position={[3, 2, 4]} scale={[4, 2, 1]} target={[0, 0, 0]} />
      <Lightformer
        form="rect"
        intensity={2.4}
        color={FLUX}
        position={[-4, -1, 3]}
        scale={[4, 3, 1]}
        target={[0, 0, 0]}
      />
      <Lightformer form="ring" intensity={2} color="#ffffff" position={[0, 4, -3]} scale={3} target={[0, 0, 0]} />
      <Lightformer
        form="rect"
        intensity={1.4}
        color="#ff8ad8"
        position={[0, -4, 2]}
        scale={[6, 1, 1]}
        target={[0, 0, 0]}
      />
    </Environment>
  );
}
