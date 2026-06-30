export type AlbumGalleryPlayerTheme = {
  swatch: string;
  background: string;
  disc: string;
  discCore: string;
  ink: "dark" | "light";
};

export const playerThemes: AlbumGalleryPlayerTheme[] = [
  {
    swatch: "#e76255",
    background: "linear-gradient(135deg, #ead4dc 0%, #f6edf0 48%, #e4d5ca 100%)",
    disc: "rgba(84, 78, 78, 0.5)",
    discCore: "rgba(232, 197, 116, 0.92)",
    ink: "dark",
  },
  {
    swatch: "#efb35f",
    background: "linear-gradient(135deg, #f4d8b9 0%, #edc071 45%, #f8ecd3 100%)",
    disc: "rgba(188, 126, 37, 0.58)",
    discCore: "rgba(255, 237, 184, 0.9)",
    ink: "dark",
  },
  {
    swatch: "#8db5a9",
    background: "linear-gradient(135deg, #dee9e4 0%, #aac9bf 50%, #ecf1ed 100%)",
    disc: "rgba(72, 109, 99, 0.52)",
    discCore: "rgba(201, 232, 219, 0.9)",
    ink: "dark",
  },
  {
    swatch: "#221f22",
    background: "linear-gradient(135deg, #141216 0%, #282229 52%, #0e0d10 100%)",
    disc: "rgba(17, 17, 18, 0.78)",
    discCore: "rgba(75, 70, 74, 0.92)",
    ink: "light",
  },
];

export const clampIndex = (value: number, length: number) => Math.max(0, Math.min(Math.max(0, length - 1), value));

const normalizeOffset = (offset: number) => Math.max(-5, Math.min(5, offset));

export const buildAlbumTransform = (offset: number, playerPresence: number) => {
  const clamped = normalizeOffset(offset);
  const abs = Math.abs(clamped);
  const side = clamped < 0 ? -1 : 1;
  const x = clamped * 184 - side * Math.max(0, abs - 1) * 32;
  const z = -abs * 156;
  const rotateY = clamped === 0 ? 0 : side * -58;
  const scale = Math.max(0.54, 1.12 - abs * 0.105) * (1 - playerPresence * (abs < 0.4 ? 0.1 : 0.03));
  const y = abs * 14 + playerPresence * (abs < 0.4 ? -20 : 6);
  return `translate3d(${x}px, ${y}px, ${z}px) rotateY(${rotateY}deg) scale(${scale})`;
};
