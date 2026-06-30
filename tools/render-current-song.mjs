import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";

const projectRoot = process.cwd();
const args = process.argv.slice(2);
const currentSongConfigPath = path.join(projectRoot, "src", "remotion", "current-song.json");
const songsOutDir = path.join(projectRoot, "artifacts", "songsout");
const remotionBin = path.join(projectRoot, "node_modules", ".bin", "remotion");
const selectSongScriptPath = path.join(projectRoot, "tools", "select-song-for-preview.mjs");
const renderConcurrency = process.env.REMOTION_CONCURRENCY ?? readOption(["--concurrency"]) ?? "3";

const aliases = new Map([
  ["lyrics", "lyrics"],
  ["lyric", "lyrics"],
  ["musicvideo", "lyrics"],
  ["music-video", "lyrics"],
  ["album", "album"],
  ["albumgallery", "album"],
  ["album-gallery", "album"],
  ["web3d", "web3dlab"],
  ["web3dlab", "web3dlab"],
  ["effects", "web3dlab"],
]);

function readOption(names) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    for (const name of names) {
      if (arg === name) {
        return args[index + 1];
      }
      if (arg.startsWith(`${name}=`)) {
        return arg.slice(name.length + 1);
      }
    }
  }
  return undefined;
}

function hasOption(names) {
  return args.some((arg) => names.includes(arg));
}

function positionalArgs() {
  const result = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg.startsWith("--")) {
      if (!arg.includes("=") && args[index + 1] && !args[index + 1].startsWith("--")) {
        index += 1;
      }
      continue;
    }
    result.push(arg);
  }
  return result;
}

function parsePositiveNumber(value, label) {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive number: ${value}`);
  }
  return parsed;
}

function sanitizeFileName(value) {
  return value.replace(/[^a-zA-Z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "render";
}

function resolveOutputPath(outputPath) {
  return path.isAbsolute(outputPath) ? outputPath : path.join(projectRoot, outputPath);
}

function writePropsFile(props) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lyric-mv-render-"));
  const propsPath = path.join(tmpDir, "props.json");
  fs.writeFileSync(propsPath, JSON.stringify(props, null, 2) + "\n");
  return {tmpDir, propsPath};
}

function renderComposition({compositionId, outputPath, props}) {
  fs.mkdirSync(path.dirname(outputPath), {recursive: true});
  const renderArgs = [
    "render",
    "src/remotion/RenderRoot.tsx",
    compositionId,
    outputPath,
    `--concurrency=${renderConcurrency}`,
  ];
  let tmpDir = "";

  if (Object.keys(props).length > 0) {
    const written = writePropsFile(props);
    tmpDir = written.tmpDir;
    renderArgs.push(`--props=${written.propsPath}`);
  }

  console.log(`Rendering ${compositionId} -> ${path.relative(projectRoot, outputPath)}`);
  const renderResult = spawnSync(remotionBin, renderArgs, {
    cwd: projectRoot,
    stdio: "inherit",
  });

  if (tmpDir) {
    fs.rmSync(tmpDir, {recursive: true, force: true});
  }

  if (renderResult.status !== 0) {
    process.exit(renderResult.status ?? 1);
  }
}

function renderCurrentLyricVideo() {
  if (!fs.existsSync(currentSongConfigPath)) {
    throw new Error(`Missing current song config: ${currentSongConfigPath}`);
  }

  const currentSongConfig = JSON.parse(fs.readFileSync(currentSongConfigPath, "utf-8"));
  const songDirName = currentSongConfig.songDirName;

  if (!songDirName) {
    throw new Error("current-song.json does not contain songDirName");
  }

  const songDir = path.join(projectRoot, "artifacts", "songs", songDirName);
  if (!fs.existsSync(songDir)) {
    throw new Error(`Song directory not found: ${songDir}`);
  }

  const finalOutputPath = resolveOutputPath(readOption(["--output", "-o"]) ?? path.join(songsOutDir, `${songDirName}.mp4`));
  fs.mkdirSync(songsOutDir, {recursive: true});

  const selectResult = spawnSync(
    "node",
    [selectSongScriptPath, "--render-only", songDirName],
    {
      cwd: projectRoot,
      stdio: "inherit",
    }
  );

  if (selectResult.status !== 0) {
    process.exit(selectResult.status ?? 1);
  }

  renderComposition({
    compositionId: "MusicVideo",
    outputPath: finalOutputPath,
    props: {},
  });
}

function renderAlbumGallery() {
  const selectedTrackId = readOption(["--selected-track-id", "--track-id", "--track"]);
  const fps = parsePositiveNumber(readOption(["--fps"]), "--fps");
  const outputPath = resolveOutputPath(
    readOption(["--output", "-o"]) ??
      path.join(songsOutDir, `album-gallery${selectedTrackId ? `-${sanitizeFileName(selectedTrackId)}` : ""}.mp4`),
  );
  const props = {
    ...(selectedTrackId ? {selectedTrackId} : {}),
    ...(fps ? {fps} : {}),
  };

  renderComposition({
    compositionId: "AlbumGallery",
    outputPath,
    props,
  });
}

function renderWeb3DLab() {
  const positionals = positionalArgs();
  const demoId = readOption(["--demo-id", "--demo"]) ?? positionals[1];
  const fps = parsePositiveNumber(readOption(["--fps"]), "--fps") ?? 30;
  const durationFrames = parsePositiveNumber(readOption(["--duration-frames", "--frames"]), "--duration-frames");
  const durationSeconds = parsePositiveNumber(readOption(["--duration-seconds", "--seconds"]), "--duration-seconds");
  const durationInFrames = durationFrames ?? (durationSeconds ? Math.round(durationSeconds * fps) : undefined);
  const outputPath = resolveOutputPath(
    readOption(["--output", "-o"]) ??
      path.join(songsOutDir, `web3dlab-${sanitizeFileName(demoId ?? "cinematic-style-sequence")}.mp4`),
  );
  const props = {
    ...(demoId ? {demoId} : {}),
    ...(fps ? {fps} : {}),
    ...(durationInFrames ? {durationInFrames} : {}),
  };

  renderComposition({
    compositionId: "Web3DLab",
    outputPath,
    props,
  });
}

function printHelp() {
  console.log(`Usage:
  pnpm run render
  pnpm run render -- --target album [--selected-track-id "<track id>"] [--output artifacts/songsout/album.mp4]
  pnpm run render -- --target web3dlab --demo cinematic-style-sequence [--duration-seconds 10] [--output artifacts/songsout/web3d.mp4]

Targets:
  lyrics      Default. Render current MusicVideo from src/remotion/current-song.json.
  album       Render the AlbumGallery Remotion composition.
  web3dlab    Render a Web3DLab demo composition.
`);
}

if (hasOption(["--help", "-h"])) {
  printHelp();
  process.exit(0);
}

const firstPositional = positionalArgs()[0];
const requestedTarget = readOption(["--target", "--composition"]) ?? firstPositional ?? "lyrics";
const normalizedTarget = aliases.get(requestedTarget.toLowerCase()) ?? requestedTarget;

if (normalizedTarget === "lyrics") {
  renderCurrentLyricVideo();
} else if (normalizedTarget === "album") {
  renderAlbumGallery();
} else if (normalizedTarget === "web3dlab") {
  renderWeb3DLab();
} else {
  throw new Error(`Unknown render target: ${requestedTarget}. Run "pnpm run render -- --help".`);
}
