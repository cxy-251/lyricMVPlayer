import {Config} from "@remotion/cli/config";
import {enableTailwind} from "@remotion/tailwind-v4";

Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setChromiumOpenGlRenderer("angle");
Config.overrideWebpackConfig((config) => {
  const tailwindConfig = enableTailwind(config);
  const resolveProjectPath = (relativePath: string) => require("path").resolve(process.cwd(), relativePath);
  return {
    ...tailwindConfig,
    module: {
      ...tailwindConfig.module,
      rules: [
        ...(tailwindConfig.module?.rules || []),
        {
          test: /\.(glsl|frag|vert)$/i,
          type: "asset/source",
        },
        {
          test: /\.(glb|gltf)$/i,
          type: "asset/resource",
        },
      ],
    },
    resolve: {
      ...tailwindConfig.resolve,
      alias: {
        ...(tailwindConfig.resolve?.alias || {}),
        "@lyric-mv/lyric-video": resolveProjectPath("packages/lyric-video/index.ts"),
        "@lyric-mv/web3dlab": resolveProjectPath("packages/web3dlab/index.ts"),
        "@paper-to-video/components": resolveProjectPath("packages/paper-video/index.ts"),
        "@paper-to-video/content-pipeline": resolveProjectPath("packages/paper-video/content-pipeline/index.ts"),
        "@paper-to-video/shared-types": resolveProjectPath("packages/paper-video/shared-types/index.ts"),
        "@paper-to-video/ui": resolveProjectPath("packages/paper-video/ui/index.ts")
      }
    }
  };
});
