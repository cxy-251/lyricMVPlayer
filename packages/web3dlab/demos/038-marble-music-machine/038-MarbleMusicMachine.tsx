import {useFrame} from '@react-three/fiber';
import {useControls} from 'leva';
import {useCallback, useMemo, useRef, useState} from 'react';
import type {MutableRefObject} from 'react';
import * as THREE from 'three';

import {DemoScene} from '../../core/DemoScene';

type MarbleControls = {
  tempo: number;
  marbles: number;
  impactGlow: number;
  noteLength: number;
};

type BellDatum = {
  color: string;
  frequency: number;
  note: string;
  phase: number;
};

const BELLS: BellDatum[] = [
  {color: '#ffb45c', frequency: 130.81, note: 'C3', phase: 0.035},
  {color: '#ffd56a', frequency: 164.81, note: 'E3', phase: 0.105},
  {color: '#a7e878', frequency: 196, note: 'G3', phase: 0.175},
  {color: '#72dff2', frequency: 246.94, note: 'B3', phase: 0.245},
  {color: '#8ba7ff', frequency: 293.66, note: 'D4', phase: 0.315},
  {color: '#d18fff', frequency: 220, note: 'A3', phase: 0.385},
];

const PATH_POINTS = [
  new THREE.Vector3(-2.45, 1.42, 0),
  new THREE.Vector3(-1.72, 0.76, 0.08),
  new THREE.Vector3(-0.92, 1.02, -0.06),
  new THREE.Vector3(-0.12, 0.2, 0.1),
  new THREE.Vector3(0.7, 0.48, -0.08),
  new THREE.Vector3(1.42, -0.38, 0.06),
  new THREE.Vector3(2.28, -1.12, 0),
  new THREE.Vector3(2.5, -1.48, -1.02),
  new THREE.Vector3(1.25, -1.62, -1.38),
  new THREE.Vector3(-0.2, -1.6, -1.48),
  new THREE.Vector3(-1.75, -1.08, -1.35),
  new THREE.Vector3(-2.62, 0.12, -1.12),
];

const crossedPhase = (previous: number, current: number, phase: number) => (
  current >= previous ? phase > previous && phase <= current : phase > previous || phase <= current
);

function Support({from, to}: {from: THREE.Vector3; to: THREE.Vector3}) {
  const transform = useMemo(() => {
    const direction = to.clone().sub(from);
    const midpoint = from.clone().add(to).multiplyScalar(0.5);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.clone().normalize(),
    );
    return {length: direction.length(), midpoint, quaternion};
  }, [from, to]);
  return (
    <mesh position={transform.midpoint} quaternion={transform.quaternion}>
      <cylinderGeometry args={[0.018, 0.025, transform.length, 8]} />
      <meshStandardMaterial color="#37434d" metalness={0.84} roughness={0.28} />
    </mesh>
  );
}

