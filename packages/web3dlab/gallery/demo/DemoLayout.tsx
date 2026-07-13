import {Leva} from 'leva';
import {Link} from "react-router";
import {useState, type ReactNode} from 'react';

import type {DemoMetadata} from '../../types';

export function DemoLayout({
  children,
  controlsCollapsed = true,
  metadata,
  onBack,
  onNext,
  onPrevious,
  nextTitle,
  previousTitle,
}: {
  children: ReactNode;
  controlsCollapsed?: boolean;
  metadata: DemoMetadata;
  onBack: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  nextTitle?: string;
  previousTitle?: string;
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
        <button
          aria-label={previousTitle ? `Previous demo: ${previousTitle}` : 'No previous demo'}
          className="demo-sequence-button"
          disabled={!onPrevious}
          onClick={onPrevious}
          title={previousTitle}
          type="button"
        >
          Previous
        </button>
        <button
          aria-label={nextTitle ? `Next demo: ${nextTitle}` : 'No next demo'}
          className="demo-sequence-button"
          disabled={!onNext}
          onClick={onNext}
          title={nextTitle}
          type="button"
        >
          Next
        </button>
      </div>
      {!infoCollapsed ? (
        <aside className="demo-hud" id="demo-info-panel" aria-label={`${metadata.title} information`}>
          <p className="demo-kicker">
            {metadata.number ? `${metadata.number} · ${metadata.id}` : metadata.id}
          </p>
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
