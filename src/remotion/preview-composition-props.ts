
import manifestJson from "./preview-library-manifest.json";
import {previewAssetMap, selectedSongData} from "./preview-asset-map";
import {buildPreviewCompositionProps} from "./preview-library/composition-props";
import type {PreviewLibraryManifest} from "./preview-library/types";

const manifest = {
  ...(manifestJson as PreviewLibraryManifest),
};

export const previewCompositionProps = buildPreviewCompositionProps({
  manifest,
  assets: previewAssetMap,
  selectedSongData,
});
