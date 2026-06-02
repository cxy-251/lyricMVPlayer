import React from "react";

export const StudioHomePage: React.FC = () => {
  return (
    <main className="studio-page">
      <a className="studio-home-link" href="/">
        LyricsMusic
      </a>
      <section className="studio-index">
        <div className="studio-index__header">
          <p>Studio</p>
          <h1>Media Lab</h1>
        </div>
        <div className="studio-index__grid">
          <a className="studio-index__item" href="/studio/effects">
            <span>Effects</span>
            <strong>Visual Lab</strong>
          </a>
          <a className="studio-index__item" href="/studio/papers">
            <span>Papers</span>
            <strong>Paper Player</strong>
          </a>
        </div>
      </section>
    </main>
  );
};
