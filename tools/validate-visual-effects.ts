import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {visualEffectAtoms, visualEffectRecipes} from "../modules/visual-effects/src/index";

assert.equal(visualEffectRecipes.filter((recipe) => recipe.source === "web3d").length, 18, "expected 18 web3d recipes");
assert.equal(visualEffectRecipes.filter((recipe) => recipe.source === "lyric").length, 5, "expected 5 lyric recipes");
assert.equal(new Set(visualEffectRecipes.map((recipe) => recipe.id)).size, 23, "recipe ids must be unique");
assert.equal(new Set(visualEffectAtoms.map((atom) => atom.id)).size, visualEffectAtoms.length, "atom ids must be unique");

const atomIds = new Set(visualEffectAtoms.map((atom) => atom.id));
for (const recipe of visualEffectRecipes) {
  assert.ok(recipe.layers.length > 0, `${recipe.id} must contain layers`);
  assert.equal(new Set(recipe.layers.map((layer) => layer.id)).size, recipe.layers.length, `${recipe.id} layer ids must be unique`);
  for (const layer of recipe.layers) {
    assert.ok(atomIds.has(layer.atomId), `${recipe.id} references missing atom ${layer.atomId}`);
    assert.ok(layer.opacity >= 0 && layer.opacity <= 1, `${recipe.id}/${layer.id} opacity out of range`);
    assert.ok(layer.transform.scale > 0, `${recipe.id}/${layer.id} scale must be positive`);
  }
  assert.deepEqual(JSON.parse(JSON.stringify(recipe)), recipe, `${recipe.id} must remain pure JSON`);
}

for (const atom of visualEffectAtoms) {
  const first = atom.sanitizeConfig(structuredClone(atom.defaultConfig));
  const second = atom.sanitizeConfig(structuredClone(atom.defaultConfig));
  assert.deepEqual(first, second, `${atom.id} config sanitization must be deterministic`);
}

const sourceRoot = path.resolve("modules/visual-effects/src");
const sourceFiles: string[] = [];
const collect = (directory: string) => {
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(filePath);
    else if (/\.(ts|tsx)$/.test(entry.name)) sourceFiles.push(filePath);
  }
};
collect(sourceRoot);
for (const filePath of sourceFiles) {
  const contents = fs.readFileSync(filePath, "utf8");
  assert.ok(!contents.includes("Math.random("), `${path.relative(sourceRoot, filePath)} uses Math.random`);
  assert.ok(!contents.includes("AudioContext"), `${path.relative(sourceRoot, filePath)} creates audio`);
}

process.stdout.write(`Validated ${visualEffectAtoms.length} atoms and ${visualEffectRecipes.length} recipes.\n`);
