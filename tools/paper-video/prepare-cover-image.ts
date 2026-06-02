import path from "node:path";
import {cropImageToPortrait916, materializeImageInput} from "./lib/image-processing";
import {PREPARED_IMAGE_ROOT} from "./lib/run-artifacts";

const DEFAULT_OUTPUT_DIR = PREPARED_IMAGE_ROOT;

const parseArgs = (args: string[]) => {
  const take = (flag: string) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };

  const input = take("--input");
  if (!input) {
    throw new Error("Usage: npm run prepare:cover-image -- --input <local-path-or-url> [--output <path>]");
  }

  return {
    input,
    output: take("--output")
      ? path.resolve(take("--output") as string)
      : path.join(DEFAULT_OUTPUT_DIR, "prepared-cover.jpg"),
  };
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const tempInput = await materializeImageInput({
    input: options.input,
    outputDir: path.join(DEFAULT_OUTPUT_DIR, ".downloads"),
  });

  const outputPath = await cropImageToPortrait916({
    inputPath: tempInput,
    outputPath: options.output,
  });

  console.log(`Prepared 9:16 cover image written to ${outputPath}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
