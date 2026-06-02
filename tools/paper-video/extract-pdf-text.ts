import path from "node:path";
import {spawn} from "node:child_process";
import {resolvePythonCommand} from "./lib/python-runtime";

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

const parseArgs = () => {
  const args = process.argv.slice(2);
  const getValue = (flag: string) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };

  const inputPdf = getValue("--input-pdf");
  const outputText = getValue("--output-text");

  if (!inputPdf || !outputText) {
    throw new Error("Usage: npm run extract:pdf-text -- --input-pdf <path> --output-text <path>");
  }

  return {
    inputPdf: path.resolve(inputPdf),
    outputText: path.resolve(outputText),
  };
};

const main = async () => {
  const {inputPdf, outputText} = parseArgs();
  const pythonCommand = resolvePythonCommand("services/paper-ingest/extract_pdf_text.py", [
    "--input-pdf",
    inputPdf,
    "--output-text",
    outputText,
  ]);
  await run(pythonCommand.command, pythonCommand.args);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