function Bell({
  datum,
  hitTimes,
  index,
  position,
  rotation,
  impactGlow,
}: {
  datum: BellDatum;
  hitTimes: MutableRefObject<number[]>;
  index: number;
  position: THREE.Vector3;
  rotation: number;
  impactGlow: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const haloRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((state) => {
    const age = state.clock.elapsedTime - hitTimes.current[index];
    const hit = age >= 0 ? Math.exp(-age * 9.5) : 0;
    if (groupRef.current) {
      groupRef.current.position.z = position.z + hit * 0.085;
      groupRef.current.rotation.z = rotation + Math.sin(age * 42) * hit * 0.018;
    }
    if (materialRef.current) materialRef.current.emissiveIntensity = hit * impactGlow;
    if (haloRef.current) haloRef.current.opacity = hit * 0.42;
  });

  return (
    <group ref={groupRef} position={position} rotation={[0, 0, rotation]}>
      <mesh>
        <boxGeometry args={[0.48, 0.075, 0.2]} />
        <meshStandardMaterial
          ref={materialRef}
          color={datum.color}
          emissive={datum.color}
          emissiveIntensity={0}
          metalness={0.68}
          roughness={0.22}
        />
      </mesh>
      <mesh position={[0, 0, -0.035]} scale={[1.3, 1.7, 1]}>
        <planeGeometry args={[0.5, 0.12]} />
        <meshBasicMaterial ref={haloRef} blending={THREE.AdditiveBlending} color={datum.color} depthWrite={false} opacity={0} transparent />
      </mesh>
    </group>
  );
}

function Marble({
  index,
  total,
  controls,
  curve,
  hitTimes,
  onHit,
  playing,
}: {
  index: number;
  total: number;
  controls: MarbleControls;
  curve: THREE.CatmullRomCurve3;
  hitTimes: MutableRefObject<number[]>;
  onHit: (bell: BellDatum) => void;
  playing: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const progressRef = useRef(index / total);
  const rotationRef = useRef(0);

  useFrame((state, delta) => {
    const previous = progressRef.current;
    const step = Math.min(delta, 0.04) * controls.tempo / 520;
    if (playing) {
      progressRef.current = (progressRef.current + step) % 1;
      rotationRef.current += step * 85;
    }
    const progress = progressRef.current;
    const point = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress);
    if (meshRef.current) {
      meshRef.current.position.copy(point).addScaledVector(new THREE.Vector3(0, 0, 1), 0.16);
      meshRef.current.rotation.set(rotationRef.current * tangent.y, rotationRef.current * tangent.x, 0);
    }
    if (playing) {
      BELLS.forEach((bell, bellIndex) => {
        if (!crossedPhase(previous, progress, bell.phase)) return;
        hitTimes.current[bellIndex] = state.clock.elapsedTime;
        onHit(bell);
      });
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.125, 28, 20]} />
      <meshStandardMaterial color="#e9f4fb" emissive="#7edfff" emissiveIntensity={0.12} metalness={0.92} roughness={0.11} />
    </mesh>
  );
}

function Machine({controls, onHit, playing}: {
  controls: MarbleControls;
  onHit: (bell: BellDatum) => void;
  playing: boolean;
}) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(PATH_POINTS, true, 'catmullrom', 0.34), []);
  const railCurves = useMemo(() => [-0.11, 0.11].map((offset) => new THREE.CatmullRomCurve3(
    PATH_POINTS.map((point) => point.clone().add(new THREE.Vector3(0, 0, offset))),
    true,
    'catmullrom',
    0.34,
  )), []);
  const hitTimes = useRef(BELLS.map(() => -100));
  const marbles = useMemo(() => Array.from({length: controls.marbles}, (_, index) => index), [controls.marbles]);
  const bellData = useMemo(() => BELLS.map((bell) => {
    const position = curve.getPointAt(bell.phase).add(new THREE.Vector3(0, 0, 0.04));
    const tangent = curve.getTangentAt(bell.phase);
    return {position, rotation: Math.atan2(tangent.y, tangent.x) + Math.PI / 2};
  }), [curve]);

  return (
    <group rotation={[-0.08, 0, 0]}>
      {railCurves.map((railCurve, index) => (
        <mesh key={index}>
          <tubeGeometry args={[railCurve, 260, 0.025, 8, true]} />
          <meshStandardMaterial color="#778995" metalness={0.9} roughness={0.2} />
        </mesh>
      ))}
      <mesh position={[0, -1.72, -0.55]}>
        <boxGeometry args={[5.3, 0.08, 1.8]} />
        <meshStandardMaterial color="#141b22" metalness={0.7} roughness={0.32} />
      </mesh>
      {bellData.map(({position, rotation}, index) => (
        <group key={BELLS[index].note}>
          <Bell datum={BELLS[index]} hitTimes={hitTimes} impactGlow={controls.impactGlow} index={index} position={position} rotation={rotation} />
          <Support from={new THREE.Vector3(position.x, -1.68, position.z - 0.12)} to={position.clone().add(new THREE.Vector3(0, 0, -0.11))} />
        </group>
      ))}
      {marbles.map((index) => (
        <Marble key={index} controls={controls} curve={curve} hitTimes={hitTimes} index={index} onHit={onHit} playing={playing} total={marbles.length} />
      ))}
    </group>
  );
}

