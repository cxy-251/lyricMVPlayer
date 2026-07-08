import React from "react";

export const SpectrumCaseStudy: React.FC = () => (
  <section className="spectrum-case-study" aria-label="Spectrum Atlas case study">
    <div className="spectrum-case-study__intro">
      <p>Case Study</p>
      <h2>Spectrum Atlas turns a color dataset into a spatial browser and archive wall.</h2>
    </div>

    <div className="spectrum-case-study__grid">
      <article>
        <span>01</span>
        <h3>3D terrain</h3>
        <p>
          The 3D mode maps color families into radial spokes, then uses tone, lightness, and saturation to create a
          low-camera spectrum terrain.
        </p>
      </article>
      <article>
        <span>02</span>
        <h3>2D archive</h3>
        <p>
          The 2D mode keeps the same selected color and presents the dataset as dense research cards with vertical
          names, HEX, RGB, and CMYK context.
        </p>
      </article>
      <article>
        <span>03</span>
        <h3>Shared output</h3>
        <p>
          DOM overlays handle search, mode switching, URL hash state, localStorage state, and export formats for design
          system reuse.
        </p>
      </article>
      <article>
        <span>04</span>
        <h3>Portfolio system</h3>
        <p>
          The same color objects can later feed Gradient Atlas, Palette Atlas, UI templates, WebGL scenes, and Remotion
          visual systems.
        </p>
      </article>
    </div>

    <div className="spectrum-case-study__systems">
      <strong>Reference note</strong>
      <p>
        Inspired by the interaction pattern of{" "}
        <a href="https://zhongguose.com/" target="_blank" rel="noreferrer">
          zhongguose.com
        </a>{" "}
        and open-source Chinese color datasets, without reusing the original site's branding, logo, ads, or commercial
        copy.
      </p>
    </div>
  </section>
);
