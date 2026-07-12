export const baseLayerStyle = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
} as const;

export const launchButtonBaseStyle = {
  position: "absolute",
  left: "50%",
  top: "50%",
  width: 260,
  marginLeft: -130,
  marginTop: -28,
  padding: "18px 22px",
  borderRadius: 999,
  border: "1px solid rgba(255, 255, 255, 0.16)",
  color: "#f4f7fb",
  fontSize: 15,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  textAlign: "center",
  boxShadow: "0 0 0 10px rgba(87, 216, 196, 0.08), 0 18px 48px rgba(0, 0, 0, 0.28)",
  zIndex: 2,
  cursor: "pointer",
} as const;

export const getLaunchButtonState = (frame: number) => {
  const buttonOrigin = {x: 0.5, y: 0.62};
  const pulse = 1 + Math.sin(frame / 7) * 0.04;
  return { buttonOrigin, pulse };
};

export const getGridDriftBackground = (frame: number) => ({
  backgroundImage: `
    linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(87,216,196,0.14) 0%, transparent 40%, rgba(255,255,255,0.08) 100%)
  `,
  backgroundPosition: `${(frame * 0.8) % 44}px ${(frame * 0.3) % 44}px, ${(frame * 0.8) % 44}px ${(frame * 0.3) % 44}px, 0 0`,
  backgroundSize: "44px 44px, 44px 44px, 100% 100%",
});

export const getNoiseBloomBackground = (frame: number) => ({
  background: `
    radial-gradient(circle at ${22 + (frame % 24)}% 24%, rgba(87,216,196,0.18) 0%, transparent 24%),
    radial-gradient(circle at 80% ${68 + (frame % 16) * 0.4}%, rgba(255,255,255,0.12) 0%, transparent 18%)
  `,
});

export const getAuroraBackground = () => ({
  background:
    "radial-gradient(circle at 18% 22%, rgba(87,216,196,0.14) 0%, transparent 22%), radial-gradient(circle at 82% 76%, rgba(255,255,255,0.1) 0%, transparent 18%)",
});

export const getLaunchButtonBackground = (ready: boolean) =>
  ready ? "rgba(7,18,29,0.36)" : "rgba(5,12,20,0.58)";
