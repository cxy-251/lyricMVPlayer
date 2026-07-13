import {useFrame} from '@react-three/fiber';
import {useControls} from 'leva';
import {useRef, useState} from 'react';
import type {MutableRefObject, RefObject} from 'react';
import * as THREE from 'three';

import {DemoScene} from '../../core/DemoScene';

type SequenceControls = {
  duration: number;
  transition: number;
  focalScale: number;
  cameraShake: number;
  sculptureSpeed: number;
  lightPulse: number;
  bloom: number;
};

type Shot = {
  fov: number;
  name: string;
  position: THREE.Vector3;
  start: number;
  target: THREE.Vector3;
};

const SHOTS: Shot[] = [
  {fov: 44, name: 'ESTABLISH', position: new THREE.Vector3(6.2, 2.4, 7.3), start: 0, target: new THREE.Vector3(0, 0.45, 0)},
  {fov: 39, name: 'ORBIT LEFT', position: new THREE.Vector3(-4.8, 1.35, 4.5), start: 0.21, target: new THREE.Vector3(0, 0.3, 0)},
  {fov: 27, name: 'MACRO CORE', position: new THREE.Vector3(0.9, 0.45, 2.75), start: 0.43, target: new THREE.Vector3(0, 0.42, 0)},
  {fov: 48, name: 'OVERHEAD', position: new THREE.Vector3(0.12, 6.7, 0.18), start: 0.64, target: new THREE.Vector3(0, 0, 0)},
  {fov: 52, name: 'PULL BACK', position: new THREE.Vector3(-6.3, 2.8, 7.4), start: 0.82, target: new THREE.Vector3(0, 0.55, 0)},
];

function shotAt(progress: number) {
  let index = SHOTS.length - 1;
  for (let shotIndex = 0; shotIndex < SHOTS.length; shotIndex++) {
    const nextStart = SHOTS[shotIndex + 1]?.start ?? 1;
    if (progress >= SHOTS[shotIndex].start && progress < nextStart) {
      index = shotIndex;
      break;
    }
  }
  const current = SHOTS[index];
  const next = SHOTS[(index + 1) % SHOTS.length];
  const end = index === SHOTS.length - 1 ? 1 : next.start;
  return {current, end, index, next, local: (progress - current.start) / Math.max(0.001, end - current.start)};
}

function CameraSequence({
  controls,
  inputRef,
  labelRef,
  playing,
  progressRef,
}: {
  controls: SequenceControls;
  inputRef: RefObject<HTMLInputElement | null>;
  labelRef: RefObject<HTMLSpanElement | null>;
  playing: boolean;
  progressRef: MutableRefObject<number>;
}) {
  useFrame((state, delta) => {
    if (playing) progressRef.current = (progressRef.current + delta / controls.duration) % 1;
    const progress = progressRef.current;
    const shot = shotAt(progress);
    const hold = 1 - controls.transition * 0.72;
    const transitionT = THREE.MathUtils.smoothstep(shot.local, hold, 1);
    const position = shot.current.position.clone().lerp(shot.next.position, transitionT);
    const target = shot.current.target.clone().lerp(shot.next.target, transitionT);
    const shakeEnvelope = Math.sin(shot.local * Math.PI) * controls.cameraShake;
    position.x += Math.sin(state.clock.elapsedTime * 17.3) * shakeEnvelope;
    position.y += Math.sin(state.clock.elapsedTime * 13.7) * shakeEnvelope * 0.55;
    target.x += Math.sin(state.clock.elapsedTime * 9.1) * shakeEnvelope * 0.16;
    state.camera.position.copy(position);
    state.camera.lookAt(target);
    const perspective = state.camera as THREE.PerspectiveCamera;
    const fov = THREE.MathUtils.lerp(shot.current.fov, shot.next.fov, transitionT) * controls.focalScale;
    if (Math.abs(perspective.fov - fov) > 0.01) {
      perspective.fov = fov;
      perspective.updateProjectionMatrix();
    }
    if (inputRef.current) inputRef.current.value = String(Math.round(progress * 1000));
    if (labelRef.current) labelRef.current.textContent = shot.current.name;
  });
  return null;
}

function KineticMonument({controls}: {controls: SequenceControls}) {
  const groupRef = useRef<THREE.Group>(null);
  const ringARef = useRef<THREE.Mesh>(null);
  const ringBRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((state, delta) => {
    const speed = controls.sculptureSpeed;
    if (groupRef.current) groupRef.current.rotation.y += delta * speed * 0.18;
    if (ringARef.current) ringARef.current.rotation.x += delta * speed * 0.42;
    if (ringBRef.current) ringBRef.current.rotation.z -= delta * speed * 0.34;
    if (coreRef.current) coreRef.current.emissiveIntensity = 0.38 + (0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 1.7)) * controls.lightPulse * 0.8;
  });
  return (
    <group ref={groupRef} position={[0, 0.45, 0]}>
      <mesh>
        <icosahedronGeometry args={[0.78, 5]} />
        <meshStandardMaterial ref={coreRef} color="#263746" emissive="#56d8ff" emissiveIntensity={0.5} metalness={0.86} roughness={0.2} />
      </mesh>
      <mesh ref={ringARef} rotation={[0.9, 0.1, 0.3]}>
        <torusGeometry args={[1.28, 0.045, 12, 128]} />
        <meshStandardMaterial color="#70e2ff" emissive="#2ccfff" emissiveIntensity={1.2} metalness={0.7} roughness={0.18} />
      </mesh>
      <mesh ref={ringBRef} rotation={[0.2, 1.1, -0.4]}>
        <torusGeometry args={[1.62, 0.032, 10, 128]} />
        <meshStandardMaterial color="#ff6cae" emissive="#ff3f91" emissiveIntensity={1.05} metalness={0.72} roughness={0.18} />
      </mesh>
      {Array.from({length: 8}, (_, index) => {
        const angle = index / 8 * Math.PI * 2;
        return (
          <mesh key={index} position={[Math.cos(angle) * 2.05, -0.12 + (index % 2) * 0.22, Math.sin(angle) * 2.05]}>
            <boxGeometry args={[0.14, 0.9 + (index % 3) * 0.28, 0.14]} />
            <meshStandardMaterial color={index % 2 ? '#33233c' : '#183747'} emissive={index % 2 ? '#b33f91' : '#2bacc8'} emissiveIntensity={0.35} metalness={0.6} roughness={0.34} />
          </mesh>
        );
      })}
    </group>
  );
}