export default function Demo038MarbleMusicMachine() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const soundEnabledRef = useRef(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [lastNote, setLastNote] = useState('—');
  const controls = useControls('Marble Music Machine', {
    tempo: {value: 108, min: 60, max: 168, step: 1, label: 'Machine tempo'},
    marbles: {value: 3, min: 1, max: 6, step: 1, label: 'Marbles in loop'},
    impactGlow: {value: 1.25, min: 0.45, max: 1.8, step: 0.01, label: 'Strike response'},
    noteLength: {value: 0.42, min: 0.18, max: 0.72, step: 0.01, label: 'Bell decay'},
  }) as MarbleControls;

  const triggerNote = useCallback((bell: BellDatum) => {
    setLastNote(bell.note);
    const audioContext = audioContextRef.current;
    if (!soundEnabledRef.current || !audioContext) return;
    const now = audioContext.currentTime;
    const output = audioContext.createGain();
    output.gain.setValueAtTime(0.0001, now);
    output.gain.exponentialRampToValueAtTime(0.11, now + 0.006);
    output.gain.exponentialRampToValueAtTime(0.0001, now + controls.noteLength);
    output.connect(audioContext.destination);
    [1, 2.01].forEach((ratio, index) => {
      const oscillator = audioContext.createOscillator();
      const partial = audioContext.createGain();
      oscillator.type = index === 0 ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(bell.frequency * ratio, now);
      partial.gain.value = index === 0 ? 1 : 0.18;
      oscillator.connect(partial).connect(output);
      oscillator.start(now);
      oscillator.stop(now + controls.noteLength + 0.04);
    });
  }, [controls.noteLength]);

  const toggleSound = async () => {
    if (!audioContextRef.current) audioContextRef.current = new AudioContext();
    await audioContextRef.current.resume();
    soundEnabledRef.current = !soundEnabledRef.current;
    setSoundEnabled(soundEnabledRef.current);
  };

  return (
    <div className="demo-viewport" style={{position: 'relative', background: '#070a0f'}}>
      <DemoScene
        engineConfig={{
          background: '#070a0f',
          bloom: {intensity: 0.48, luminanceSmoothing: 0.56, luminanceThreshold: 0.52},
          camera: {position: [0, 0.15, 7.1], fov: 42, near: 0.1, far: 30},
          vignette: {darkness: 0.5, offset: 0.24},
        }}
        orbitConfig={{enablePan: false, enableZoom: true, minDistance: 5, maxDistance: 10}}
      >
        <ambientLight intensity={0.58} />
        <pointLight color="#dff6ff" intensity={2.7} position={[-2.6, 3.5, 4.5]} />
        <pointLight color="#ffb35c" intensity={1.4} position={[3, -0.5, 3]} />
        <Machine controls={controls} onHit={triggerNote} playing={playing} />
      </DemoScene>
      <div style={transportStyle}>
        <button onClick={() => setPlaying((value) => !value)} style={machineButtonStyle} type="button">
          {playing ? 'Pause' : 'Run'}
        </button>
        <button onClick={toggleSound} style={machineButtonStyle} type="button">
          {soundEnabled ? 'Mute' : 'Enable sound'}
        </button>
        <span style={{color: '#8ba4b5'}}>{controls.tempo} BPM</span>
        <strong style={{minWidth: 24, color: '#effbff', textAlign: 'center'}}>{lastNote}</strong>
      </div>
    </div>
  );
}

const transportStyle = {
  position: 'absolute', left: '50%', bottom: 18, display: 'flex', alignItems: 'center', gap: 9,
  transform: 'translateX(-50%)', padding: 7, border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 7, background: 'rgba(7,10,15,0.86)', color: '#edf7ff',
  fontFamily: '"SFMono-Regular", Menlo, Consolas, monospace', fontSize: 11, backdropFilter: 'blur(14px)',
} as const;

const machineButtonStyle = {
  border: '1px solid rgba(113,223,255,0.36)', borderRadius: 5, background: 'rgba(113,223,255,0.1)',
  color: '#ecfbff', cursor: 'pointer', padding: '7px 10px', font: 'inherit', fontWeight: 700,
} as const;
