type PythonExecutionMode = "conda" | "direct";

const DEFAULT_MODE: PythonExecutionMode = (process.env.PAPER_TO_VIDEO_PYTHON_MODE as PythonExecutionMode) || "conda";
const DEFAULT_CONDA_ENV = process.env.PAPER_TO_VIDEO_CONDA_ENV ?? "kwai";
const DEFAULT_PYTHON_BIN = process.env.PAPER_TO_VIDEO_PYTHON_BIN ?? "python";

export const resolvePythonCommand = (scriptPath: string, scriptArgs: string[]) => {
  const mode = DEFAULT_MODE;

  if (mode === "direct") {
    return {
      command: DEFAULT_PYTHON_BIN,
      args: [scriptPath, ...scriptArgs],
    };
  }

  return {
    command: "conda",
    args: ["run", "-n", DEFAULT_CONDA_ENV, DEFAULT_PYTHON_BIN, scriptPath, ...scriptArgs],
  };
};

export const resolveFfprobeBinary = () => {
  return process.env.PAPER_TO_VIDEO_FFPROBE_BIN ?? process.env.FFPROBE_BIN ?? "/opt/homebrew/bin/ffprobe";
};