export default function Demo058CinematicStyleSequence() {
  const progressRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const [playing, setPlaying] = useState(true);
  const controls = useControls('Camera Sequence', {
    duration: {value: 18, min: 8, max: 32, step: 1, label: 'Sequence duration'},
    transition: {value: 0.58, min: 0.15, max: 1, step: 0.01, label: 'Shot transition'},
    focalScale: {value: 1, min: 0.72, max: 1.28, step: 0.01, label: 'Focal-length scale'},
    cameraShake: {value: 0.012, min: 0, max: 0.055, step: 0.001, label: 'Camera vibration'},
    sculptureSpeed: {value: 0.72, min: 0.1, max: 1.4, step: 0.01, label: 'Monument motion'},
    lightPulse: {value: 0.62, min: 0, max: 1.2, step: 0.01, label: 'Core light pulse'},
    bloom: {value: 0.62, min: 0.2, max: 1.1, step: 0.01, label: 'Lens bloom'},
  }) as SequenceControls;

  return (
    <div className="demo-viewport" style={{position: 'relative', background: '#03050a'}}>
      <DemoScene
        engineConfig={{
          background: '#03050a', bloom: {intensity: controls.bloom, luminanceSmoothing: 0.68, luminanceThreshold: 0.42},
          camera: {position: [6.2, 2.4, 7.3], fov: 44, near: 0.1, far: 40}, fog: {color: '#03050a', near: 11, far: 22},
          vignette: {darkness: 0.5, offset: 0.28},
        }}
        orbitControls={false}
      >
        <ambientLight intensity={0.3} />
        <pointLight color="#a9eaff" intensity={2.4} position={[3, 4, 4]} />
        <pointLight color="#ff559e" intensity={1.3} position={[-4, 1, 2]} />
        <gridHelper args={[18, 36, '#183447', '#0d1923']} position={[0, -0.58, 0]} />
        <KineticMonument controls={controls} />
        <CameraSequence controls={controls} inputRef={inputRef} labelRef={labelRef} playing={playing} progressRef={progressRef} />
      </DemoScene>
      <div style={sequenceTransportStyle}>
        <button onClick={() => setPlaying(value => !value)} style={sequenceButtonStyle} type="button">{playing ? 'Pause' : 'Play'}</button>
        <button onClick={() => { progressRef.current = 0; setPlaying(true); }} style={sequenceButtonStyle} type="button">Restart</button>
        <input
          ref={inputRef}
          aria-label="Sequence timeline"
          defaultValue={0}
          max={1000}
          min={0}
          onInput={(event) => {
            progressRef.current = Number(event.currentTarget.value) / 1000;
            setPlaying(false);
          }}
          style={{width: 'min(36vw, 360px)'}}
          type="range"
        />
        <span ref={labelRef} style={{minWidth: 76, color: '#d7f3ff'}}>ESTABLISH</span>
      </div>
      <div style={shotMarksStyle}>{SHOTS.map(shot => <span key={shot.name}>{shot.name}</span>)}</div>
    </div>
  );
}

const sequenceTransportStyle = {
  position: 'absolute', left: '50%', bottom: 24, display: 'flex', alignItems: 'center', gap: 9,
  transform: 'translateX(-50%)', padding: 7, border: '1px solid rgba(109,216,255,0.18)', borderRadius: 6,
  background: 'rgba(3,7,13,0.84)', color: '#7f99a8', fontFamily: '"SFMono-Regular", Menlo, Consolas, monospace', fontSize: 10,
} as const;

const sequenceButtonStyle = {
  border: '1px solid rgba(109,216,255,0.26)', borderRadius: 5, background: 'rgba(109,216,255,0.07)',
  color: '#d8f5ff', cursor: 'pointer', padding: '7px 9px', font: 'inherit', fontWeight: 700,
} as const;

const shotMarksStyle = {
  position: 'absolute', left: '50%', bottom: 8, display: 'flex', justifyContent: 'space-between',
  width: 'min(52vw, 520px)', transform: 'translateX(-50%)', color: 'rgba(126,153,169,0.55)',
  pointerEvents: 'none', fontFamily: '"SFMono-Regular", Menlo, Consolas, monospace', fontSize: 8,
} as const;
