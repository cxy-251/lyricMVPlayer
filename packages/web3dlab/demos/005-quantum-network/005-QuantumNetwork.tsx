import {useControls} from 'leva';
import {useMemo, useRef} from 'react';
import * as THREE from 'three';
import {useFrame} from '@react-three/fiber';
import {Environment} from '@react-three/drei';

import {AutoShaderMaterial} from '../../core/AutoShaderMaterial';
import {DemoScene} from '../../core/DemoScene';

import linesFrag from './shaders/lines.frag?raw';
import linesVert from './shaders/lines.vert?raw';

const NODE_COUNT = 800;
const MAX_CONNECTION_DIST = 4.0;
const PACKET_COUNT = 25000;

function CyberNetwork({controls}: {controls: any}) {
  const networkData = useMemo(() => {
    const nodes: THREE.Vector3[] = [];
    
    // 1. Generate Nodes in a Sphere
    for (let i = 0; i < NODE_COUNT; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = 2.0 * Math.PI * u;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = Math.cbrt(Math.random()) * 10.0; // 10.0 radius sphere

      nodes.push(
        new THREE.Vector3(
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.sin(phi) * Math.sin(theta),
          r * Math.cos(phi)
        )
      );
    }

    // 2. Generate Line Segments (Synapses)
    const linePos = [];
    const lineDist = [];
    
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const d = nodes[i].distanceTo(nodes[j]);
        if (d < MAX_CONNECTION_DIST) {
          linePos.push(nodes[i].x, nodes[i].y, nodes[i].z);
          linePos.push(nodes[j].x, nodes[j].y, nodes[j].z);
          lineDist.push(d, d);
        }
      }
    }
    
    // 3. Generate Data Packets
    const packetSources = [];
    const packetTargets = [];
    const packetDists = [];
    const packetOffsets = [];
    
    const validLinesCount = lineDist.length / 2;
    
    for (let i = 0; i < PACKET_COUNT; i++) {
      const randLine = Math.floor(Math.random() * validLinesCount);
      const startIdx = randLine * 6;
      
      packetSources.push(linePos[startIdx], linePos[startIdx+1], linePos[startIdx+2]);
      packetTargets.push(linePos[startIdx+3], linePos[startIdx+4], linePos[startIdx+5]);
      packetDists.push(lineDist[randLine * 2]);
      packetOffsets.push(Math.random()); // Phase offset
    }

    return {
      linePos: new Float32Array(linePos),
      lineDist: new Float32Array(lineDist),
      packetSources: new Float32Array(packetSources),
      packetTargets: new Float32Array(packetTargets),
      packetDists: new Float32Array(packetDists),
      packetOffsets: new Float32Array(packetOffsets),
      nodesPos: new Float32Array(nodes.flatMap(n => [n.x, n.y, n.z]))
    };
  }, []);

  const nodesGeometry = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(0.12, 1);
    const instancedGeo = new THREE.InstancedBufferGeometry();
    instancedGeo.copy(geo as unknown as THREE.InstancedBufferGeometry);
    instancedGeo.instanceCount = NODE_COUNT;
    instancedGeo.setAttribute('aNodePos', new THREE.InstancedBufferAttribute(networkData.nodesPos, 3));
    return instancedGeo;
  }, [networkData]);

  const packetsGeometry = useMemo(() => {
    const geo = new THREE.TetrahedronGeometry(0.04, 0);
    const instancedGeo = new THREE.InstancedBufferGeometry();
    instancedGeo.copy(geo as unknown as THREE.InstancedBufferGeometry);
    instancedGeo.instanceCount = PACKET_COUNT;
    instancedGeo.setAttribute('aSource', new THREE.InstancedBufferAttribute(networkData.packetSources, 3));
    instancedGeo.setAttribute('aTarget', new THREE.InstancedBufferAttribute(networkData.packetTargets, 3));
    instancedGeo.setAttribute('aDistance', new THREE.InstancedBufferAttribute(networkData.packetDists, 1));
    instancedGeo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(networkData.packetOffsets, 1));
    return instancedGeo;
  }, [networkData]);

  // 完美修复：在组件顶层构建持久化的 Uniforms 字典，彻底消灭基于 Ref 的竞态条件
  const nodeUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uPulseSpeed: { value: 2.0 },
  }), []);

  const packetUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uDataSpeed: { value: 2.0 },
    uConnectionRadius: { value: 2.2 },
  }), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // 直接更新内存字典中的值，无视材质是否已完成编译
    nodeUniforms.uTime.value = t;
    nodeUniforms.uPulseSpeed.value = controls.pulseSpeed;
    
    packetUniforms.uTime.value = t;
    packetUniforms.uDataSpeed.value = controls.dataSpeed;
    packetUniforms.uConnectionRadius.value = controls.connectionRadius;
  });

  const onNodesBeforeCompile = (shader: any) => {
    // 渲染器编译时，直接将指针挂载到持久化的内存字典上
    shader.uniforms.uTime = nodeUniforms.uTime;
    shader.uniforms.uPulseSpeed = nodeUniforms.uPulseSpeed;

    shader.vertexShader = `
      uniform float uTime;
      uniform float uPulseSpeed;
      attribute vec3 aNodePos;
      varying float vAlpha;
    ` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      vec3 transformed = position;
      
      float distFromCenter = length(aNodePos);
      float breath = sin(uTime * uPulseSpeed - distFromCenter * 0.5) * 0.5 + 0.5;
      float scale = 1.0 + breath * 0.3;
      transformed *= scale;
      
      transformed += aNodePos;
      
      float edgeFade = smoothstep(12.0, 8.0, distFromCenter);
      vAlpha = edgeFade * (0.2 + breath * 0.8);
      `
    );

    shader.fragmentShader = `
      varying float vAlpha;
    ` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      'vec4 diffuseColor = vec4( diffuse, opacity );',
      `
      vec4 diffuseColor = vec4( diffuse, opacity * vAlpha );
      `
    );
  };

  const onPacketsBeforeCompile = (shader: any) => {
    shader.uniforms.uTime = packetUniforms.uTime;
    shader.uniforms.uDataSpeed = packetUniforms.uDataSpeed;
    shader.uniforms.uConnectionRadius = packetUniforms.uConnectionRadius;

    shader.vertexShader = `
      uniform float uTime;
      uniform float uDataSpeed;
      uniform float uConnectionRadius;
      
      attribute vec3 aSource;
      attribute vec3 aTarget;
      attribute float aDistance;
      attribute float aOffset;
      
      varying float vAlpha;
    ` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      vec3 transformed = position;
      
      if (aDistance > uConnectionRadius) {
         transformed = vec3(9999.0); // Hide if line is too long
         vAlpha = 0.0;
      } else {
         float progress = fract(uTime * uDataSpeed * (1.0 / max(aDistance, 0.5)) + aOffset);
         vec3 p = mix(aSource, aTarget, progress);
         
         // Orient packet along the line
         vec3 dir = normalize(aTarget - aSource);
         vec3 up = vec3(0.0, 1.0, 0.0);
         if (abs(dir.y) > 0.999) up = vec3(1.0, 0.0, 0.0);
         vec3 right = normalize(cross(up, dir));
         up = cross(dir, right);
         mat3 rot = mat3(right, up, dir);
         
         transformed.z *= 2.0; // stretch along direction
         transformed = rot * transformed + p;
         
         float edgeFade = smoothstep(0.0, 0.1, progress) * smoothstep(1.0, 0.9, progress);
         float distFade = smoothstep(uConnectionRadius, uConnectionRadius * 0.5, aDistance);
         vAlpha = edgeFade * distFade;
      }
      `
    );

    shader.fragmentShader = `
      varying float vAlpha;
    ` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      'vec4 diffuseColor = vec4( diffuse, opacity );',
      `
      vec4 diffuseColor = vec4( diffuse, opacity * vAlpha );
      `
    );
  };

  return (
    <group>
      {/* Network Lines */}
      <lineSegments frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[networkData.linePos, 3]} />
          <bufferAttribute attach="attributes-aDistance" args={[networkData.lineDist, 1]} />
        </bufferGeometry>
        <AutoShaderMaterial
          controls={controls}
          vertexShader={linesVert}
          fragmentShader={linesFrag}
        />
      </lineSegments>

      {/* Data Packets (Physical Crystals) */}
      <instancedMesh args={[packetsGeometry, undefined, PACKET_COUNT]} frustumCulled={false}>
        <meshPhysicalMaterial
          color={controls.packetColor}
          emissive={controls.packetColor}
          emissiveIntensity={0.5}
          roughness={0.1}
          metalness={0.8}
          transmission={0.9}
          ior={1.5}
          transparent
          depthWrite={false}
          onBeforeCompile={onPacketsBeforeCompile}
        />
      </instancedMesh>

      {/* Static Nodes (Physical Glass Spheres) */}
      <instancedMesh args={[nodesGeometry, undefined, NODE_COUNT]} frustumCulled={false}>
        <meshPhysicalMaterial
          color={controls.networkColor}
          roughness={0.1}
          metalness={0.8}
          transmission={0.9}
          ior={1.5}
          thickness={0.5}
          transparent
          depthWrite={false}
          onBeforeCompile={onNodesBeforeCompile}
        />
      </instancedMesh>
    </group>
  );
}

