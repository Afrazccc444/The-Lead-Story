import { Component } from 'react';

/**
 * Catches rendering errors so a single problem never leaves readers with a
 * blank white page.
 */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[The Lead Story] display error:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash" role="alert">
        <p className="section-label">The Lead Story</p>
        <h1 className="crash__title">Something went wrong on this page</h1>
        <p className="crash__text">Please reload. If it keeps happening, the rest of the site still works.</p>
        <div className="crash__actions">
          <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
            Reload page
          </button>
          <a className="btn btn--ghost" href="/">
            Go to the latest edition
          </a>
        </div>
      </div>
    );
  }
}
