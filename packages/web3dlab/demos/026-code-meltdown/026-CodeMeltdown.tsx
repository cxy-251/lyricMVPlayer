import {useControls} from 'leva';
import {useEffect, useRef} from 'react';

const SOURCE_TEXT = `
function visualModule(seed, time, pointer) {
  const energy = fbm(pointer.xy * 2.0 + time);
  const glyph = mix('CODE', 'MELTDOWN', energy);
  return bloom(domainWarp(glyph, seed));
}
`;

type Cell = {
  char: string;
  x: number;
  y: number;
  speed: number;
  phase: number;
  heat: number;
};

const createCells = (columns: number, rows: number): Cell[] => {
  const chars = SOURCE_TEXT.replace(/\s+/g, ' ').repeat(80);
  const cells: Cell[] = [];
  let cursor = 0;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      const seed = (Math.sin((x * 17.31 + y * 91.7) * 12.9898) * 43758.5453) % 1;
      cells.push({
        char: chars[cursor % chars.length],
        x,
        y,
        speed: 0.4 + Math.abs(seed) * 1.7,
        phase: Math.abs(seed) * Math.PI * 2,
        heat: Math.abs(Math.sin(x * 0.19 + y * 0.37)),
      });
      cursor += 1;
    }
  }
  return cells;
};

export default function Demo026CodeMeltdown() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef({x: -9999, y: -9999});
  const controls = useControls('Code Meltdown', {
    cellSize: {value: 16, min: 10, max: 26, step: 1},
    meltSpeed: {value: 0.72, min: 0, max: 2, step: 0.01},
    turbulence: {value: 0.9, min: 0, max: 2.5, step: 0.01},
    heatRadius: {value: 180, min: 60, max: 420, step: 5},
    coldColor: '#58f5ff',
    hotColor: '#ff7a2f',
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let cells: Cell[] = [];
    let columns = 0;
    let rows = 0;
    let animationFrame = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      columns = Math.ceil(width / controls.cellSize) + 2;
      rows = Math.ceil(height / controls.cellSize) + 5;
      cells = createCells(columns, rows);
    };

    const draw = (now: number) => {
      const time = now * 0.001;
      context.fillStyle = 'rgba(2, 4, 10, 0.34)';
      context.fillRect(0, 0, width, height);

      const grd = context.createLinearGradient(0, 0, width, height);
      grd.addColorStop(0, 'rgba(18, 22, 38, 0.24)');
      grd.addColorStop(1, 'rgba(6, 8, 15, 0.72)');
      context.fillStyle = grd;
      context.fillRect(0, 0, width, height);

      context.font = `${Math.round(controls.cellSize * 0.72)}px "SFMono-Regular", Menlo, Consolas, monospace`;
      context.textAlign = 'left';
      context.textBaseline = 'middle';

      for (const cell of cells) {
        const baseX = cell.x * controls.cellSize;
        const fall = (time * 18 * controls.meltSpeed * cell.speed + Math.sin(cell.phase + time * 0.7) * 24) % (height + controls.cellSize * 6);
        const y = (cell.y * controls.cellSize + fall) % (height + controls.cellSize * 4) - controls.cellSize * 2;
        const dx = baseX - pointerRef.current.x;
        const dy = y - pointerRef.current.y;
        const pointerHeat = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / controls.heatRadius);
        const melt = Math.pow(pointerHeat, 2) + cell.heat * 0.18;
        const drift = Math.sin(time * 1.8 + cell.phase + y * 0.018) * controls.cellSize * controls.turbulence * (0.2 + melt);
        const alpha = 0.24 + cell.heat * 0.36 + pointerHeat * 0.5;

        context.globalAlpha = Math.min(1, alpha);
        context.fillStyle = pointerHeat > 0.35 || cell.heat > 0.83 ? controls.hotColor : controls.coldColor;
        context.fillText(cell.char, baseX + drift, y + melt * controls.cellSize * 1.6);
      }

      context.globalAlpha = 1;
      context.fillStyle = 'rgba(255, 255, 255, 0.78)';
      context.font = '12px "SFMono-Regular", Menlo, Consolas, monospace';
      context.fillText('CODE MELTDOWN // pointer heat field', 26, height - 28);
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
  }, [controls]);

  return (
    <div className="demo-viewport">
      <canvas
        ref={canvasRef}
        style={{display: 'block', width: '100%', height: '100%', touchAction: 'none'}}
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          pointerRef.current.x = event.clientX - rect.left;
          pointerRef.current.y = event.clientY - rect.top;
        }}
        onPointerLeave={() => {
          pointerRef.current.x = -9999;
          pointerRef.current.y = -9999;
        }}
      />
    </div>
  );
}
