import {useControls} from 'leva';
import {MatCapDisplacementMaterial} from '../../core/MatCapDisplacementMaterial';
import {DemoScene} from '../../core/DemoScene';

function MorphingLiquidSphere({controls}: {controls: any}) {
  return (
    <mesh frustumCulled={false}>
      <icosahedronGeometry args={[4.0, 128]} />
      <MatCapDisplacementMaterial controls={controls} />
    </mesh>
  );
}

function LiquidMetalScene({debug, controls}: {debug: boolean; controls: any}) {
  return (
    <DemoScene
      debug={debug}
      engineConfig={{
        background: '#010101',
        chromaticAberration: {offset: [0.03, 0.03]},
        vignette: {darkness: 0.7, offset: 0.1},
        camera: {fov: 45, far: 50, near: 0.1, position: [0, 0, 15]},
      }}
      orbitConfig={{
        autoRotate: true,
        autoRotateSpeed: 2.0,
      }}
    >
      <MorphingLiquidSphere controls={controls} />
    </DemoScene>
  );
}

/**
 * Liquid Metal Demo
 * 
 * [Purpose / Foundation Usage]
 * Demonstrates the power of the `<MatCapDisplacementMaterial>` foundation.
 * This demo shows how the extracted material can be applied to any standard 
 * ThreeJS geometry (in this case, a sphere) to instantly convert it into a 
 * procedural, boiling liquid metal object with true dynamically calculated face normals.
 * 
 * [Architecture Assembly]
 * - <MatCapDisplacementMaterial> foundation for the liquid chrome logic.
 * - <DemoScene> for rendering pipeline and AutoRotate orbit controls.
 */
export default function LiquidMetalDemo() {
  const {showStats} = useControls('Debug', {showStats: false});
  const liquidControls = useControls('T-1000 Liquid Metal', {
    flowSpeed: { value: 1.2, min: 0.0, max: 5.0, step: 0.1 },
    distortionFrequency: { value: 0.5, min: 0.05, max: 1.0, step: 0.05 },
    distortionIntensity: { value: 1.8, min: 0.0, max: 3.0, step: 0.1 },
    chromeColor: '#00e5ff', // More electric cyan
  });

  return <LiquidMetalScene debug={showStats} controls={liquidControls} />;
}
