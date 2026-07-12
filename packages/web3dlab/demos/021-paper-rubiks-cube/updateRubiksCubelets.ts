import type {RubiksCubieState, ThreeRubiksCubeletBundle} from "./rubiks-cube.types";

export const updateRubiksCubelets = ({
  cubieGap,
  cubelets,
  states,
}: {
  cubieGap: number;
  cubelets: ThreeRubiksCubeletBundle["cubelets"];
  states: RubiksCubieState[];
}) => {
  const spacing = 1 + cubieGap;

  cubelets.forEach((cubie, index) => {
    const state = states[index];
    cubie.object.position.copy(state.coord).multiplyScalar(spacing);
    cubie.object.quaternion.copy(state.orientation);
    cubie.object.scale.setScalar(0.985);
  });
};
