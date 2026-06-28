import {Link} from "react-router";
import type {DemoDefinition} from '../types';

export function Gallery({
  demos,
  onNavigate,
}: {
  demos: DemoDefinition[];
  onNavigate: (route: string) => void;
}) {
  return (
    <main className="gallery-page">
      <section className="gallery-shell" aria-labelledby="gallery-title">
        <header className="gallery-header">
          <div>
            <Link className="studio-back-link" to="/studio">Studio</Link>
            <p className="eyebrow">Web3D Lab</p>
            <h1 id="gallery-title">Real-time 3D experiments</h1>
          </div>
          <p className="gallery-intro">
            A focused creative coding lab for shader-heavy, interactive, browser-native 3D studies.
          </p>
        </header>

        <div className="gallery-grid">
          {demos.map((demo) => (
            <article className="demo-card" key={demo.id}>
              <a
                className="demo-card-link"
                href={demo.route}
                onClick={(event) => {
                  event.preventDefault();
                  onNavigate(demo.route);
                }}
              >
                <div className={`demo-preview demo-preview--${demo.id}`} aria-hidden="true">
                  <span className="preview-core" />
                  <span className="preview-ring preview-ring-a" />
                  <span className="preview-ring preview-ring-b" />
                  <span className="preview-spark preview-spark-a" />
                  <span className="preview-spark preview-spark-b" />
                  <span className="preview-spark preview-spark-c" />
                </div>
                <div className="demo-card-body">
                  <div className="tag-row">
                    {demo.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                  <h2>{demo.title}</h2>
                  <p>{demo.description}</p>
                  <span className="open-label">Open demo</span>
                </div>
              </a>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
