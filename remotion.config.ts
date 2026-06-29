import {Config} from "@remotion/cli/config";
import {enableTailwind} from "@remotion/tailwind-v4";

Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setChromiumOpenGlRenderer("angle");
Config.overrideWebpackConfig((config) => {
  const tailwindConfig = enableTailwind(config);
  return {
    ...tailwindConfig,
    resolve: {
      ...tailwindConfig.resolve,
      alias: {
        ...(tailwindConfig.resolve?.alias || {}),
        "@lyric-mv/lyric-video": require("path").resolve(process.cwd(), "packages/lyric-video/index.ts")
      }
    }
  };
});
