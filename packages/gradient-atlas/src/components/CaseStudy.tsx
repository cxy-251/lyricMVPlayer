import React from "react";

import {gradientDataAttribution} from "../data/gradients";

export const CaseStudy: React.FC = () => {
  return (
    <section className="gradient-case-study">
      <div className="gradient-case-study__intro">
        <p>Case Study</p>
        <h2>Gradient Atlas turns a preset list into a reusable visual system module.</h2>
      </div>

      <div className="gradient-case-study__grid">
        <article>
          <span>01</span>
          <h3>Designer workflow</h3>
          <p>
            The page helps designers browse, inspect, favorite, and export gradients without leaving a visual context.
            The first screen behaves like a real color lab rather than a static clone.
          </p>
        </article>
        <article>
          <span>02</span>
          <h3>Data model</h3>
          <p>
            Each preset is a typed object with id, name, colors, direction, tags, and source. Custom gradients reuse
            the same structure and persist locally.
          </p>
        </article>
        <article>
          <span>03</span>
          <h3>Generated tags</h3>
          <p>
            HEX colors are converted to HSL, then simple hue, saturation, and lightness rules produce tags such as
            warm, cold, pastel, neon, ocean, sunset, and cyberpunk.
          </p>
        </article>
        <article>
          <span>04</span>
          <h3>Export formats</h3>
          <p>
            One preset can become CSS, Tailwind config, CSS variables, React inline styles, JSON, or a shareable PNG
            preview.
          </p>
        </article>
      </div>

      <div className="gradient-case-study__systems">
        <strong>Portfolio value</strong>
        <p>
          This can feed WebGL scenes, Remotion videos, AI Book visuals, and CleanKsen interface themes as a compact
          palette foundation.
        </p>
        <small>
          {gradientDataAttribution.label}. Gradient data source can be attributed if reused:
          {" "}
          <a href={gradientDataAttribution.sourceUrl} target="_blank" rel="noreferrer">
            {gradientDataAttribution.sourceName}
          </a>.
        </small>
      </div>
    </section>
  );
};
