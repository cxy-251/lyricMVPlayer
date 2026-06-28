import {OrbitControls, Environment} from '@react-three/drei';
import {useFrame} from '@react-three/fiber';
import {useControls} from 'leva';
import {useCallback, useMemo, useRef} from 'react';
import * as THREE from 'three';

import {Web3DEngine} from '../../core/Web3DEngine';
import {generateMorphTargets, MORPH_SHAPES} from './particleTargets';

const PARTICLE_COUNT = 300000; // Reduced slightly for high-poly InstancedMesh stability

function HolographicMorphingField({clickTrigger, controls}: {clickTrigger: React.MutableRefObject<boolean>, controls: any}) {
  const materialRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const targets = useMemo(() => generateMorphTargets(PARTICLE_COUNT), []);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const target = useMemo(() => new THREE.Vector3(), []);

  const currentShape = useRef(0);
  const targetShape = useRef(0);
  const morphProgress = useRef(1.0);

  const geometry = useMemo(() => {
    // Sharp physical crystals instead of points
    const geo = new THREE.TetrahedronGeometry(0.04, 0);
    const instancedGeo = new THREE.InstancedBufferGeometry();
    instancedGeo.copy(geo as unknown as THREE.InstancedBufferGeometry);
    instancedGeo.instanceCount = PARTICLE_COUNT;

    instancedGeo.setAttribute('aSphere', new THREE.InstancedBufferAttribute(targets.sphere, 3));
    instancedGeo.setAttribute('aTorus', new THREE.InstancedBufferAttribute(targets.torus, 3));
    instancedGeo.setAttribute('aGalaxy', new THREE.InstancedBufferAttribute(targets.galaxy, 3));
    instancedGeo.setAttribute('aGrid', new THREE.InstancedBufferAttribute(targets.grid, 3));
    instancedGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(targets.seed, 4));

    return instancedGeo;
  }, [targets]);

  useFrame((state, delta) => {
    if (materialRef.current && materialRef.current.userData.shader) {
      const u = materialRef.current.userData.shader.uniforms;
      const t = state.clock.elapsedTime;
      
      u.uTime.value = t;

      if (clickTrigger.current) {
        if (morphProgress.current >= 1.0) {
          currentShape.current = targetShape.current;
          targetShape.current = (targetShape.current + 1) % MORPH_SHAPES.length;
          morphProgress.current = 0.0;
        }
        clickTrigger.current = false;
      }

      if (morphProgress.current < 1.0) {
        morphProgress.current += delta * controls.morphSpeed;
        if (morphProgress.current > 1.0) morphProgress.current = 1.0;
      }
      
      const easedMorph = morphProgress.current * morphProgress.current * (3.0 - 2.0 * morphProgress.current);

      u.uFromShape.value = currentShape.current;
      u.uToShape.value = targetShape.current;
      u.uMorphProgress.value = easedMorph;

      raycaster.setFromCamera(state.pointer, state.camera);
      raycaster.ray.intersectPlane(plane, target);
      if (target) {
        u.uPointerWorld.value.lerp(target, delta * 8.0);
      }

      u.uRepelRadius.value = controls.repelRadius;
      u.uRepelStrength.value = controls.repelStrength;
      u.uTurbulence.value = controls.turbulence;
      u.uParticleSize.value = controls.particleSize;
    }
  });

  const onBeforeCompile = (shader: any) => {
    shader.uniforms.uTime = {value: 0};
    shader.uniforms.uMorphProgress = {value: 0};
    shader.uniforms.uFromShape = {value: 0};
    shader.uniforms.uToShape = {value: 1};
    shader.uniforms.uPointerWorld = {value: new THREE.Vector3(0, 0, 0)};
    shader.uniforms.uRepelRadius = {value: 0.4};
    shader.uniforms.uRepelStrength = {value: 2.0};
    shader.uniforms.uTurbulence = {value: 1.0};
    shader.uniforms.uParticleSize = {value: 1.0};

    materialRef.current!.userData.shader = shader;

    shader.vertexShader = `
      uniform float uTime;
      uniform float uMorphProgress;
      uniform float uFromShape;
      uniform float uToShape;
      uniform vec3 uPointerWorld;
      uniform float uRepelRadius;
      uniform float uRepelStrength;
      uniform float uTurbulence;
      uniform float uParticleSize;

      attribute vec3 aSphere;
      attribute vec3 aTorus;
      attribute vec3 aGalaxy;
      attribute vec3 aGrid;
      attribute vec4 aSeed;

      varying vec3 vInstColor;

      vec3 getShape(float index) {
        if (index < 0.5) return aSphere;
        if (index < 1.5) return aTorus;
        if (index < 2.5) return aGalaxy;
        return aGrid;
      }

      mat2 rotate2d(float angle) {
        float s = sin(angle);
        float c = cos(angle);
        return mat2(c, -s, s, c);
      }
    ` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      vec3 fromPos = getShape(uFromShape);
      vec3 toPos = getShape(uToShape);
      
      vec3 p = mix(fromPos, toPos, uMorphProgress);
      
      float pop = sin(uMorphProgress * 3.14159) * aSeed.x * 2.0;
      p += normalize(p + 0.01) * pop;
      
      p.xy = rotate2d(uTime * 0.1) * p.xy;
      p.xz = rotate2d(uTime * 0.05) * p.xz;
      
      vec3 pointer3D = uPointerWorld;
      float distToPointer = distance(p, pointer3D);
      
      float repelRaw = smoothstep(uRepelRadius, 0.0, distToPointer);
      float repel = pow(repelRaw, 2.0) * uRepelStrength;
      vec3 repelDir = normalize(p - pointer3D + vec3(0.001));
      p += repelDir * repel;
      
      float turbulenceFactor = uTurbulence * 0.05 * (1.0 + (1.0 - uMorphProgress) * 2.0);
      vec3 turbVec = vec3(
        sin(uTime * 2.0 + aSeed.x * 100.0) * cos(uTime * 1.5 + aSeed.y * 100.0),
        cos(uTime * 1.8 + aSeed.y * 120.0) * sin(uTime * 1.2 + aSeed.z * 80.0),
        sin(uTime * 2.2 + aSeed.z * 90.0) * cos(uTime * 1.6 + aSeed.x * 110.0)
      );
      p.xyz += turbVec * turbulenceFactor;
      
      // Calculate velocity for stretching and rotation
      vec3 vel = repel > 0.0 ? repelDir : turbVec;
      float speed = length(vel);
      
      vec3 forward = speed > 0.001 ? normalize(vel) : vec3(0.0, 1.0, 0.0);
      vec3 up = vec3(0.0, 1.0, 0.0);
      if (abs(forward.y) > 0.999) { up = vec3(1.0, 0.0, 0.0); }
      vec3 right = normalize(cross(up, forward));
      up = cross(forward, right);
      mat3 rot = mat3(right, up, forward);
      
      vec3 colorA = vec3(1.0, 0.1, 0.5); // Neon Pink
      vec3 colorB = vec3(0.1, 0.8, 1.0); // Cyan
      vec3 hotColor = vec3(1.0, 1.0, 1.0);
      
      vec3 color = mix(colorA, colorB, aSeed.y);
      color = mix(color, hotColor, repel * 0.8 + pop * 0.3);
      vInstColor = color;
      
      float scale = (1.0 + aSeed.x * 0.5 + repel * 2.0) * uParticleSize;
      vec3 scaledPos = position * scale;
      scaledPos.z *= max(1.0, speed * 2.0);
      
      vec3 transformed = rot * scaledPos + p;
      `
    );

    shader.fragmentShader = `
      varying vec3 vInstColor;
    ` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      'vec4 diffuseColor = vec4( diffuse, opacity );',
      `
      vec4 diffuseColor = vec4( diffuse * vInstColor, opacity );
      `
    );
  };

  return (
    <mesh frustumCulled={false} castShadow receiveShadow>
      <primitive object={geometry} />
      <meshPhysicalMaterial
        ref={materialRef}
        roughness={0.1}
        metalness={0.6}
        clearcoat={1.0}
        transmission={0.8}
        thickness={0.5}
        ior={1.5}
        onBeforeCompile={onBeforeCompile}
      />
    </mesh>
  );
}

function MorphingScene({debug, controls}: {debug: boolean, controls: any}) {
  const clickTrigger = useRef(false);

  const handlePointerDown = useCallback(() => {
    clickTrigger.current = true;
  }, []);

  return (
    <Web3DEngine
      onPointerDown={handlePointerDown}
      config={{
        background: '#040406',
        camera: {fov: 45, far: 50, near: 0.1, position: [0, -2, 7.5]},
        debug,
      }}
    >
      <OrbitControls makeDefault enablePan={false} enableZoom={true} enableRotate={true} minDistance={2} maxDistance={30} />
      <Environment preset="studio" />
      <ambientLight intensity={1.5} />
      <directionalLight position={[10, 10, 10]} intensity={3.0} castShadow />
      <directionalLight position={[-10, -10, -10]} intensity={1.5} color="#00ffff" />
      
      <HolographicMorphingField clickTrigger={clickTrigger} controls={controls} />
    </Web3DEngine>
  );
}

export default function Demo011ParticleMorphingField() {
  const {showStats} = useControls('Debug', {showStats: false});
  const morphControls = useControls('Hologram Physics', {
    repelRadius: { value: 0.08, min: 0.01, max: 0.5, step: 0.01 },
    repelStrength: { value: 3.0, min: 0.1, max: 8.0, step: 0.1 },
    morphSpeed: { value: 1.5, min: 0.1, max: 4.0, step: 0.1 },
    turbulence: { value: 1.0, min: 0.0, max: 4.0, step: 0.1 },
    particleSize: { value: 0.6, min: 0.1, max: 4.0, step: 0.1 }, // Adjusted default size for InstancedMesh
  });

  return <MorphingScene debug={showStats} controls={morphControls} />;
}
