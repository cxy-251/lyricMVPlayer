import fs from "node:fs/promises";
import path from "node:path";
import type {ProductionManifest, WebGLEffectProfileId} from "@paper-to-video/shared-types";
import {isSupportedEffectProfileId} from "./effect-profiles";
import {buildProfileDrivenManifest} from "./manifest-factory";
import {slugify} from "./run-artifacts";

export type VideoBatchRow = {
  rowNumber: number;
  enabled: boolean;
  rowId: string;
  contentProfileId: string;
  coverImagePath?: string;
  coverImageSource?: "local" | "remote";
  coverProfileId?: string;
  effectProfileId: WebGLEffectProfileId;
  projectId?: string;
  seed?: number;
  voiceName?: string;
  voiceRate?: string;
  voicePitch?: string;
  baseManifestPath?: string;
};

const splitCsvLine = (line: string) => {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
};

const parseBoolean = (value: string | undefined) => {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return !["0", "false", "no", "off", "disabled"].includes(normalized);
};

const parseInteger = (value: string | undefined) => {
  if (!value?.trim()) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const parseRowSelection = (rawSelection: string | undefined, maxRowNumber: number) => {
  if (!rawSelection?.trim()) {
    return null;
  }

  const selected = new Set<number>();

  for (const token of rawSelection.split(",")) {
    const part = token.trim();
    if (!part) {
      continue;
    }

    if (part.includes("-")) {
      const [startRaw, endRaw] = part.split("-", 2);
      const start = Number.parseInt(startRaw, 10);
      const end = Number.parseInt(endRaw, 10);

      if (!Number.isFinite(start) || !Number.isFinite(end)) {
        throw new Error(`Invalid row range: ${part}`);
      }

      const low = Math.max(1, Math.min(start, end));
      const high = Math.min(maxRowNumber, Math.max(start, end));

      for (let value = low; value <= high; value += 1) {
        selected.add(value);
      }
      continue;
    }

    const rowNumber = Number.parseInt(part, 10);
    if (!Number.isFinite(rowNumber)) {
      throw new Error(`Invalid row number: ${part}`);
    }

    if (rowNumber >= 1 && rowNumber <= maxRowNumber) {
      selected.add(rowNumber);
    }
  }

  return selected;
};

export const readVideoBatchRows = async (csvPath: string): Promise<VideoBatchRow[]> => {
  const raw = await fs.readFile(csvPath, "utf-8");
  const allLines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (allLines.length === 0) {
    return [];
  }

  const headerLine = allLines.find((line) => line.replace(/^#\s*/, "").includes("content_profile_id"));
  if (!headerLine) {
    throw new Error(`Batch config ${csvPath} is missing a header row.`);
  }

  const dataLines = allLines.filter((line) => line !== headerLine && !line.startsWith("#"));
  const headers = splitCsvLine(headerLine.replace(/^#\s*/, "")).map((header) => header.trim());
  const rows: VideoBatchRow[] = [];

  for (const [index, line] of dataLines.entries()) {
    const values = splitCsvLine(line);
    const record = Object.fromEntries(headers.map((header, headerIndex) => [header, values[headerIndex] ?? ""]));
    const rowNumber = index + 1;
    const rowId = record.row_id?.trim() || `row-${rowNumber}`;
    const contentProfileId = record.content_profile_id?.trim();
    const effectProfileId = (record.effect_profile_id?.trim() || "life-game") as WebGLEffectProfileId;

    if (!contentProfileId) {
      throw new Error(`Row ${rowNumber} is missing content_profile_id`);
    }

    if (!isSupportedEffectProfileId(effectProfileId)) {
      throw new Error(`Row ${rowNumber} has unsupported effect_profile_id: ${effectProfileId}`);
    }

    rows.push({
      rowNumber,
      enabled: parseBoolean(record.enabled),
      rowId,
      contentProfileId,
      coverImagePath: record.cover_image_path?.trim() || undefined,
      coverImageSource: (record.cover_image_source?.trim() as "local" | "remote" | "") || undefined,
      coverProfileId: record.cover_profile_id?.trim() || undefined,
      effectProfileId,
      projectId: record.project_id?.trim() || undefined,
      seed: parseInteger(record.seed),
      voiceName: record.voice_name?.trim() || undefined,
      voiceRate: record.voice_rate?.trim() || undefined,
      voicePitch: record.voice_pitch?.trim() || undefined,
      baseManifestPath: record.base_manifest_path?.trim() || undefined,
    });
  }

  return rows;
};

export const materializeBatchManifest = async ({
  row,
  outputDir,
}: {
  row: VideoBatchRow;
  outputDir: string;
}) => {
  const manifest = await buildProfileDrivenManifest({
    baseManifestPath: row.baseManifestPath,
    projectId:
      row.projectId ??
      slugify(
        `${row.contentProfileId}-${row.coverImagePath ? path.basename(row.coverImagePath) : row.coverProfileId ?? "cover-local"}-${row.effectProfileId}`,
      ),
    seed: row.seed,
    contentProfileId: row.contentProfileId,
    coverImagePath: row.coverImagePath,
    coverImageSource: row.coverImageSource,
    coverProfileId: row.coverProfileId,
    effectProfileId: row.effectProfileId,
  });

  if (row.voiceName || row.voiceRate || row.voicePitch) {
    manifest.voice = {
      ...manifest.voice,
      ...(row.voiceName ? {name: row.voiceName} : {}),
      ...(row.voiceRate ? {rate: row.voiceRate} : {}),
      ...(row.voicePitch ? {pitch: row.voicePitch} : {}),
    };
  }

  const fileName = `${String(row.rowNumber).padStart(2, "0")}-${slugify(row.rowId)}.json`;
  const outputPath = path.join(outputDir, fileName);
  await fs.mkdir(path.dirname(outputPath), {recursive: true});
  await fs.writeFile(outputPath, JSON.stringify(manifest, null, 2), "utf-8");

  return {
    manifest,
    outputPath,
  };
};
