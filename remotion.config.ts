import {Config} from "@remotion/cli/config";
import {enableTailwind} from "@remotion/tailwind-v4";

Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.overrideWebpackConfig(enableTailwind);
