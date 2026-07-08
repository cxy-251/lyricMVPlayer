import type {SpectrumColor} from "../data/spectrum-colors";

export type DiscLayout = {
  position: [number, number, number];
  scale: number;
  angle: number;
};

const familyOrder: SpectrumColor["family"][] = [
  "red",
  "orange",
  "yellow",
  "green",
  "cyan",
  "blue",
  "purple",
  "pink",
  "brown",
  "neutral",
];

export const spectrumFamilyOrder = familyOrder;

const ringFamilySlots = [2, 3, 4, 4, 5, 6];
const ringStartByFamily = ringFamilySlots.reduce<number[]>((starts, slots, index) => {
  starts[index] = index === 0 ? 0 : starts[index - 1] + ringFamilySlots[index - 1];
  return starts;
}, []);

const getRingForLocalIndex = (localIndex: number): {ring: number; localInRing: number} => {
  for (let ring = 0; ring < ringFamilySlots.length; ring += 1) {
    const start = ringStartByFamily[ring];
    const end = start + ringFamilySlots[ring];
    if (localIndex >= start && localIndex < end) {
      return {ring, localInRing: localIndex - start};
    }
  }

  const ring = ringFamilySlots.length - 1;
  return {ring, localInRing: ringFamilySlots[ring] - 1};
};

const ringRadii = [7.25, 9.58, 11.92, 14.26, 16.6, 18.94];
const ringPhase = [0, 0.42, -0.34, 0.68, -0.52, 0.26];

export const getDiscLayout = (color: SpectrumColor, index: number, total: number): DiscLayout => {
  const familyIndex = Math.max(0, familyOrder.indexOf(color.family));
  const localIndex = index % 24;
  const lightness = color.hsl[2] / 100;
  const {ring, localInRing} = getRingForLocalIndex(localIndex);
  const slotsInFamily = ringFamilySlots[ring];
  const ringTotal = slotsInFamily * familyOrder.length;
  const globalSlot = familyIndex * slotsInFamily + localInRing;
  const redCenterOffset = slotsInFamily / 2;
  const stagger = ring % 2 === 0 ? 0 : 0.5;
  const angleOnRing =
    ((globalSlot + 0.5 + stagger - redCenterOffset) / ringTotal) * Math.PI * 2 + ringPhase[ring];
  const radius = ringRadii[ring] + (lightness - 0.5) * 0.08;
  const x = Math.sin(angleOnRing) * radius * 1.2;
  const z = Math.cos(angleOnRing) * radius * 0.86 - 7.2;
  const y = (lightness - 0.5) * 0.04;
  const scale = 0.72;
  const angle = (index / Math.max(total, 1)) * Math.PI * 2;

  return {position: [x, y, z], scale, angle};
};

export const findNearestColorIndex = (colors: SpectrumColor[], selectedId: string): number =>
  Math.max(0, colors.findIndex((color) => color.id === selectedId));
