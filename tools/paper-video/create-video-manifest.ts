import fs from "node:fs/promises";
import path from "node:path";
import {isSupportedEffectProfileId} from "./lib/effect-profiles";
import {buildProfileDrivenManifest} from "./lib/manifest-factory";
import {GENERATED_MANIFEST_ROOT, slugify} from "./lib/run-artifacts";
import type {WebGLEffectProfileId} from "@paper-to-video/shared-types";

const DEFAULT_OUTPUT_DIR = GENERATED_MANIFEST_ROOT;

const parseArgs = (args: string[]) => {
  const take = (flag: string) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };

  return {
    projectId: take("--project-id"),
    contentProfileId: take("--content-profile"),
    coverProfileId: take("--cover-profile"),
    effectProfileId: (take("--effect-profile") ?? "life-game") as WebGLEffectProfileId,
    outputPath: take("--output"),
    seed: take("--seed") ? Number.parseInt(take("--seed") as string, 10) : undefined,
    baseManifestPath: take("--base-manifest"),
  };
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));

  if (!options.contentProfileId) {
    throw new Error("Missing required argument: --content-profile <profile-id>");
  }

  if (!isSupportedEffectProfileId(options.effectProfileId)) {
    throw new Error(`Unsupported effect profile: ${options.effectProfileId}`);
  }

  const manifest = await buildProfileDrivenManifest({
    baseManifestPath: options.baseManifestPath,
    projectId: options.projectId,
    seed: options.seed,
    contentProfileId: options.contentProfileId,
    coverProfileId: options.coverProfileId,
    effectProfileId: options.effectProfileId,
  });

  const outputPath =
    options.outputPath
      ? path.resolve(options.outputPath)
      : path.join(DEFAULT_OUTPUT_DIR, `${slugify(manifest.projectId)}.json`);

  await fs.mkdir(path.dirname(outputPath), {recursive: true});
  await fs.writeFile(outputPath, JSON.stringify(manifest, null, 2), "utf-8");

  console.log(`Profile-driven manifest written to ${outputPath}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
