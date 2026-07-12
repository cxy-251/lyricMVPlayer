import {Leva} from 'leva';
import {Link} from "react-router";
import {useState, type ReactNode} from 'react';

import type {DemoMetadata} from '../../types';

export function DemoLayout({
  children,
  controlsCollapsed = true,
  metadata,
  onBack,
}: {
  children: ReactNode;
  controlsCollapsed?: boolean;
  metadata: DemoMetadata;
  onBack: () => void;
}) {
  const [infoCollapsed, setInfoCollapsed] = useState(true);

  return (
    <main className="demo-page">
      <div className="demo-top-actions">
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
        </nav>
        <button
          aria-controls="demo-info-panel"
          aria-expanded={!infoCollapsed}
          className="demo-info-toggle"
          onClick={() => setInfoCollapsed((collapsed) => !collapsed)}
          type="button"
        >
          {infoCollapsed ? 'Info' : 'Hide info'}
        </button>
      </div>
      {!infoCollapsed ? (
        <aside className="demo-hud" id="demo-info-panel" aria-label={`${metadata.title} information`}>
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
      ) : null}
      {children}
      <Leva theme={{ sizes: { rootWidth: '380px' } }} collapsed={controlsCollapsed} oneLineLabels={!controlsCollapsed} titleBar={{drag: true}} />
    </main>
  );
}
