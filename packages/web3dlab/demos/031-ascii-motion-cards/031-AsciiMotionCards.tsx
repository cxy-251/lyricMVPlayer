import {useControls} from 'leva';
import {useEffect, useRef, useState} from 'react';

type CardControls = {
  density: number;
  driftSpeed: number;
  threshold: number;
  glyphSet: string;
  ink: string;
  accent: string;
};

type MotionCard = {
  title: string;
  description: string;
  variant: number;
};

const CARDS: MotionCard[] = [
  {
    title: 'Signal Orbit',
    description: 'Two data lobes orbit a carved center while binary density exposes their overlap.',
    variant: 0,
  },
  {
    title: 'Narrative Current',
    description: 'A compact signal body releases a moving tail that reveals direction and momentum.',
    variant: 1,
  },
  {
    title: 'Folded Wave',
    description: 'Layered character ridges fold into a soft waveform with a moving interference seam.',
    variant: 2,
  },
];

const GLYPH_SETS: Record<string, string> = {
  Binary: '0101011001010011',
  Dense: '@%#*+=-:.',
  Math: 'Σ∆∫≈+−×·',
};

const shapeField = (x: number, y: number, variant: number, time: number) => {
  const nx = x * 2 - 1;
  const ny = y * 2 - 1;

  if (variant === 0) {
    const lobeA = Math.hypot(nx + 0.27 + Math.sin(time * 0.7) * 0.05, ny * 1.2 + 0.08);
    const lobeB = Math.hypot(nx - 0.2, ny * 1.05 - 0.1);
    const centerCut = Math.hypot(nx * 1.15, ny * 1.28);
    return Math.max(0, 1 - Math.min(lobeA, lobeB) * 1.25) * (centerCut > 0.32 ? 1 : 0.18);
  }

  if (variant === 1) {
    const body = 1 - Math.hypot(nx * 0.9 - 0.12, ny * 1.62) * 1.42;
    const tailY = ny - Math.sin(nx * 5.5 + time) * 0.1;
    const tail = 1 - Math.hypot(nx * 1.7 + 0.58, tailY * 3.1) * 1.08;
    return Math.max(0, Math.max(body, tail * 0.82));
  }

  const ridgeA = Math.exp(-Math.abs(ny - Math.sin(nx * 4.2 + time * 0.8) * 0.24) * 5.8);
  const ridgeB = Math.exp(-Math.abs(ny + Math.sin(nx * 3.2 - time * 0.55) * 0.2) * 6.8);
  const envelope = Math.max(0, 1 - Math.abs(nx) * 0.72);
  return Math.max(0, Math.max(ridgeA, ridgeB * 0.74) * envelope);
};

function AsciiArtwork({
  controls,
  paused,
  variant,
}: {
  controls: CardControls;
  paused: boolean;
  variant: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controlsRef = useRef(controls);
  const pausedRef = useRef(paused);
  controlsRef.current = controls;
  pausedRef.current = paused;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let width = 1;
    let height = 1;
    let animationFrame = 0;
    let previousTime = performance.now();
    let elapsed = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (now: number) => {
      const delta = Math.min((now - previousTime) / 1000, 0.04);
      previousTime = now;
      const current = controlsRef.current;
      if (!pausedRef.current) elapsed += delta * current.driftSpeed;
      const glyphs = GLYPH_SETS[current.glyphSet] ?? GLYPH_SETS.Binary;
      const columns = Math.max(24, Math.round(current.density));
      const rows = Math.max(18, Math.round(columns * (height / width) * 0.74));
      const cellWidth = width / columns;
      const cellHeight = height / rows;

      context.fillStyle = '#f7f7f4';
      context.fillRect(0, 0, width, height);
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = `${Math.max(6, cellWidth * 0.82)}px "SFMono-Regular", Menlo, Consolas, monospace`;

      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          const u = column / Math.max(1, columns - 1);
          const v = row / Math.max(1, rows - 1);
          const signal = shapeField(u, v, variant, elapsed);
          const grain = Math.sin(column * 0.53 + row * 0.31 + elapsed * 1.7) * 0.1;
          const density = signal + grain;
          if (density < current.threshold) continue;
          const intensity = Math.min(1, Math.max(0, density));
          const drift = Math.sin(elapsed * 1.2 + column * 0.17 + row * 0.09) * intensity * 2.2;
          context.globalAlpha = 0.18 + intensity * 0.78;
          context.fillStyle = intensity > 0.66 ? current.accent : current.ink;
          context.fillText(
            glyphs[(column + row * 7 + variant * 11) % glyphs.length],
            (column + 0.5) * cellWidth + drift,
            (row + 0.5) * cellHeight,
          );
        }
      }

      context.globalAlpha = 1;
      animationFrame = requestAnimationFrame(draw);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    animationFrame = requestAnimationFrame(draw);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(animationFrame);
    };
  }, [variant]);

  return <canvas ref={canvasRef} style={{display: 'block', width: '100%', height: '100%'}} />;
}

