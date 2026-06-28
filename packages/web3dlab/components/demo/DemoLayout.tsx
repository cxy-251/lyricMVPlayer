import {Leva} from 'leva';
import {Link} from "react-router";
import type {ReactNode} from 'react';

import type {DemoMetadata} from '../../types';

export function DemoLayout({
  children,
  controlsCollapsed,
  metadata,
  onBack,
}: {
  children: ReactNode;
  controlsCollapsed: boolean;
  metadata: DemoMetadata;
  onBack: () => void;
}) {
  return (
    <main className="demo-page">
      <aside className="demo-hud" aria-label={`${metadata.title} information`}>
        <nav className="demo-hud-nav" aria-label="Effect lab navigation">
          <Link
            className="demo-back-link"
            to="/"
            onClick={(event) => {
              event.preventDefault();
              onBack();
            }}
          >
            Gallery
          </Link>
          <Link className="demo-back-link" to="/studio">Studio</Link>
        </nav>
        <p className="demo-kicker">{metadata.id}</p>
        <h1>{metadata.title}</h1>
        <p className="demo-description">{metadata.description}</p>
        <div className="demo-tag-row" aria-label="Demo tags">
          {metadata.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        {metadata.instructions && metadata.instructions.length > 0 ? (
          <section className="demo-instructions" aria-label="Interaction instructions">
            <strong>Interact</strong>
            <ul>
              {metadata.instructions.map((instruction) => (
                <li key={instruction}>{instruction}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </aside>
      {children}
      <Leva theme={{ sizes: { rootWidth: '380px' } }} collapsed={controlsCollapsed} oneLineLabels={!controlsCollapsed} titleBar={{drag: true}} />
    </main>
  );
}
