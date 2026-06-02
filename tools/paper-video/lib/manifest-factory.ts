import fs from "node:fs/promises";
import path from "node:path";
import {CONTENT_PROFILE_ROOT, slugify} from "./run-artifacts";
import type {
  ContentProfileDocument,
  ContentProfileRegistryDocument,
  ProductionManifest,
  WebGLEffectProfileId,
} from "@paper-to-video/shared-types";

const DEFAULT_BASE_MANIFEST = path.resolve("data/manifests/demo-paper.json");
const DEFAULT_CONTENT_PROFILE_REGISTRY = path.resolve("data/content-profiles/index.json");

export type CreateManifestOptions = {
  baseManifestPath?: string;
  projectId?: string;
  seed?: number;
  contentProfileId: string;
  coverProfileId?: string;
  coverImagePath?: string;
  coverImageSource?: "local" | "remote";
  effectProfileId: WebGLEffectProfileId;
};

const resolveContentProfileDocument = async (contentProfileId: string) => {
  const registryRaw = await fs.readFile(DEFAULT_CONTENT_PROFILE_REGISTRY, "utf-8");
  const registry = JSON.parse(registryRaw) as ContentProfileRegistryDocument;
  const registryEntry = registry.profiles.find((item) => item.id === contentProfileId);

  const candidatePaths = [
    registryEntry?.path ? path.resolve(registryEntry.path) : null,
    path.join(CONTENT_PROFILE_ROOT, `${contentProfileId}.json`),
  ].filter(Boolean) as string[];

  for (const candidatePath of candidatePaths) {
    try {
      const raw = await fs.readFile(candidatePath, "utf-8");
      return {
        document: JSON.parse(raw) as ContentProfileDocument,
        path: candidatePath,
      };
    } catch {
      continue;
    }
  }

  return null;
};

export const buildProfileDrivenManifest = async ({
  baseManifestPath = DEFAULT_BASE_MANIFEST,
  projectId,
  seed,
  contentProfileId,
  coverProfileId,
  coverImagePath,
  coverImageSource,
  effectProfileId,
}: CreateManifestOptions): Promise<ProductionManifest> => {
  const raw = await fs.readFile(baseManifestPath, "utf-8");
  const baseManifest = JSON.parse(raw) as ProductionManifest;
  const contentProfileResolution = await resolveContentProfileDocument(contentProfileId);
  const contentProfileDocument = contentProfileResolution?.document ?? null;

  const coverToken = coverImagePath
    ? path.basename(coverImagePath)
    : coverProfileId ?? "cover-local";
  const resolvedProjectId =
    projectId ?? slugify(`${contentProfileId}-${coverToken}-${effectProfileId}`);

  const nextManifest: ProductionManifest = {
    ...baseManifest,
    projectId: resolvedProjectId,
    seed: seed ?? baseManifest.seed,
    contentProfile: {
      id: contentProfileId,
      path: contentProfileResolution?.path
        ? path.relative(path.resolve("."), contentProfileResolution.path)
        : baseManifest.contentProfile?.path,
    },
    paper: {
      ...baseManifest.paper,
      ...(contentProfileDocument?.paper ?? {}),
    },
    effectProfile: {
      id: effectProfileId,
    },
  };

  if (coverImagePath) {
    nextManifest.coverImage = {
      source: coverImageSource ?? (/^https?:\/\//i.test(coverImagePath) ? "remote" : "local"),
      path: coverImagePath,
    };
    delete nextManifest.coverProfile;
  } else if (coverProfileId) {
    nextManifest.coverProfile = {
      id: coverProfileId,
    };
    delete nextManifest.coverImage;
  }

  return nextManifest;
};
