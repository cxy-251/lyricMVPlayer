import {useEffect, useMemo, useRef} from "react";
import * as THREE from "three";
import {resolveParticleEffectConfig} from "./module-api";
import type {ParticleEffectConfig} from "@paper-to-video/shared-types";
import type {ThreeLifeEffectProps} from "./three-life-effect.types";

type ParticleSeed = {
  baseAngle: number;
  baseRadius: number;
  speed: number;
  phase: number;
  layer: number;
  tone: number;
};

type ParticleLayerKey = "primary" | "secondary" | "accent";

type LayeredParticleSeed = ParticleSeed & {
  colorLayer: ParticleLayerKey;
};

type ParticleMeshes = Record<ParticleLayerKey, THREE.InstancedMesh>;

const hashNoise = (seed: number) => {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
};

const buildParticleSeeds = (count: number, seed: number, distribution: ParticleEffectConfig["distribution"]) => {
  return Array.from({length: count}, (_, index) => {
    const noiseA = hashNoise(seed * 101 + index * 13.17);
    const noiseB = hashNoise(seed * 211 + index * 7.41);
    const noiseC = hashNoise(seed * 307 + index * 3.91);
    const noiseD = hashNoise(seed * 401 + index * 11.73);
    const noiseE = hashNoise(seed * 503 + index * 5.61);
    const noiseF = hashNoise(seed * 601 + index * 17.21);

    const radiusNoise =
      distribution === "halo"
        ? 0.62 + noiseB * 0.38
        : distribution === "spiral"
          ? 0.12 + noiseB * 0.88
          : 0.06 + noiseB * noiseB * 0.78;

    return {
      baseAngle: noiseA * Math.PI * 2,
      baseRadius: radiusNoise,
      speed: 0.4 + noiseC * 1.8,
      phase: noiseD * Math.PI * 2,
      layer: noiseE * 2 - 1,
      tone: noiseF,
    };
  });
};

const resolveParticleColorLayer = (tone: number): ParticleLayerKey => {
  if (tone < 0.42) {
    return "primary";
  }

  if (tone < 0.78) {
    return "secondary";
  }

  return "accent";
};

const createGeometry = (shape: ParticleEffectConfig["shape"]) => {
  if (shape === "circle") {
    return new THREE.CircleGeometry(0.5, 18);
  }

  return new THREE.PlaneGeometry(1, 1);
};

