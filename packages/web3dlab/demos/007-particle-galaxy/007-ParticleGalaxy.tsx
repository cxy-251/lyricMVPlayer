import {useFrame} from '@react-three/fiber';
import {useControls} from 'leva';
import {useMemo, useRef} from 'react';
import * as THREE from 'three';

import {DemoScene} from '../../core/DemoScene';
import diskFrag from './shaders/disk.frag?raw';
import diskVert from './shaders/disk.vert?raw';
import starFrag from './shaders/particle.frag?raw';
import starVert from './shaders/particle.vert?raw';
import simplex3d from '../../shaders/includes/simplex3d.glsl?raw';

// ─── Physics Constants (1 = Schwarzschild Radius x 2) ────────
const BH_SHADOW_R   = 1.0;   // Photon capture sphere
const DISK_INNER_R  = 1.6;   // ISCO
const DISK_OUTER_R  = 9.0;
const STAR_COUNT    = 40000;
const JET_COUNT     = 20000;
const MAX_DISK_PARTICLES = 400000;
const PHOTON_RING_PARTICLES = 9000;

// ─── Volumetric Polar Jets Shader ────────────────────────────
const JET_VERT = `
  uniform float uTime;
  uniform float uJetIntensity;
  uniform float uJetSpread;

  attribute float aSpeed;
  attribute float aAngle;
  attribute float aPhase;
  attribute float aDir;     // +1 = Top Jet, -1 = Bottom Jet
  varying float vFade;

  ${simplex3d}

  void main() {
    float progress = fract(aPhase + aSpeed * uTime * 0.32);

    // Jet height
    float h = progress * 18.0 * aDir;

    // Base conical spread
    float spread = progress * uJetSpread * 11.0;

    // 3D Noise for spiral twisting
    vec3 noisePos = vec3(cos(aAngle), h * 0.5, sin(aAngle)) + uTime;
    float n1 = snoise(noisePos * 2.0);
    float n2 = snoise(noisePos * 3.0 + 100.0);

    vec3 p = vec3(
      cos(aAngle) * spread + n1 * spread * 0.5,
      h,
      sin(aAngle) * spread + n2 * spread * 0.5
    );

    // Feather both ends so particles do not pop at the root or at respawn.
    float rootFade = smoothstep(0.0, 0.1, progress);
    float tipFade = pow(1.0 - progress, 2.35);
    vFade = rootFade * tipFade * uJetIntensity;

    vec4 mvp = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvp;

    // Soft particle size scaling
    gl_PointSize = min(5.2 * (10.0 / -mvp.z) * (0.35 + vFade), 9.0);
  }
`;
const JET_FRAG = `
  varying float vFade;
  void main() {
    vec2  uv   = gl_PointCoord - 0.5;
    float dist = length(uv);
    if (dist > 0.5) discard;

    float alpha = exp(-pow(dist * 2.5, 2.0)) * vFade * 0.38;

    // Blue synchrotron glow, kept below white-out.
    vec3 color = mix(vec3(0.08, 0.28, 0.85), vec3(0.62, 0.82, 1.0), pow(vFade, 0.55));
    gl_FragColor = vec4(color * 0.95, alpha);
  }
`;

// ─── Background Stars ───────────────────────────────────────
function BackgroundStars() {
  const {geo, mat} = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(STAR_COUNT * 3);
    const sizes = new Float32Array(STAR_COUNT);
    const colors = new Float32Array(STAR_COUNT * 3);

    for (let i = 0; i < STAR_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 28 + Math.random() * 52;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
      sizes[i] = 0.3 + Math.random() * 0.7;

      const type = Math.random();
      if (type < 0.08) {
        colors[i * 3] = 0.55; colors[i * 3 + 1] = 0.78; colors[i * 3 + 2] = 1.0;
      } else if (type < 0.55) {
        const v = 0.82 + Math.random() * 0.18;
        colors[i * 3] = v; colors[i * 3 + 1] = v; colors[i * 3 + 2] = v * 0.9;
      } else if (type < 0.82) {
        colors[i * 3] = 1.0; colors[i * 3 + 1] = 0.68; colors[i * 3 + 2] = 0.28;
      } else {
        colors[i * 3] = 0.92; colors[i * 3 + 1] = 0.28; colors[i * 3 + 2] = 0.08;
      }
    }

    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aStarSize', new THREE.BufferAttribute(sizes, 1));
    g.setAttribute('aStarColor', new THREE.BufferAttribute(colors, 3));

    const m = new THREE.ShaderMaterial({
      vertexShader: starVert,
      fragmentShader: starFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return {geo: g, mat: m};
  }, []);

  return <points geometry={geo} material={mat} frustumCulled={false} />;
}

