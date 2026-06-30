import {existsSync, readdirSync, readFileSync} from 'node:fs';
import path from 'node:path';

type DemoRecord = {
  dirName: string;
  number: string;
  title: string;
  id: string;
  route: string;
};

const repoRoot = process.cwd();
const demosDir = path.join(repoRoot, 'packages/web3dlab/demos');
const indexPath = path.join(demosDir, 'index.tsx');
const reviewDocPath = path.join(repoRoot, 'docs/WEB3DLAB_DEMOS.md');

const fail = (message: string): never => {
  throw new Error(`[visual-effects] ${message}`);
};

const read = (filePath: string) => readFileSync(filePath, 'utf8');

const getStringField = (source: string, fieldName: string, filePath: string) => {
  const match = source.match(new RegExp(`${fieldName}:\\s*['"]([^'"]+)['"]`));
  if (!match) {
    fail(`Missing ${fieldName} in ${path.relative(repoRoot, filePath)}`);
  }
  return match[1];
};

const demoDirs = readdirSync(demosDir, {withFileTypes: true})
  .filter((entry) => entry.isDirectory() && /^\d{3}-/.test(entry.name))
  .map((entry) => entry.name)
  .sort();

if (demoDirs.length === 0) {
  fail('No numbered demo directories found.');
}

const indexSource = read(indexPath);
const reviewDoc = existsSync(reviewDocPath) ? read(reviewDocPath) : fail('Missing docs/WEB3DLAB_DEMOS.md.');
const records: DemoRecord[] = [];
const seenIds = new Set<string>();
const seenRoutes = new Set<string>();

for (const dirName of demoDirs) {
  const number = dirName.slice(0, 3);
  const demoPath = path.join(demosDir, dirName);
  const metadataPath = path.join(demoPath, 'metadata.ts');
  const componentFiles = readdirSync(demoPath).filter((fileName) => fileName.startsWith(`${number}-`) && fileName.endsWith('.tsx'));

  if (!existsSync(metadataPath)) {
    fail(`Missing metadata.ts in packages/web3dlab/demos/${dirName}`);
  }
  if (componentFiles.length === 0) {
    fail(`Missing ${number}-*.tsx component in packages/web3dlab/demos/${dirName}`);
  }
  if (!indexSource.includes(`./${dirName}/`)) {
    fail(`Demo ${dirName} is not imported by packages/web3dlab/demos/index.tsx`);
  }
  if (!reviewDoc.includes(`| ${number} `)) {
    fail(`Demo ${number} is not listed in docs/WEB3DLAB_DEMOS.md`);
  }

  const metadata = read(metadataPath);
  const id = getStringField(metadata, 'id', metadataPath);
  const title = getStringField(metadata, 'title', metadataPath);
  const route = getStringField(metadata, 'route', metadataPath);
  getStringField(metadata, 'description', metadataPath);

  if (!metadata.includes('tags:')) {
    fail(`Missing tags in ${path.relative(repoRoot, metadataPath)}`);
  }
  if (seenIds.has(id)) {
    fail(`Duplicate demo id: ${id}`);
  }
  if (seenRoutes.has(route)) {
    fail(`Duplicate demo route: ${route}`);
  }

  seenIds.add(id);
  seenRoutes.add(route);
  records.push({dirName, number, title, id, route});
}

console.log(`Validated ${records.length} Web3D demos.`);
console.log(records.map((record) => `${record.number} ${record.id} -> ${record.route}`).join('\n'));
