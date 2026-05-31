const modulePath = (songDirName, fileName) => `../../artifacts/songs/${songDirName}/${fileName}`;
const importPath = (songDirName, fileName) => JSON.stringify(modulePath(songDirName, fileName));
const assetUrl = (songDirName, fileName) => `new URL(${importPath(songDirName, fileName)}, import.meta.url).href`;

export const generatePreviewAssetMapSource = ({assets, selectedSongDirName}) => {
  const selectedEntry = assets.find((entry) => entry.id === selectedSongDirName) ?? assets[0];
  if (!selectedEntry) {
    throw new Error("Cannot generate preview asset map without at least one song");
  }

  const imports = [
    'import type {AudioFeatureTrack} from "../../modules/render-core/src";',
    'import type {PreviewAssetMap, RawRenderInput, SelectedPreviewSongData} from "./preview-library/types";',
    `import selectedAudioFeatures from ${importPath(selectedEntry.id, "audio-features.json")};`,
    ...(selectedEntry.hasRenderInput
      ? [`import selectedRenderInput from ${importPath(selectedEntry.id, "render-input.json")};`]
      : []),
  ];

  const assetEntries = assets
    .map((entry) => {
      const fields = [
        `audioSrc: ${assetUrl(entry.id, "audio.mp3")}`,
        entry.hasRenderInput
          ? `loadRenderInput: () => loadJson<RawRenderInput>(${assetUrl(entry.id, "render-input.json")})`
          : "loadRenderInput: async () => ({})",
        `loadAudioFeatures: () => loadJson<AudioFeatureTrack>(${assetUrl(entry.id, "audio-features.json")})`,
      ];
      if (entry.backgroundFileName) {
        fields.splice(1, 0, `backgroundSrc: ${assetUrl(entry.id, entry.backgroundFileName)}`);
      }

      return `  ${JSON.stringify(entry.id)}: {
${fields.map((field) => `    ${field}`).join(",\n")}
  }`;
    })
    .join(",\n");

  return `${imports.join("\n")}

const loadJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(\`Failed to load preview song data: \${response.status} \${url}\`);
  }
  return (await response.json()) as T;
};

export const selectedSongData: SelectedPreviewSongData = {
  id: ${JSON.stringify(selectedEntry.id)},
  renderInput: ${selectedEntry.hasRenderInput ? "selectedRenderInput as RawRenderInput" : "{}"},
  audioFeatures: selectedAudioFeatures as AudioFeatureTrack,
};

export const previewAssetMap: PreviewAssetMap = {
${assetEntries}
};
`;
};