export const useThreeParticleRenderer = ({
  width,
  height,
  absoluteFrame,
  simulationFrame,
  seed,
  modules,
}: ThreeLifeEffectProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshesRef = useRef<ParticleMeshes | null>(null);
  const helper = useMemo(() => new THREE.Object3D(), []);
  const config = resolveParticleEffectConfig(modules);
  const particleSeeds = useMemo<LayeredParticleSeed[]>(
    () =>
      buildParticleSeeds(config.particleCount, seed, config.distribution).map((particle) => ({
        ...particle,
        colorLayer: resolveParticleColorLayer(particle.tone),
      })),
    [config.distribution, config.particleCount, seed],
  );
  const layeredSeeds = useMemo(
    () => ({
      primary: particleSeeds.filter((particle) => particle.colorLayer === "primary"),
      secondary: particleSeeds.filter((particle) => particle.colorLayer === "secondary"),
      accent: particleSeeds.filter((particle) => particle.colorLayer === "accent"),
    }),
    [particleSeeds],
  );

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const contextAttributes: WebGLContextAttributes = {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
    };
    const context = (
      canvas.getContext("webgl2", contextAttributes) ??
      canvas.getContext("webgl", contextAttributes) ??
      canvas.getContext("experimental-webgl", contextAttributes)
    ) as WebGL2RenderingContext | WebGLRenderingContext | null;

    if (!context) {
      throw new Error("Unable to acquire a WebGL context for ThreeParticleEffect");
    }

    const renderer = new THREE.WebGLRenderer({canvas, context, alpha: true, antialias: false});
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0, 22);

    const geometry = createGeometry(config.shape);
    const createLayerMesh = (count: number, color: string) => {
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
      });
      const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, count));
      mesh.count = count;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(mesh);
      return mesh;
    };

    /**
     * We render one instanced mesh per tone bucket instead of relying on
     * instanceColor, because that path has proven inconsistent across the
     * in-app browser and video renderer environments.
     */
    const meshes: ParticleMeshes = {
      primary: createLayerMesh(layeredSeeds.primary.length, config.primaryColor),
      secondary: createLayerMesh(layeredSeeds.secondary.length, config.secondaryColor),
      accent: createLayerMesh(layeredSeeds.accent.length, config.accentColor),
    };

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    meshesRef.current = meshes;

    return () => {
      geometry.dispose();
      Object.values(meshes).forEach((mesh) => {
        mesh.dispose();
        (mesh.material as THREE.MeshBasicMaterial).dispose();
      });
      renderer.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      meshesRef.current = null;
    };
  }, [
    config.accentColor,
    config.primaryColor,
    config.secondaryColor,
    config.shape,
    height,
    layeredSeeds.accent.length,
    layeredSeeds.primary.length,
    layeredSeeds.secondary.length,
    width,
  ]);

  useEffect(() => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const meshes = meshesRef.current;
    if (!renderer || !scene || !camera || !meshes) {
      return;
    }

    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    (meshes.primary.material as THREE.MeshBasicMaterial).color.set(config.primaryColor);
    (meshes.secondary.material as THREE.MeshBasicMaterial).color.set(config.secondaryColor);
    (meshes.accent.material as THREE.MeshBasicMaterial).color.set(config.accentColor);

    const frame = simulationFrame ?? absoluteFrame ?? 0;
    const time = frame * config.driftSpeed;
    const aspectScale = width / Math.max(1, height);
    const layerIndices: Record<ParticleLayerKey, number> = {
      primary: 0,
      secondary: 0,
      accent: 0,
    };

    particleSeeds.forEach((particle) => {
      const angle = particle.baseAngle + time * particle.speed;
      const distributionFactor =
        config.distribution === "halo" ? 1.18 : config.distribution === "spiral" ? 0.98 : 0.86;
      const radius =
        particle.baseRadius * config.orbitRadius * Math.min(width, height) * 0.065 * distributionFactor +
        Math.sin(time * 1.35 + particle.phase) * config.swirlStrength * 11;

      let x = 0;
      let y = 0;

      if (config.trajectory === "drift") {
        x =
          Math.cos(angle) * radius * aspectScale * 0.65 +
          Math.sin(time * 0.9 + particle.phase) * 42 +
          particle.layer * 10;
        y =
          Math.sin(angle * 0.5 + particle.phase) * radius * 0.4 +
          Math.cos(time * 1.2 + particle.phase) * 36 -
          (1 - Math.min(1, particle.baseRadius)) * 8;
      } else if (config.trajectory === "wave") {
        x =
          Math.sin(angle * 1.8 + particle.phase) * radius * aspectScale +
          Math.cos(time * 1.1 + particle.phase) * 18;
        y =
          Math.cos(angle * 1.2 + particle.phase) * radius * 0.62 +
          Math.sin(time * 2 + particle.phase) * 26;
      } else {
        const spiral = Math.sin(time * 0.72 + particle.phase * 1.3) * (config.distribution === "spiral" ? 12 : 6);
        const armOffset =
          config.distribution === "spiral"
            ? Math.sin(angle * 2.8 + particle.phase) * radius * 0.34
            : Math.sin(angle * 2 + particle.phase) * radius * 0.18;
        const centerBias = 1 - Math.min(1, particle.baseRadius);
        x =
          Math.cos(angle) * radius * aspectScale +
          Math.cos(angle * 2.2 + particle.phase) * spiral +
          armOffset;
        y =
          Math.sin(angle) * radius +
          Math.sin(angle * 1.6 + particle.phase) * spiral * 0.65 -
          centerBias * (config.distribution === "core" ? 12 : 4);
      }

      const sizeScale =
        config.distribution === "core"
          ? 0.82 + (1 - particle.baseRadius) * 0.9
          : config.distribution === "halo"
            ? 0.78 + particle.baseRadius * 0.42
            : 0.78 + particle.baseRadius * 0.28;
      const drawSize = config.pointSize * sizeScale;
      helper.position.set(x, y, particle.layer * config.layerDepth);
      helper.scale.set(drawSize, drawSize, 1);
      helper.rotation.set(0, 0, config.shape === "diamond" ? Math.PI / 4 : 0);
      helper.updateMatrix();

      const targetMesh = meshes[particle.colorLayer];
      const layerIndex = layerIndices[particle.colorLayer];
      targetMesh.setMatrixAt(layerIndex, helper.matrix);
      layerIndices[particle.colorLayer] += 1;
    });

    Object.values(meshes).forEach((mesh) => {
      mesh.instanceMatrix.needsUpdate = true;
    });
    renderer.render(scene, camera);
  }, [
    absoluteFrame,
    config.accentColor,
    config.driftSpeed,
    config.distribution,
    config.layerDepth,
    config.orbitRadius,
    config.pointSize,
    config.primaryColor,
    config.secondaryColor,
    config.shape,
    config.swirlStrength,
    config.trajectory,
    height,
    helper,
    particleSeeds,
    simulationFrame,
    width,
  ]);

  return {canvasRef};
};
