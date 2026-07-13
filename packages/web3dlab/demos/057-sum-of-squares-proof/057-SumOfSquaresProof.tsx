import {useFrame} from '@react-three/fiber';
import {useControls} from 'leva';
import {useEffect, useMemo, useRef, useState} from 'react';
import * as THREE from 'three';

import {DemoScene} from '../../core/DemoScene';

type ProofControls = {
  n: number;
  examinedK: number;
  explodeShell: number;
  cubeGap: number;
  rotationSpeed: number;
};

type CubeDatum = {color: string; position: THREE.Vector3};

const LAYER_COLORS = ['#5eead4', '#38bdf8', '#818cf8', '#c084fc', '#f472b6', '#fb7185', '#f59e0b', '#eab308', '#84cc16'];

function createSquarePyramid(n: number): CubeDatum[] {
  const cell = 0.25;
  const cubes: CubeDatum[] = [];
  for (let k = 1; k <= n; k++) {
    for (let x = 0; x < k; x++) {
      for (let z = 0; z < k; z++) {
        cubes.push({
          color: LAYER_COLORS[(k - 1) % LAYER_COLORS.length],
          position: new THREE.Vector3(
            (x - (k - 1) / 2) * cell,
            (n - k) * cell - (n - 1) * cell * 0.45,
            (z - (k - 1) / 2) * cell,
          ),
        });
      }
    }
  }
  return cubes;
}

function createCubeShell(k: number, explode: number): CubeDatum[] {
  const cell = 0.25;
  const center = k / 2;
  const cubes: CubeDatum[] = [];
  for (let x = 0; x <= k; x++) {
    for (let y = 0; y <= k; y++) {
      for (let z = 0; z <= k; z++) {
        const boundaryCount = Number(x === k) + Number(y === k) + Number(z === k);
        if (boundaryCount === 0) continue;
        const direction = new THREE.Vector3(Number(x === k), Number(y === k), Number(z === k)).normalize();
        const color = boundaryCount === 1 ? '#49d9ff' : boundaryCount === 2 ? '#ffad42' : '#ffffff';
        cubes.push({
          color,
          position: new THREE.Vector3((x - center) * cell, (y - center) * cell, (z - center) * cell)
            .addScaledVector(direction, explode * 0.34),
        });
      }
    }
  }
  return cubes;
}

function CubeInstances({cubes, cubeGap}: {cubes: CubeDatum[]; cubeGap: number}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    if (!meshRef.current) return;
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    cubes.forEach((cube, index) => {
      matrix.compose(cube.position, new THREE.Quaternion(), new THREE.Vector3().setScalar(cubeGap));
      meshRef.current?.setMatrixAt(index, matrix);
      meshRef.current?.setColorAt(index, color.set(cube.color));
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [cubeGap, cubes]);
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, cubes.length]} frustumCulled={false}>
      <boxGeometry args={[0.225, 0.225, 0.225]} />
      <meshStandardMaterial metalness={0.24} roughness={0.34} vertexColors />
    </instancedMesh>
  );
}

function ProofGeometry({controls, proofStep}: {controls: ProofControls; proofStep: number}) {
  const groupRef = useRef<THREE.Group>(null);
  const k = Math.min(controls.n, Math.max(1, Math.round(controls.examinedK)));
  const pyramid = useMemo(() => createSquarePyramid(Math.round(controls.n)), [controls.n]);
  const shell = useMemo(() => createCubeShell(k, controls.explodeShell), [controls.explodeShell, k]);

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * controls.rotationSpeed * 0.2;
  });

  const sideBySide = proofStep > 0;
  return (
    <group ref={groupRef} rotation={[-0.2, -0.35, 0]}>
      <group position={[sideBySide ? -1.65 : 0, -0.2, 0]}>
        <CubeInstances cubeGap={controls.cubeGap} cubes={pyramid} />
      </group>
      {sideBySide && (
        <group position={[1.65, 0, 0]}>
          <CubeInstances cubeGap={controls.cubeGap} cubes={shell} />
        </group>
      )}
    </group>
  );
}

