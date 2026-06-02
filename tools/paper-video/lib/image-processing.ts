import fs from "node:fs/promises";
import path from "node:path";
import {spawn} from "node:child_process";

const runWithCapture = (command: string, args: string[]) =>
  new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, {stdio: ["ignore", "pipe", "pipe"]});
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(new Error(`${command} exited with code ${code ?? "unknown"}\n${stderr}`));
    });

    child.on("error", reject);
  });

const run = (command: string, args: string[]) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {stdio: "inherit"});
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code ?? "unknown"}`));
    });
    child.on("error", reject);
  });

export const isRemoteImage = (input: string) => /^https?:\/\//i.test(input);

export const materializeImageInput = async ({
  input,
  outputDir,
}: {
  input: string;
  outputDir: string;
}) => {
  await fs.mkdir(outputDir, {recursive: true});

  if (!isRemoteImage(input)) {
    return path.resolve(input);
  }

  const parsed = new URL(input);
  const extension = path.extname(parsed.pathname) || ".jpg";
  const outputPath = path.join(outputDir, `downloaded${extension}`);
  const response = await fetch(input);

  if (!response.ok) {
    throw new Error(`Failed to download image ${input}: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(outputPath, buffer);
  return outputPath;
};

export const readImageSize = async (inputPath: string) => {
  const output = await runWithCapture("/usr/bin/sips", ["-g", "pixelWidth", "-g", "pixelHeight", inputPath]);
  const widthMatch = output.match(/pixelWidth:\s+(\d+)/);
  const heightMatch = output.match(/pixelHeight:\s+(\d+)/);

  if (widthMatch && heightMatch) {
    return {
      width: Number.parseInt(widthMatch[1], 10),
      height: Number.parseInt(heightMatch[1], 10),
    };
  }

  if (path.extname(inputPath).toLowerCase() === ".svg") {
    const raw = await fs.readFile(inputPath, "utf-8");
    const viewBoxMatch = raw.match(/viewBox=["']\s*[\d.\-]+\s+[\d.\-]+\s+([\d.\-]+)\s+([\d.\-]+)\s*["']/i);
    const widthAttrMatch = raw.match(/width=["']([\d.]+)/i);
    const heightAttrMatch = raw.match(/height=["']([\d.]+)/i);

    if (viewBoxMatch) {
      return {
        width: Math.round(Number.parseFloat(viewBoxMatch[1])),
        height: Math.round(Number.parseFloat(viewBoxMatch[2])),
      };
    }

    if (widthAttrMatch && heightAttrMatch) {
      return {
        width: Math.round(Number.parseFloat(widthAttrMatch[1])),
        height: Math.round(Number.parseFloat(heightAttrMatch[1])),
      };
    }
  }

  throw new Error(`Unable to parse image size for ${inputPath}`);
};

const rasterizeVectorIfNeeded = async ({
  inputPath,
  outputDir,
}: {
  inputPath: string;
  outputDir: string;
}) => {
  const extension = path.extname(inputPath).toLowerCase();
  if (![".svg", ".pdf"].includes(extension)) {
    return inputPath;
  }

  await fs.mkdir(outputDir, {recursive: true});
  const rasterizedPath = path.join(outputDir, `${path.basename(inputPath, extension)}.png`);
  await run("/usr/bin/sips", ["-s", "format", "png", inputPath, "--out", rasterizedPath]);
  return rasterizedPath;
};

export const normalizeImageForPortraitCrop = async ({
  inputPath,
  tempDir,
}: {
  inputPath: string;
  tempDir: string;
}) => {
  return rasterizeVectorIfNeeded({
    inputPath,
    outputDir: tempDir,
  });
};

export const cropImageToPortrait916 = async ({
  inputPath,
  outputPath,
  targetWidth = 1080,
  targetHeight = 1920,
}: {
  inputPath: string;
  outputPath: string;
  targetWidth?: number;
  targetHeight?: number;
}) => {
  const normalizedInputPath = await normalizeImageForPortraitCrop({
    inputPath,
    tempDir: path.join(path.dirname(outputPath), ".normalized"),
  });
  const size = await readImageSize(normalizedInputPath);
  const targetRatio = targetWidth / targetHeight;
  const inputRatio = size.width / size.height;

  let cropWidth = size.width;
  let cropHeight = size.height;

  if (inputRatio > targetRatio) {
    cropWidth = Math.round(size.height * targetRatio);
  } else {
    cropHeight = Math.round(size.width / targetRatio);
  }

  await fs.mkdir(path.dirname(outputPath), {recursive: true});
  await fs.copyFile(normalizedInputPath, outputPath);
  await run("/usr/bin/sips", [
    "--cropToHeightWidth",
    String(cropHeight),
    String(cropWidth),
    "--resampleHeightWidth",
    String(targetHeight),
    String(targetWidth),
    outputPath,
  ]);

  return outputPath;
};
