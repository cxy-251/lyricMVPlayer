import path from "node:path";
import {spawn} from "node:child_process";
import {SUPPORTED_EFFECT_PROFILE_IDS, isSupportedEffectProfileId} from "./lib/effect-profiles";
import {scaffoldEffectRun} from "./lib/effect-video";
import {writeRunSummary} from "./lib/run-artifacts";

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

const parseArgs = (args: string[]) => {
  const take = (flag: string) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };

  const effectProfileId = take("--effect-profile") ?? "rubiks-solver";
  if (!isSupportedEffectProfileId(effectProfileId)) {
    throw new Error(
      `Unsupported effect profile: ${effectProfileId}. Supported values: ${SUPPORTED_EFFECT_PROFILE_IDS.join(", ")}`,
    );
  }

  const durationSeconds = Number.parseFloat(take("--duration-seconds") ?? "12");
  const fps = Number.parseInt(take("--fps") ?? "30", 10);
  const width = Number.parseInt(take("--width") ?? "1080", 10);
  const height = Number.parseInt(take("--height") ?? "1920", 10);
  const seed = Number.parseInt(take("--seed") ?? "42", 10);
  const requestedRunId = take("--run-id");
  const output = take("--output");

  return {
    durationInFrames: Math.max(1, Math.round(durationSeconds * fps)),
    effectProfileId,
    fps,
    height,
    output: output ? path.resolve(output) : undefined,
    requestedRunId,
    seed,
    width,
  };
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const {context, outputVideoPath} = await scaffoldEffectRun(options);
  const resolvedOutputPath = options.output ?? outputVideoPath;

  await run("node", [
    "--import",
    "tsx",
    "tools/build-video.ts",
    context.renderManifestPath,
    resolvedOutputPath,
    "--skip-run-registry",
  ]);

  await writeRunSummary(context, {
    projectId: context.projectId,
    runId: context.runId,
    stage: "effect-video-rendered",
    renderManifestPath: context.renderManifestPath,
    outputVideoPath: resolvedOutputPath,
  });

  console.log("");
  console.log("Effect-only video is ready.");
  console.log(`Render manifest: ${context.renderManifestPath}`);
  console.log(`Output video: ${resolvedOutputPath}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
