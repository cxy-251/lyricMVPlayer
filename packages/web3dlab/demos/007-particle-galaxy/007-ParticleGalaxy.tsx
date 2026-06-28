import {useFrame} from '@react-three/fiber';
import {useControls} from 'leva';
import {useMemo} from 'react';
import * as THREE from 'three';

import {DemoScene} from '../../core/DemoScene';
import diskFrag from './shaders/disk.frag?raw';
import diskVert from './shaders/disk.vert?raw';
import starFrag from './shaders/particle.frag?raw';
import starVert from './shaders/particle.vert?raw';

// ─── 物理常数（归一化单位，1 = 史瓦西半径 × 2）────────────────
const BH_SHADOW_R   = 1.0;   // 黑洞阴影半径（光子捕获截面）
const PHOTON_RING_R = 1.35;  // 光子球半径（光子不稳定圆轨道）
const DISK_INNER_R  = 1.6;   // ISCO：最内稳定圆轨道
const DISK_OUTER_R  = 9.0;   // 吸积盘外缘
const STAR_COUNT    = 60000; // 背景星场粒子数
const JET_COUNT     = 10000; // 相对论性喷流粒子数（单侧）

// ─── 相对论性喷流 Shader（短小，保留内联）────────────────────
const JET_VERT = `
  uniform float uTime;
  attribute float aSpeed;
  attribute float aAngle;
  attribute float aDir;     // +1 = 上喷流，-1 = 下喷流
  varying   float vFade;

  void main() {
    float progress = fract(aSpeed * uTime * 0.35);
    float h        = progress * 14.0 * aDir;
    float spread   = progress * 0.28;

    vec3 p = vec3(cos(aAngle) * spread, h, sin(aAngle) * spread);
    vFade  = pow(1.0 - progress, 2.0);

    vec4 mvp     = modelViewMatrix * vec4(p, 1.0);
    gl_Position  = projectionMatrix * mvp;
    gl_PointSize = min(3.5 * (7.0 / -mvp.z) * vFade, 6.0);
  }
`;
const JET_FRAG = `
  varying float vFade;
  void main() {
    vec2  uv   = gl_PointCoord - 0.5;
    float dist = length(uv);
    if (dist > 0.5) discard;
    float alpha = exp(-dist * dist * 18.0) * vFade * 0.55;
    // 同步辐射：内层白热，外层偏蓝
    vec3  color = mix(vec3(0.55, 0.78, 1.0), vec3(1.0, 1.0, 1.0), vFade);
    gl_FragColor = vec4(color, alpha);
  }
`;

// ─── 背景星场 ─────────────────────────────────────────────────
function BackgroundStars() {
  const {geo, mat} = useMemo(() => {
    const g      = new THREE.BufferGeometry();
    const pos    = new Float32Array(STAR_COUNT * 3);
    const sizes  = new Float32Array(STAR_COUNT);
    const colors = new Float32Array(STAR_COUNT * 3);

    for (let i = 0; i < STAR_COUNT; i++) {
      const theta  = Math.random() * Math.PI * 2;
      const phi    = Math.acos(2 * Math.random() - 1);
      const r      = 28 + Math.random() * 52;
      pos[i * 3]   = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
      sizes[i]     = 0.3 + Math.random() * 0.7;

      // 恒星光谱型：O/B 蓝色，G 白黄，K/M 橙红
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

    g.setAttribute('position',   new THREE.BufferAttribute(pos,    3));
    g.setAttribute('aStarSize',  new THREE.BufferAttribute(sizes,  1));
    g.setAttribute('aStarColor', new THREE.BufferAttribute(colors, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);

    const m = new THREE.ShaderMaterial({
      vertexShader: starVert,
      fragmentShader: starFrag,
      transparent: true,
      depthWrite: false,
    });

    return {geo: g, mat: m};
  }, []);

  return <points geometry={geo} material={mat} frustumCulled={false} />;
}

// ─── 吸积盘 ───────────────────────────────────────────────────
const DISK_PARTICLE_COUNT = 300000;

function AccretionDisk({controls}: {controls: any}) {
  const diskUniforms = useMemo(() => ({
    uTime:            {value: 0},
    uDopplerStrength: {value: 0.45},
  }), []);

  useFrame(state => {
    diskUniforms.uTime.value            = state.clock.elapsedTime;
    diskUniforms.uDopplerStrength.value = controls.dopplerStrength;
  });

  const [geo, mat] = useMemo(() => {
    const pos     = new Float32Array(DISK_PARTICLE_COUNT * 3); // 全零，位置由着色器计算
    const radii   = new Float32Array(DISK_PARTICLE_COUNT);
    const angles  = new Float32Array(DISK_PARTICLE_COUNT);
    const heights = new Float32Array(DISK_PARTICLE_COUNT);
    const randoms = new Float32Array(DISK_PARTICLE_COUNT);

    for (let i = 0; i < DISK_PARTICLE_COUNT; i++) {
      // 内缘密集分布（1.5 次幂：ISCO 区域粒子更多，模拟温度梯度）
      const r      = DISK_INNER_R + (DISK_OUTER_R - DISK_INNER_R) * Math.pow(Math.random(), 1.5);
      radii[i]     = r;
      // 完全随机角度：彻底消除接缝
      angles[i]    = Math.random() * Math.PI * 2;
      // 薄盘厚度：h/r ≈ 0.1（标准 Shakura-Sunyaev 薄盘近似）
      heights[i]   = (Math.random() * 2 - 1) * r * 0.10;
      randoms[i]   = Math.random();
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos,     3));
    g.setAttribute('aRadius',  new THREE.BufferAttribute(radii,   1));
    g.setAttribute('aAngle',   new THREE.BufferAttribute(angles,  1));
    g.setAttribute('aHeight',  new THREE.BufferAttribute(heights, 1));
    g.setAttribute('aRandom',  new THREE.BufferAttribute(randoms, 1));
    // 手动设置包围球：着色器计算实际位置，Three.js 无从自动推断
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), DISK_OUTER_R + 2);

    const m = new THREE.ShaderMaterial({
      uniforms:       diskUniforms,
      vertexShader:   diskVert,
      fragmentShader: diskFrag,
      transparent:    true,
      depthWrite:     false,
      blending:       THREE.AdditiveBlending,
    });

    return [g, m];
  }, [diskUniforms]);

  return <points geometry={geo} material={mat} frustumCulled={false} />;
}



