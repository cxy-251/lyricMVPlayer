import type {UpdateLifeInstancesInput} from "../three-life.types";

export const updateLifeInstances = ({
  cells,
  config,
  helper,
  height,
  meshes,
  width,
}: UpdateLifeInstancesInput) => {
  const cols = Math.max(1, Math.round(config.cellColumns));
  const rows = Math.max(1, Math.round(config.cellRows));
  const cellWidth = width / cols;
  const cellHeight = height / rows;
  const visibleInset = config.cellPadding;

  meshes.birth.material.color.set(config.birthColor);
  meshes.primary.material.color.set(config.primaryColor);
  meshes.secondary.material.color.set(config.secondaryColor);

  let birthCount = 0;
  let primaryCount = 0;
  let secondaryCount = 0;

  for (const cell of cells) {
    const inset = cell.age >= 3 ? visibleInset * 2.2 : visibleInset;
    const drawWidth = Math.max(1.2, (cellWidth - inset * 2) * config.cellScale);
    const drawHeight = Math.max(1.2, (cellHeight - inset * 2) * config.cellScale);

    helper.position.set(
      cell.x * cellWidth + cellWidth / 2,
      cell.y * cellHeight + cellHeight / 2,
      0,
    );
    helper.scale.set(drawWidth, drawHeight, 1);
    helper.rotation.set(0, 0, 0);
    helper.updateMatrix();

    if (cell.age <= 1) {
      meshes.birth.mesh.setMatrixAt(birthCount, helper.matrix);
      birthCount += 1;
      continue;
    }

    if (cell.tone === 1) {
      meshes.primary.mesh.setMatrixAt(primaryCount, helper.matrix);
      primaryCount += 1;
      continue;
    }

    meshes.secondary.mesh.setMatrixAt(secondaryCount, helper.matrix);
    secondaryCount += 1;
  }

  meshes.birth.mesh.count = birthCount;
  meshes.primary.mesh.count = primaryCount;
  meshes.secondary.mesh.count = secondaryCount;
  meshes.birth.mesh.instanceMatrix.needsUpdate = true;
  meshes.primary.mesh.instanceMatrix.needsUpdate = true;
  meshes.secondary.mesh.instanceMatrix.needsUpdate = true;
};
