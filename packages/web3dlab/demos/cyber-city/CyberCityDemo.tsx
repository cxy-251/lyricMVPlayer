import {useControls} from 'leva';
import {useEffect, useMemo, useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';
import {Environment} from '@react-three/drei';

import {DemoScene} from '../../core/DemoScene';

const BUILDING_COUNT = 400;
const CITY_SIZE = 60.0;

function PhysicalCity({controls}: {controls: any}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);

  // 核心：暴露到着色器中的动态 Uniform 变量
  const scanUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uScanColor: { value: new THREE.Color() },
    uScanSpeed: { value: 35.0 },
    uScanWidth: { value: 1.5 },
    uGridDensity: { value: 1.5 },
  }), []);

  useFrame((state) => {
    scanUniforms.uTime.value = state.clock.elapsedTime;
    
    // 将 Leva UI 的值实时同步给显卡 (乘以 5.0 触发 HDR 泛光)
    scanUniforms.uScanColor.value.set(controls.scanColor).multiplyScalar(5.0);
    scanUniforms.uScanSpeed.value = controls.scanSpeed;
    scanUniforms.uScanWidth.value = controls.scanWidth;
    scanUniforms.uGridDensity.value = controls.gridDensity;
  });

  const handleBeforeCompile = (shader: any) => {
    // 绑定所有的动态变量
    shader.uniforms.uTime = scanUniforms.uTime;
    shader.uniforms.uScanColor = scanUniforms.uScanColor;
    shader.uniforms.uScanSpeed = scanUniforms.uScanSpeed;
    shader.uniforms.uScanWidth = scanUniforms.uScanWidth;
    shader.uniforms.uGridDensity = scanUniforms.uGridDensity;

    // 1. 独立计算世界坐标，绝不依赖 Three.js 的条件编译宏
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>\n varying vec3 vMyCustomWorldPos;`
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>\n vec4 myWorldPos = modelMatrix * instanceMatrix * vec4(transformed, 1.0);\n vMyCustomWorldPos = myWorldPos.xyz;`
    );

    // 2. 在片段着色器中接收并使用独立的世界坐标与 UI 参数
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
       uniform float uTime;
       uniform vec3 uScanColor;
       uniform float uScanSpeed;
       uniform float uScanWidth;
       uniform float uGridDensity;
       varying vec3 vMyCustomWorldPos;`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
       // 1. Z 轴自动雷达扫描
       float maxZ = 60.0;
       float scanZ = mod(uTime * uScanSpeed, maxZ * 2.0) - maxZ;
       float distToScan = abs(vMyCustomWorldPos.z - scanZ);
       float scanIntensity = smoothstep(uScanWidth, 0.0, distToScan);
       
       // 2. 赛博网格
       float gridY = step(0.95, fract(vMyCustomWorldPos.y * uGridDensity));
       float gridX = step(0.95, fract(vMyCustomWorldPos.x * uGridDensity));
       float isGrid = max(gridX, gridY);
       
       // 3. 合成最终发光：扫描波挂载网格
       vec3 finalGlow = uScanColor * scanIntensity * (0.2 + isGrid * 0.8);
       
       gl_FragColor.rgb += finalGlow;`
    );
  };

  useEffect(() => {
    if (!meshRef.current) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const m = Math as any;
    m.seedrandom = function(s: number) {
      return function() {
        s = Math.sin(s) * 10000; return s - Math.floor(s);
      };
    };
    const random = m.seedrandom(12345);
    
    for (let i = 0; i < BUILDING_COUNT; i++) {
      const x = (random() - 0.5) * CITY_SIZE;
      const z = (random() - 0.5) * CITY_SIZE;
      const w = 1.0 + random() * 4.0;
      const d = 1.0 + random() * 4.0;
      const h = Math.pow(random(), 3.0) * 35.0 + 2.0;

      dummy.position.set(x, h / 2, z);
      dummy.scale.set(w, h, d);
      dummy.updateMatrix();
      
      meshRef.current.setMatrixAt(i, dummy.matrix);
      color.setHSL(Math.random() * 0.1 + 0.55, 0.8, Math.random() * 0.2 + 0.1);
      meshRef.current.setColorAt(i, color);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [geometry]);


  return (
    <group>
      {/* City Buildings (Reflective Glass) */}
      <instancedMesh 
        ref={meshRef} 
        args={[geometry, undefined, BUILDING_COUNT]} 
        castShadow 
        receiveShadow
      >
        <meshPhysicalMaterial
          roughness={0.1}
          metalness={0.8}
          transmission={controls.transmission}
          thickness={2.0}
          ior={1.5}
          clearcoat={1.0}
          clearcoatRoughness={0.1}
          envMapIntensity={2.0}
          onBeforeCompile={handleBeforeCompile}
        />
      </instancedMesh>

      {/* Ground Plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshPhysicalMaterial 
          color="#050505" 
          roughness={0.05} 
          metalness={0.9} 
          clearcoat={1.0}
        />
      </mesh>
    </group>
  );
}

function HolographicScene({debug, controls}: {debug: boolean; controls: any}) {
  return (
    <DemoScene
      debug={debug}
      engineConfig={{
        background: '#010203', 
        camera: {fov: 45, far: 120, near: 0.1, position: [0, 40, 90]},
        fog: {color: '#001122', near: 10, far: 95},
      }}
      orbitConfig={{
        enablePan: true,
        autoRotate: controls.autoRotate ?? false,
        autoRotateSpeed: 0.5,
        maxDistance: 100,
      }}
    >
      <Environment preset="city" />
      
      {/* Directional Moonlight */}
      <directionalLight 
        position={[20, 30, -20]} 
        intensity={2.5} 
        color="#aaccff" 
        castShadow 
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={100}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-bias={-0.0005}
      />
      
      {/* Fill Light */}
      <ambientLight intensity={0.5} color="#0055ff" />

      {/* Cyber Neon Accents */}
      <pointLight position={[0, 5, 0]} intensity={100.0} color="#ff00aa" distance={30} decay={2} />
      <pointLight position={[15, 2, 15]} intensity={50.0} color="#00ffcc" distance={20} decay={2} />
      <pointLight position={[-15, 5, -10]} intensity={80.0} color="#ffff00" distance={25} decay={2} />

      <PhysicalCity controls={controls} />
    </DemoScene>
  );
}

export default function Demo() {
  const {showStats} = useControls('Debug', {showStats: false});
  const cityControls = useControls('Cyber City', {
    autoRotate: false,
    scanColor: '#00ffff',
    scanSpeed: { value: 35.0, min: 0.0, max: 150.0, step: 1.0 },
    scanWidth: { value: 1.5, min: 0.1, max: 10.0, step: 0.1 },
    gridDensity: { value: 1.5, min: 0.1, max: 5.0, step: 0.1 },
    transmission: { value: 0.9, min: 0.0, max: 1.0, step: 0.05 },
  });

  return <HolographicScene debug={showStats} controls={cityControls} />;
}
