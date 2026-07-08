import React from "react";
import {Link} from "react-router";

export const StudioHomePage: React.FC = () => {
  return (
    <main className="studio-page">
      <Link className="studio-home-link" to="/">
        LyricsMusic
      </Link>
      <section className="studio-index">
        <div className="studio-index__header">
          <p>Studio</p>
          <h1>Media Lab</h1>
        </div>
        <div className="studio-index__grid">
          <Link className="studio-index__item" to="/studio/effects">
            <span>Effects</span>
            <strong>Visual Lab</strong>
          </Link>
          <Link className="studio-index__item" to="/studio/papers">
            <span>Papers</span>
            <strong>Paper Player</strong>
          </Link>
          <Link className="studio-index__item" to="/studio/album-gallery">
            <span>Albums</span>
            <strong>Album Gallery</strong>
          </Link>
          <Link className="studio-index__item" to="/studio/gradient-atlas">
            <span>Colors</span>
            <strong>Gradient Atlas</strong>
          </Link>
        </div>
      </section>
    </main>
  );
};
