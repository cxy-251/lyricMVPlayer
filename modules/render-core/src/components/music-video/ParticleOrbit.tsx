import React from "react";

type ParticleOrbitProps = {
  currentFrame: number;
  energy: number;
  high: number;
  beat: number;
  onset: number;
};

const particles = Array.from({length: 11}, (_, index) => ({
  id: index,
  baseAngle: (Math.PI * 2 * index) / 11,
  radius: 136 + (index % 4) * 14,
  size: 2 + (index % 2),
  speed: 0.0036 + (index % 5) * 0.00055
}));

export const ParticleOrbit: React.FC<ParticleOrbitProps> = ({currentFrame, energy, high, beat, onset}) => {
  return (
    <div className="pointer-events-none absolute left-1/2 top-[560px] z-20 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2">
      {particles.map((particle) => {
        const angle = particle.baseAngle + currentFrame * particle.speed;
        const burst = Math.max(beat * 0.9, onset * 1.1);
        const radius = particle.radius + burst * 12 + (particle.id % 4 === 0 ? burst * 6 : 0);
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * (radius * 0.48);
        const shimmer = high * (particle.id % 3 === 0 ? 0.18 : 0.08);
        const opacity = 0.04 + energy * 0.07 + shimmer + burst * (particle.id % 5 === 0 ? 0.12 : 0.05);
        return (
          <div
            key={particle.id}
            className="absolute left-1/2 top-1/2 rounded-full bg-blue-100"
            style={{
              width: particle.size * 2,
              height: particle.size * 2,
              transform: `translate(${x}px, ${y}px)`,
              opacity,
              boxShadow: `
                0 0 ${6 + burst * 8 + shimmer * 12}px rgba(170,200,255,${0.06 + opacity * 0.16}),
                0 ${10 + burst * 18}px ${10 + burst * 18}px rgba(170,200,255,${0.025 + opacity * 0.05})
              `
            }}
          />
        );
      })}
    </div>
  );
};