// ─── 黑洞阴影（事件视界光子捕获截面）────────────────────────
function BlackHoleShadow() {
  return (
    <mesh>
      <sphereGeometry args={[BH_SHADOW_R, 64, 64]} />
      {/* 纯黑，不反射任何光：黑洞不发光，只吸收 */}
      <meshBasicMaterial color="#000000" />
    </mesh>
  );
}

// ─── 相对论性喷流（Blandford-Znajek 机制）────────────────────
function RelativisticJets({visible}: {visible: boolean}) {
  const jetUniforms = useMemo(() => ({uTime: {value: 0}}), []);

  useFrame(state => {
    jetUniforms.uTime.value = state.clock.elapsedTime;
  });

  const {geo, mat} = useMemo(() => {
    const total  = JET_COUNT * 2; // 上下两束
    const pos    = new Float32Array(total * 3);
    const speeds = new Float32Array(total);
    const angles = new Float32Array(total);
    const dirs   = new Float32Array(total);

    for (let i = 0; i < total; i++) {
      speeds[i] = 0.4 + Math.random() * 0.9;
      angles[i] = Math.random() * Math.PI * 2;
      dirs[i]   = i < JET_COUNT ? 1.0 : -1.0;
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos,    3));
    g.setAttribute('aSpeed',   new THREE.BufferAttribute(speeds, 1));
    g.setAttribute('aAngle',   new THREE.BufferAttribute(angles, 1));
    g.setAttribute('aDir',     new THREE.BufferAttribute(dirs,   1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20);

    const m = new THREE.ShaderMaterial({
      uniforms:       jetUniforms,
      vertexShader:   JET_VERT,
      fragmentShader: JET_FRAG,
      transparent:    true,
      depthWrite:     false,
      blending:       THREE.AdditiveBlending,
    });

    return {geo: g, mat: m};
  }, [jetUniforms]);

  if (!visible) return null;
  return <points geometry={geo} material={mat} frustumCulled={false} />;
}

// ─── 主场景 ───────────────────────────────────────────────────
function BlackHoleScene({debug, controls}: {debug: boolean; controls: any}) {
  return (
    <DemoScene
      debug={debug}
      engineConfig={{
        background: '#000008',
        // 视角约 16°（接近 M87* 实际观测倾角），既能看到吸积盘的椭圆形，
        // 又能看到多普勒不对称的亮侧
        camera: {fov: 42, far: 150, near: 0.05, position: [0, 3.8, 14]},
        // Bloom：只让吸积盘内缘（亮度 > 0.4）和光子环产生泛光
        bloom: {intensity: 1.2, luminanceThreshold: 0.38, luminanceSmoothing: 0.75},
      }}
      orbitConfig={{
        autoRotate:      true,
        autoRotateSpeed: 0.25,
        maxDistance:     45,
        minDistance:     2.5,
        enablePan:       false,
      }}
    >
      <BackgroundStars />
      <AccretionDisk controls={controls} />
      <BlackHoleShadow />
      <RelativisticJets visible={controls.showJets} />
    </DemoScene>
  );
}

// ─── Demo 入口 ────────────────────────────────────────────────
export default function Demo007ParticleGalaxy() {
  const {showStats} = useControls('Debug', {showStats: false});
  const bhControls  = useControls('Black Hole', {
    // 相对论性多普勒增亮强度（0 = 对称，1 = 极度不对称）
    dopplerStrength: {value: 0.45, min: 0.0, max: 1.0, step: 0.05},
    // 是否显示相对论性喷流（Blandford-Znajek 机制）
    showJets: true,
  });

  return <BlackHoleScene debug={showStats} controls={bhControls} />;
}