export default function Demo031AsciiMotionCards() {
  const [activeCard, setActiveCard] = useState(0);
  const [paused, setPaused] = useState(false);
  const controls = useControls('ASCII Motion Cards', {
    density: {value: 58, min: 34, max: 88, step: 1, label: 'Glyph density'},
    driftSpeed: {value: 0.72, min: 0, max: 1.2, step: 0.01, label: 'Motion speed'},
    threshold: {value: 0.2, min: 0.08, max: 0.48, step: 0.01, label: 'Shape threshold'},
    glyphSet: {value: 'Binary', options: Object.keys(GLYPH_SETS), label: 'Glyph set'},
    ink: {value: '#46549f', label: 'Base ink'},
    accent: {value: '#8a62d0', label: 'Dense ink'},
  }) as CardControls;
  const card = CARDS[activeCard];
  const previous = () => setActiveCard((value) => (value - 1 + CARDS.length) % CARDS.length);
  const next = () => setActiveCard((value) => (value + 1) % CARDS.length);

  return (
    <div
      className="demo-viewport"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '74px 18px 18px',
        background: '#11141b',
        color: '#111318',
        boxSizing: 'border-box',
      }}
    >
      <article
        aria-live="polite"
        style={{
          display: 'grid',
          gridTemplateRows: 'auto minmax(0, 1fr) auto',
          width: 'min(540px, calc(100vw - 36px))',
          height: 'min(680px, calc(100vh - 158px))',
          minHeight: 320,
          overflow: 'hidden',
          border: '1px solid rgba(12,15,22,0.2)',
          borderRadius: 7,
          background: '#ffffff',
          boxShadow: '0 20px 55px rgba(25,30,42,0.16)',
        }}
      >
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '15px 17px 12px',
            borderBottom: '1px solid rgba(12,15,22,0.12)',
            fontFamily: '"SFMono-Regular", Menlo, Consolas, monospace',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          <span>ASCII MOTION STUDY</span>
          <span>{String(activeCard + 1).padStart(2, '0')} / {String(CARDS.length).padStart(2, '0')}</span>
        </header>

        <div style={{minHeight: 0, overflow: 'hidden'}}>
          <AsciiArtwork controls={controls} paused={paused} variant={card.variant} />
        </div>

        <footer
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: 18,
            alignItems: 'end',
            padding: '18px 19px 20px',
            borderTop: '1px solid rgba(12,15,22,0.12)',
          }}
        >
          <div>
            <h2 style={{margin: 0, fontFamily: 'Georgia, serif', fontSize: 30, fontWeight: 500}}>
              {card.title}
            </h2>
            <p style={{maxWidth: 390, margin: '8px 0 0', color: '#606571', fontSize: 13, lineHeight: 1.45}}>
              {card.description}
            </p>
          </div>
          <button
            aria-label="Show next ASCII study"
            onClick={next}
            style={{
              border: 0,
              borderRadius: 5,
              background: '#111318',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '10px 13px',
              fontSize: 13,
              fontWeight: 800,
            }}
            type="button"
          >
            Next
          </button>
        </footer>
      </article>

      <nav
        aria-label="ASCII card controls"
        style={{
          display: 'flex',
          gap: 8,
          padding: 5,
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 7,
          background: 'rgba(24,28,38,0.9)',
        }}
      >
        <button onClick={previous} style={navigationButtonStyle} type="button">Previous</button>
        <button onClick={() => setPaused((value) => !value)} style={navigationButtonStyle} type="button">
          {paused ? 'Play' : 'Pause'}
        </button>
        <button onClick={next} style={navigationButtonStyle} type="button">Next</button>
      </nav>
    </div>
  );
}

const navigationButtonStyle = {
  border: '1px solid rgba(17,19,24,0.2)',
  borderRadius: 5,
  background: '#ffffff',
  color: '#111318',
  cursor: 'pointer',
  padding: '8px 13px',
  fontSize: 12,
  fontWeight: 750,
} as const;