function HolographicScene({debug, controls}: {debug: boolean; controls: any}) {
  return (
    <DemoScene
      debug={debug}
      engineConfig={{
        background: '#010308', 
        camera: {fov: 45, far: 80, near: 0.1, position: [0, 0, 20]}, 
      }}
      orbitConfig={{
        enablePan: true,
        autoRotate: true,
        autoRotateSpeed: 0.5,
      }}
    >
      <Environment preset="studio" />
      <ambientLight intensity={1.0} />
      <directionalLight position={[10, 10, 10]} intensity={3.0} />
      
      <CyberNetwork controls={controls} />
    </DemoScene>
  );
}

export default function Demo005QuantumNetwork() {
  const {showStats} = useControls('Debug', {showStats: false});
  const networkControls = useControls('Physical Quantum Network', {
    connectionRadius: { value: 2.2, min: 0.5, max: 4.0, step: 0.1 },
    dataSpeed: { value: 2.0, min: 0.1, max: 10.0, step: 0.1 },
    pulseSpeed: { value: 2.0, min: 0.1, max: 5.0, step: 0.1 },
    networkColor: '#0055ff', // Deep cyber blue
    packetColor: '#00ffff',  // Cyan packets
  });

  return <HolographicScene debug={showStats} controls={networkControls} />;
}