const PROOF_STEPS = [
  {equation: 'S₂(n) = 1² + 2² + ··· + n²', note: 'The stepped solid contains exactly k² cubes in layer k.'},
  {equation: '(k+1)³ − k³ = 3k² + 3k + 1', note: 'Cyan: three faces · Amber: three edges · White: one corner.'},
  {equation: '(n+1)³ − 1 = 3S₂(n) + 3Σk + n', note: 'Summing the shells telescopes every cubic difference.'},
  {equation: 'S₂(n) = n(n+1)(2n+1) / 6', note: 'Substitute Σk = n(n+1)/2 and isolate S₂(n).'},
];

export default function Demo057SumOfSquaresProof() {
  const [proofStep, setProofStep] = useState(0);
  const controls = useControls('Sum of Squares Proof', {
    n: {value: 6, min: 2, max: 9, step: 1, label: 'Upper bound n'},
    examinedK: {value: 5, min: 1, max: 9, step: 1, label: 'Shell index k'},
    explodeShell: {value: 0.22, min: 0, max: 0.9, step: 0.01, label: 'Shell separation'},
    cubeGap: {value: 0.9, min: 0.62, max: 1, step: 0.01, label: 'Cube packing'},
    rotationSpeed: {value: 0.14, min: 0, max: 0.55, step: 0.01, label: 'Proof rotation'},
  }) as ProofControls;
  const k = Math.min(controls.n, Math.max(1, Math.round(controls.examinedK)));

  return (
    <div className="demo-viewport" style={{position: 'relative', background: '#05070b'}}>
      <DemoScene
        engineConfig={{
          background: '#05070b', bloom: {intensity: 0.28, luminanceSmoothing: 0.65, luminanceThreshold: 0.62},
          camera: {position: [0, 1.4, 7.4], fov: 42, near: 0.1, far: 30}, fog: {color: '#05070b', near: 10, far: 18},
        }}
        orbitConfig={{autoRotate: false, enablePan: false, minDistance: 5, maxDistance: 11}}
      >
        <ambientLight intensity={0.52} />
        <directionalLight color="#e6f4ff" intensity={2.2} position={[4, 6, 5]} />
        <pointLight color="#6ddcff" intensity={0.7} position={[-3, 1, 2]} />
        <ProofGeometry controls={controls} proofStep={proofStep} />
      </DemoScene>
      <div style={proofEquationStyle}>
        <strong>{PROOF_STEPS[proofStep].equation}</strong>
        <span>{PROOF_STEPS[proofStep].note}</span>
        {proofStep === 1 && <span>k={k}: {3 * k * k} + {3 * k} + 1 = {(k + 1) ** 3 - k ** 3} cubes</span>}
      </div>
      <div style={proofTransportStyle}>
        <button disabled={proofStep === 0} onClick={() => setProofStep(step => Math.max(0, step - 1))} style={proofButtonStyle} type="button">Previous</button>
        <span>STEP {proofStep + 1} / {PROOF_STEPS.length}</span>
        <button disabled={proofStep === PROOF_STEPS.length - 1} onClick={() => setProofStep(step => Math.min(PROOF_STEPS.length - 1, step + 1))} style={proofButtonStyle} type="button">Next</button>
      </div>
    </div>
  );
}

const proofEquationStyle = {
  position: 'absolute', top: 18, left: '50%', display: 'grid', gap: 4, width: 'min(680px, calc(100vw - 36px))',
  transform: 'translateX(-50%)', padding: '10px 13px', border: '1px solid rgba(146,201,235,0.18)',
  borderRadius: 6, background: 'rgba(5,8,13,0.78)', color: '#8fa6b5', textAlign: 'center', pointerEvents: 'none',
  fontFamily: '"SFMono-Regular", Menlo, Consolas, monospace', fontSize: 11,
} as const;

const proofTransportStyle = {
  position: 'absolute', left: '50%', bottom: 18, display: 'flex', alignItems: 'center', gap: 10,
  transform: 'translateX(-50%)', padding: 7, border: '1px solid rgba(146,201,235,0.18)', borderRadius: 6,
  background: 'rgba(5,8,13,0.82)', color: '#8299a8', fontFamily: '"SFMono-Regular", Menlo, Consolas, monospace', fontSize: 10,
} as const;

const proofButtonStyle = {
  border: '1px solid rgba(99,205,247,0.26)', borderRadius: 5, background: 'rgba(99,205,247,0.07)',
  color: '#dbf4ff', cursor: 'pointer', padding: '7px 10px', font: 'inherit', fontWeight: 700,
} as const;
