import { useMemo } from 'react';

export interface UseTextParticlesOptions {
  text: string;
  fontSize?: number;
  fontFamily?: string;
  gridResolution?: number; // How fine the grid is (lower is denser)
  scale?: number;
}

/**
 * Foundation Utility: Extracts non-transparent pixel coordinates from rendered 2D text.
 * This turns any string into a 3D particle data array.
 */
export function useTextParticles({
  text,
  fontSize = 120,
  fontFamily = 'Inter, sans-serif',
  gridResolution = 2,
  scale = 0.1
}: UseTextParticlesOptions) {

  const particleData = useMemo(() => {
    // We use a relatively large canvas to get high resolution text
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    if (!ctx) return new Float32Array(0);

    // Clear and setup text
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000'; // We just need alpha, but color doesn't hurt
    ctx.font = `bold ${fontSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Draw text in the center
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    // Read pixels back
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    const positions: number[] = [];

    // Scan the grid
    for (let y = 0; y < canvas.height; y += gridResolution) {
      for (let x = 0; x < canvas.width; x += gridResolution) {
        // Alpha channel is at index (y * width + x) * 4 + 3
        const alphaIndex = (y * canvas.width + x) * 4 + 3;
        
        if (data[alphaIndex] > 128) { // If pixel is solid enough
          // Map to 3D space, center at 0,0
          const posX = (x - canvas.width / 2) * scale;
          const posY = -(y - canvas.height / 2) * scale; // Invert Y for WebGL
          
          positions.push(posX, posY, 0.0);
        }
      }
    }

    // Return a flat Float32Array
    return new Float32Array(positions);
  }, [text, fontSize, fontFamily, gridResolution, scale]);

  return particleData;
}
