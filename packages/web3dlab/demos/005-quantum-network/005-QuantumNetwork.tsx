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
    // Use an elongated BoxGeometry to create the trail/shuttle shape natively
    const geo = new THREE.BoxGeometry(0.015, 0.015, 1.0);
    const instancedGeo = new THREE.InstancedBufferGeometry();
    instancedGeo.copy(geo as unknown as THREE.InstancedBufferGeometry);
    instancedGeo.instanceCount = PACKET_COUNT;
    instancedGeo.setAttribute('aSource', new THREE.InstancedBufferAttribute(networkData.packetSources, 3));
    instancedGeo.setAttribute('aTarget', new THREE.InstancedBufferAttribute(networkData.packetTargets, 3));
    instancedGeo.setAttribute('aDistance', new THREE.InstancedBufferAttribute(networkData.packetDists, 1));
    instancedGeo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(networkData.packetOffsets, 1));
    return instancedGeo;
  }, [networkData]);

  const nodeUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uDriftChaos: { value: 0.2 },
  }), []);

  const packetUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uDataSpeed: { value: 1.5 },
    uConnectionRadius: { value: MAX_CONNECTION_DIST },
    uDriftChaos: { value: 0.2 },
  }), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    nodeUniforms.uTime.value = t;
    nodeUniforms.uDriftChaos.value = controls.driftChaos;

    packetUniforms.uTime.value = t;
    packetUniforms.uDataSpeed.value = controls.packetSpeed;
    packetUniforms.uDriftChaos.value = controls.driftChaos;
  });

  const onNodesBeforeCompile = (shader: any) => {
    shader.uniforms.uTime = nodeUniforms.uTime;
    shader.uniforms.uDriftChaos = nodeUniforms.uDriftChaos;

    shader.vertexShader = `
      uniform float uTime;
      uniform float uDriftChaos;
      attribute vec3 aNodePos;
      varying float vAlpha;
    ` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      vec3 transformed = position;

      float distFromCenter = length(aNodePos);
      float breath = sin(uTime * 1.5 - distFromCenter * 0.5) * 0.5 + 0.5;
      float scale = 1.0 + breath * 0.3;
      transformed *= scale;

      // Organic Drift
      vec3 drift = vec3(
        sin(uTime * 0.3 + aNodePos.z * 1.5),
        cos(uTime * 0.2 + aNodePos.x * 1.5),
        sin(uTime * 0.4 + aNodePos.y * 1.5)
      ) * uDriftChaos;

      transformed += aNodePos + drift;

      float edgeFade = smoothstep(12.0, 8.0, distFromCenter);
      vAlpha = edgeFade * (0.3 + breath * 0.7);
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
    shader.uniforms.uDriftChaos = packetUniforms.uDriftChaos;

    shader.vertexShader = `
      uniform float uTime;
      uniform float uDataSpeed;
      uniform float uConnectionRadius;
      uniform float uDriftChaos;

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

         // Apply same organic drift to source and target so packets ride the moving lines accurately
         vec3 sDrift = vec3(sin(uTime * 0.3 + aSource.z * 1.5), cos(uTime * 0.2 + aSource.x * 1.5), sin(uTime * 0.4 + aSource.y * 1.5)) * uDriftChaos;
         vec3 tDrift = vec3(sin(uTime * 0.3 + aTarget.z * 1.5), cos(uTime * 0.2 + aTarget.x * 1.5), sin(uTime * 0.4 + aTarget.y * 1.5)) * uDriftChaos;
         vec3 sPos = aSource + sDrift;
         vec3 tPos = aTarget + tDrift;

         vec3 p = mix(sPos, tPos, progress);

         // Orient packet along the moved line
         vec3 dir = normalize(tPos - sPos);
         vec3 up = vec3(0.0, 1.0, 0.0);
         if (abs(dir.y) > 0.999) up = vec3(1.0, 0.0, 0.0);
         vec3 right = normalize(cross(up, dir));
         up = cross(dir, right);
         mat3 rot = mat3(right, up, dir);

         // Stretch based on speed and add attenuation shape logic
         // position.z natively ranges from -0.5 to 0.5 for a length 1.0 BoxGeometry
         float shapeFade = smoothstep(0.5, 0.0, abs(position.z));

         transformed.z *= max(uDataSpeed * 1.5, 1.0); // Dynamic length
         transformed = rot * transformed + p;

         float edgeFade = smoothstep(0.0, 0.1, progress) * smoothstep(1.0, 0.9, progress);
         float distFade = smoothstep(uConnectionRadius, uConnectionRadius * 0.5, aDistance);
         vAlpha = edgeFade * distFade * shapeFade;
      }
      `
    );

    shader.fragmentShader = `
      varying float vAlpha;
    ` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      'vec4 diffuseColor = vec4( diffuse, opacity );',
      `
      // Make packets hyper emissive core with faded edges
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
          extraUniforms={{
            uConnectionRadius: { value: MAX_CONNECTION_DIST }
          }}
          vertexShader={linesVert}
          fragmentShader={linesFrag}
          transparent={true}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>

      {/* Data Packets (Light Shuttles) */}
      <instancedMesh args={[packetsGeometry, undefined, PACKET_COUNT]} frustumCulled={false}>
        <meshBasicMaterial
          color={controls.packetColor}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          onBeforeCompile={onPacketsBeforeCompile}
        />
      </instancedMesh>

      {/* Organic Nodes (Glowing Core) */}
      <instancedMesh args={[nodesGeometry, undefined, NODE_COUNT]} frustumCulled={false}>
        <meshPhysicalMaterial
          color={controls.networkColor}
          emissive={controls.networkColor}
          emissiveIntensity={2.5}
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

function HolographicScene({controls}: {controls: any}) {
  return (
    <DemoScene
      engineConfig={{
        background: '#010308',
        camera: {fov: 45, far: 80, near: 0.1, position: [0, 0, 20]},
        // Targeted Bloom: High threshold ensures only emissive nodes and additive packets glow, while lines remain dim
        bloom: { intensity: 2.5, luminanceThreshold: controls.bloomThreshold, luminanceSmoothing: 0.2 }
      }}
      orbitConfig={{
        enablePan: true,
        autoRotate: true,
        autoRotateSpeed: 0.5,
      }}
    >
      <Environment preset="studio" />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 10]} intensity={1.5} />

      <CyberNetwork controls={controls} />
    </DemoScene>
  );
}

export default function Demo005QuantumNetwork() {
  const networkControls = useControls('Physical Quantum Network', {
    synapseGlow: { value: 0.4, min: 0.0, max: 2.0, step: 0.05 },
    packetSpeed: { value: 1.5, min: 0.1, max: 10.0, step: 0.1 },
    driftChaos: { value: 0.2, min: 0.0, max: 2.0, step: 0.05 },
    bloomThreshold: { value: 0.85, min: 0.0, max: 1.0, step: 0.01 },
    networkColor: '#0055ff', // Deep cyber blue
    packetColor: '#00ffff',  // Cyan packets
  });

  return <HolographicScene controls={networkControls} />;
}
