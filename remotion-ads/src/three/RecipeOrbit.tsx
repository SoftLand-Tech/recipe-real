import React, { Suspense, useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { useTexture } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { staticFile } from "remotion";
import { C, EASE, FOODS, mulberry32 } from "../theme";

/**
 * Shot 2's hero: an endless-feeling ring of real recipe cards rotating in 3D —
 * the reference's "wall of content" move, built with real perspective + fog.
 * Rotation is driven purely by useCurrentFrame().
 */

const RingCards: React.FC<{ count: number; radius: number; cardW: number; cardH: number }> = ({
  count,
  radius,
  cardW,
  cardH,
}) => {
  const frame = useCurrentFrame();
  const rand = useMemo(() => {
    const r = mulberry32(42);
    return new Array(count).fill(0).map(() => ({ yJitter: (r() - 0.5) * 1.6, bobPhase: r() * Math.PI * 2, tilt: (r() - 0.5) * 0.16 }));
  }, [count]);

  // The files cycle through the 18 downloaded photos.
  const files = useMemo(() => new Array(count).fill(0).map((_, i) => staticFile(`food/${FOODS[i % FOODS.length].file}`)), [count]);
  const textures = useTexture(files);
  const prepared = useMemo(() => {
    textures.forEach((t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
    });
    return textures;
  }, [textures]);

  const ringRotation = frame * 0.0042;

  return (
    <group rotation={[0, ringRotation, 0]}>
      {prepared.map((texture, i) => {
        const angle = (i / count) * Math.PI * 2;
        const x = Math.sin(angle) * radius;
        const z = Math.cos(angle) * radius;
        const bob = Math.sin(frame / 34 + rand[i].bobPhase) * 0.09;
        return (
          <mesh
            key={i}
            position={[x, rand[i].yJitter + bob, z]}
            rotation={[rand[i].tilt, angle, rand[i].tilt * 0.7]}
          >
            <planeGeometry args={[cardW, cardH]} />
            <meshBasicMaterial map={texture} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
};

/** Soft terracotta glow planes behind the ring. */
const GlowDots: React.FC = () => {
  const frame = useCurrentFrame();
  const rand = useMemo(() => {
    const r = mulberry32(11);
    return new Array(26).fill(0).map(() => ({
      x: (r() - 0.5) * 16,
      y: (r() - 0.5) * 8,
      z: (r() - 0.5) * 10 - 2,
      s: 0.05 + r() * 0.12,
      phase: r() * Math.PI * 2,
      warm: r() > 0.5,
    }));
  }, []);
  return (
    <group>
      {rand.map((d, i) => {
        const pulse = 0.5 + 0.5 * Math.sin(frame / 26 + d.phase);
        return (
          <mesh key={i} position={[d.x, d.y + Math.sin(frame / 50 + d.phase) * 0.25, d.z]}>
            <circleGeometry args={[d.s * (0.7 + pulse * 0.5), 12]} />
            <meshBasicMaterial color={d.warm ? C.accentBright : C.amber} transparent opacity={0.1 + pulse * 0.16} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
};

/** Slow parallax camera sway — the reference's drifting-stage feel. */
const CameraRig: React.FC = () => {
  const frame = useCurrentFrame();
  const camera = useThree((s) => s.camera);
  camera.position.set(Math.sin(frame / 210) * 0.9, 0.4 + Math.sin(frame / 260 + 1.2) * 0.3, 6.4);
  camera.lookAt(0, 0, 0);
  return null;
};

export const RecipeOrbit: React.FC<{ opacity?: number }> = ({ opacity = 1 }) => {
  const { width, height } = useVideoConfig();

  // Whole-canvas fade for shot entry, driven by parent opacity prop.
  const canvasOpacity = interpolate(opacity, [0, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.inOut });

  return (
    <div style={{ position: "absolute", inset: 0, opacity: canvasOpacity }}>
      <ThreeCanvas width={width} height={height} camera={{ position: [0, 0.4, 6.4], fov: 42 }} gl={{ antialias: true }}>
        <color attach="background" args={[C.stage]} />
        <fog attach="fog" args={[C.stage, 3.2, 9.5]} />
        <ambientLight intensity={0.85} color={C.cream} />
        <directionalLight position={[4, 6, 8]} intensity={1.1} color={C.cream} />
        <pointLight position={[-5, -2, 4]} intensity={18} color={C.accentBright} distance={14} />
        <Suspense fallback={null}>
          <RingCards count={26} radius={4.3} cardW={1.55} cardH={1.16} />
        </Suspense>
        <GlowDots />
        <CameraRig />
      </ThreeCanvas>
    </div>
  );
};
