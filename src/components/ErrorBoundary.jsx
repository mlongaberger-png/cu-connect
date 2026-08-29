import React from "react";

// Top-level React error boundary.
//
// Why this exists: on Aug 12, 2026 a single uncaught render error inside
// SponsorTicker.jsx (a component rendered on every authenticated page)
// blanked the ENTIRE app to a black screen for every user viewing any page
// at that moment, recoverable only by a full reload. That specific bug was
// fixed at its source, but nothing above it in the tree was catching
// render errors -- so the same failure mode (one uncaught error anywhere
// in the component tree unmounting the whole React app) could still recur
// from any other component. This boundary is the structural fix: it wraps
// the entire app (see src/App.jsx) so any future render error shows a
// friendly "something went wrong" screen instead of a blank one, and the
// person can recover by reloading rather than being stuck.
//
// Deliberately simple: no external error-tracking service is wired into
// this app today, so this only logs to the console and offers a reload.
// If/when an error-tracking integration is added, report the caught error
// (this.state.error / errorInfo) to it inside componentDidCatch below.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // eslint-disable-next-line no-console
    console.error("Uncaught render error caught by top-level ErrorBoundary:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="bg-card border border-border rounded-2xl p-8 text-center max-w-sm">
            <p className="text-foreground font-semibold mb-2">Something went wrong</p>
            <p className="text-sm text-muted-foreground">
              An unexpected error occurred. Reloading the page usually fixes this.
            </p>
            <button
              onClick={this.handleReload}
              className="mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
