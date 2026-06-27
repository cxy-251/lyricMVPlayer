import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {visualEffectRegistry} from "../modules/render-core/src/visual-effects/registry";

const demoRoot = path.resolve("modules/render-core/src/visual-effects/web3d-lab/demos");
const demoDirectories = fs.readdirSync(demoRoot, {withFileTypes: true})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const demoMetadataFiles = demoDirectories
  .map((directory) => path.join(demoRoot, directory, "metadata.ts"))
  .filter((filePath) => fs.existsSync(filePath));

assert.equal(demoMetadataFiles.length, 18, "expected 18 migrated web3d demos");
assert.equal(Object.keys(visualEffectRegistry).length, 5, "expected 5 lyric remotion effects");

const demoIds = new Set<string>();
const demoRoutes = new Set<string>();
for (const metadataFile of demoMetadataFiles) {
  const contents = fs.readFileSync(metadataFile, "utf8");
  const relativeName = path.relative(demoRoot, metadataFile);
  const id = contents.match(/\bid:\s*['"]([^'"]+)['"]/)?.[1];
  const route = contents.match(/\broute:\s*['"]([^'"]+)['"]/)?.[1];
  assert.ok(id, `${relativeName} must contain an id`);
  assert.ok(route, `${relativeName} must contain a route`);
  assert.ok(route.startsWith("/"), `${id} route must be absolute inside gallery`);
  assert.ok(contents.includes("title:"), `${id} title must be present`);
  assert.ok(contents.includes("description:"), `${id} description must be present`);
  assert.ok(contents.includes("tags:"), `${id} tags must be present`);
  demoIds.add(id);
  demoRoutes.add(route);
}
assert.equal(demoIds.size, demoMetadataFiles.length, "web3d demo ids must be unique");
assert.equal(demoRoutes.size, demoMetadataFiles.length, "web3d demo routes must be unique");

const sourceRoot = path.resolve("modules/render-core/src/visual-effects");
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
  assert.ok(!contents.includes("@lyric-mv/visual-effects"), `${path.relative(sourceRoot, filePath)} imports the deprecated visual-effects package`);
}

process.stdout.write(`Validated ${demoMetadataFiles.length} web3d demos and ${Object.keys(visualEffectRegistry).length} lyric remotion effects.\n`);
