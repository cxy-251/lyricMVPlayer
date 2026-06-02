import fs from "node:fs/promises";
import path from "node:path";
import {
  importSummaryJsonToContentProfile,
  resolveImportedProfilePath,
} from "../../modules/paper-video/services/summarizer/import-summary.service";
import type {ContentProfileRegistryDocument} from "@paper-to-video/shared-types";

type CliOptions = {
  inputPath: string | null;
  outputPath: string | null;
  profileId: string | null;
  label: string | null;
  register: boolean;
};

const take = (flag: string) => {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
};

const hasFlag = (flag: string) => process.argv.includes(flag);

const parseOptions = (): CliOptions => {
  return {
    inputPath: take("--input"),
    outputPath: take("--output"),
    profileId: take("--profile-id"),
    label: take("--label"),
    register: hasFlag("--register"),
  };
};

const upsertRegistryEntry = async (profileId: string, outputPath: string, label: string) => {
  const registryPath = path.resolve("data/content-profiles/index.json");
  const registry = JSON.parse(
    await fs.readFile(registryPath, "utf-8"),
  ) as ContentProfileRegistryDocument;
  const relativePath = path.relative(path.resolve("."), outputPath);
  const existing = registry.profiles.find((item) => item.id === profileId);

  if (existing) {
    existing.path = relativePath;
    existing.label = label;
  } else {
    registry.profiles.push({
      id: profileId,
      path: relativePath,
      label,
    });
  }

  registry.profiles.sort((left, right) => left.id.localeCompare(right.id));
  await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), "utf-8");
};

const main = async () => {
  const options = parseOptions();

  if (!options.inputPath) {
    throw new Error("Missing required flag: --input <summary-json-path>");
  }

  const raw = JSON.parse(await fs.readFile(path.resolve(options.inputPath), "utf-8")) as unknown;
  const imported = importSummaryJsonToContentProfile(raw, {
    profileId: options.profileId ?? undefined,
    label: options.label ?? undefined,
  });
  const outputPath =
    options.outputPath?.trim()
      ? path.resolve(options.outputPath)
      : resolveImportedProfilePath(imported.metadata.profileId);

  await fs.mkdir(path.dirname(outputPath), {recursive: true});
  await fs.writeFile(outputPath, JSON.stringify(imported.contentProfile, null, 2), "utf-8");

  if (options.register) {
    await upsertRegistryEntry(imported.metadata.profileId, outputPath, imported.metadata.label);
  }

  console.log(`Imported summary JSON into content profile: ${outputPath}`);
  console.log(`profile_id=${imported.metadata.profileId}`);
  console.log(`label=${imported.metadata.label}`);
  if (imported.metadata.preferredEffectId) {
    console.log(`preferred_effect=${imported.metadata.preferredEffectId}`);
  }
  if (imported.metadata.coverImageKeywords.length > 0) {
    console.log(`cover_keywords=${imported.metadata.coverImageKeywords.join(", ")}`);
  }
  if (imported.metadata.tone) {
    console.log(`tone=${imported.metadata.tone}`);
  }
  if (imported.metadata.warnings.length > 0) {
    console.warn("\nWarnings:");
    for (const warning of imported.metadata.warnings) {
      console.warn(`- ${warning}`);
    }
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