// ─── Accretion Disk ──────────────────────────────────────────
function AccretionDisk({controls}: {controls: any}) {
  const pointsRef = useRef<THREE.Points>(null);

  const diskUniforms = useMemo(() => ({
    uTime: {value: 0},
    uDopplerStrength: {value: 0.75},
    uCameraPos: {value: new THREE.Vector3()},
  }), []);

  useFrame(state => {
    diskUniforms.uTime.value = state.clock.elapsedTime;
    diskUniforms.uDopplerStrength.value = controls.dopplerStrength;
    diskUniforms.uCameraPos.value.copy(state.camera.position);

    if (pointsRef.current) {
       pointsRef.current.geometry.setDrawRange(0, Math.floor(MAX_DISK_PARTICLES * controls.diskDensity));
    }
  });

  const [geo, mat] = useMemo(() => {
    const pos = new Float32Array(MAX_DISK_PARTICLES * 3);
    const radii = new Float32Array(MAX_DISK_PARTICLES);
    const angles = new Float32Array(MAX_DISK_PARTICLES);
    const heights = new Float32Array(MAX_DISK_PARTICLES);
    const randoms = new Float32Array(MAX_DISK_PARTICLES);

    for (let i = 0; i < MAX_DISK_PARTICLES; i++) {
      const r = DISK_INNER_R + (DISK_OUTER_R - DISK_INNER_R) * Math.pow(Math.random(), 1.5);
      radii[i] = r;
      angles[i] = Math.random() * Math.PI * 2;
      heights[i] = (Math.random() * 2 - 1) * r * 0.05;
      randoms[i] = Math.random();
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aRadius', new THREE.BufferAttribute(radii, 1));
    g.setAttribute('aAngle', new THREE.BufferAttribute(angles, 1));
    g.setAttribute('aHeight', new THREE.BufferAttribute(heights, 1));
    g.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), DISK_OUTER_R + 2);

    const m = new THREE.ShaderMaterial({
      uniforms: diskUniforms,
      vertexShader: diskVert,
      fragmentShader: diskFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return [g, m];
  }, [diskUniforms]);

  return <points ref={pointsRef} geometry={geo} material={mat} frustumCulled={false} />;
}

// ─── Black Hole Shadow (Event Horizon) ───────────────────────
function BlackHoleShadow() {
  return (
    <mesh>
      <sphereGeometry args={[BH_SHADOW_R, 64, 64]} />
      <meshBasicMaterial color="#000000" />
    </mesh>
  );
}

function PhotonRing() {
  const pointsRef = useRef<THREE.Points>(null);

  useFrame(state => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.28;
    }
  });

  const {geo, mat} = useMemo(() => {
    const pos = new Float32Array(PHOTON_RING_PARTICLES * 3);
    const sizes = new Float32Array(PHOTON_RING_PARTICLES);
    const colors = new Float32Array(PHOTON_RING_PARTICLES * 3);
    let seed = 7007;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    for (let i = 0; i < PHOTON_RING_PARTICLES; i++) {
      const angle = rand() * Math.PI * 2;
      const radius = 1.06 + Math.pow(rand(), 1.4) * 0.34;
      const jitter = (rand() - 0.5) * 0.035;
      pos[i * 3] = Math.cos(angle) * radius;
      pos[i * 3 + 1] = jitter;
      pos[i * 3 + 2] = Math.sin(angle) * radius;

      const heat = Math.pow(1.0 - Math.min(1, (radius - 1.06) / 0.34), 0.65);
      sizes[i] = 0.22 + rand() * 0.34 + heat * 0.18;
      colors[i * 3] = 1.0;
      colors[i * 3 + 1] = 0.36 + heat * 0.22;
      colors[i * 3 + 2] = 0.06 + heat * 0.12;
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aStarSize', new THREE.BufferAttribute(sizes, 1));
    g.setAttribute('aStarColor', new THREE.BufferAttribute(colors, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.8);

    const m = new THREE.ShaderMaterial({
      vertexShader: starVert,
      fragmentShader: starFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return {geo: g, mat: m};
  }, []);

  return (
    <points ref={pointsRef} geometry={geo} material={mat} frustumCulled={false} />
  );
}

// ─── Relativistic Volumetric Jets ────────────────────────────
function RelativisticJets({controls}: {controls: any}) {
  const jetUniforms = useMemo(() => ({
    uTime: {value: 0},
    uJetIntensity: {value: 0.6},
    uJetSpread: {value: 0.15},
  }), []);

  useFrame(state => {
    jetUniforms.uTime.value = state.clock.elapsedTime;
    jetUniforms.uJetIntensity.value = controls.jetIntensity;
    jetUniforms.uJetSpread.value = controls.jetSpread;
  });

  const {geo, mat} = useMemo(() => {
    const total = JET_COUNT * 2;
    const pos = new Float32Array(total * 3);
    const speeds = new Float32Array(total);
    const angles = new Float32Array(total);
    const phases = new Float32Array(total);
    const dirs = new Float32Array(total);

    for (let i = 0; i < total; i++) {
      speeds[i] = 0.4 + Math.random() * 0.9;
      angles[i] = Math.random() * Math.PI * 2;
      phases[i] = Math.random();
      dirs[i] = i < JET_COUNT ? 1.0 : -1.0;
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    g.setAttribute('aAngle', new THREE.BufferAttribute(angles, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    g.setAttribute('aDir', new THREE.BufferAttribute(dirs, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20);

    const m = new THREE.ShaderMaterial({
      uniforms: jetUniforms,
      vertexShader: JET_VERT,
      fragmentShader: JET_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return {geo: g, mat: m};
  }, [jetUniforms]);

  return <points geometry={geo} material={mat} frustumCulled={false} />;
}

// ─── Main Scene ──────────────────────────────────────────────
function BlackHoleScene({controls}: {controls: any}) {
  return (
    <DemoScene
      engineConfig={{
        background: '#000005',
        camera: {fov: 42, far: 150, near: 0.05, position: [0, 4.5, 14]},
        bloom: {intensity: controls.bloomIntensity, luminanceThreshold: 0.48, luminanceSmoothing: 0.68},
      }}
      orbitConfig={{
        autoRotate: true,
        autoRotateSpeed: 0.5,
        maxDistance: 45,
        minDistance: 2.5,
        enablePan: false,
      }}
    >
      <BackgroundStars />
      <AccretionDisk controls={controls} />
      <BlackHoleShadow />
      <PhotonRing />
      <RelativisticJets controls={controls} />
    </DemoScene>
  );
}

// ─── Demo Entry ──────────────────────────────────────────────
export default function Demo007ParticleGalaxy() {
  const bhControls = useControls('Relativistic Black Hole', {
    jetIntensity: {value: 0.45, min: 0.0, max: 0.85, step: 0.05},
    jetSpread: {value: 0.12, min: 0.01, max: 0.34, step: 0.01},
    dopplerStrength: {value: 0.48, min: 0.0, max: 0.75, step: 0.05},
    diskDensity: {value: 0.46, min: 0.12, max: 0.72, step: 0.02},
    bloomIntensity: {value: 0.85, min: 0.0, max: 2.0, step: 0.05},
  });

  return <BlackHoleScene controls={bhControls} />;
}
