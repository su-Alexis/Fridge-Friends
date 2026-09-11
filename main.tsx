import { Component, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import Home from "./app/page";
import "./app/globals.css";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="error-page">
        <h1>Something went wrong</h1>
        <p>
          Reopen Fridge Friends to try again. Your saved list stays on this
          device.
        </p>
        <button className="add-list" onClick={() => location.reload()}>
          Reload
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}

// GitHub Pages cannot send frame-ancestors or X-Frame-Options, and CSP
// frame-ancestors is ignored inside a meta tag. Refuse to run inside a frame so
// the UI cannot be overlaid and clicked through by another site.
const framed = (() => {
  try {
    return window.top !== window.self;
  } catch {
    // A cross-origin parent throws on access, which itself means we are framed.
    return true;
  }
})();

// Offline support. The URL is resolved against the document, so one build
// works at https://user.github.io/ and https://user.github.io/repository/
// alike, and the worker's scope is limited to this app's own directory.
if (import.meta.env.PROD && !framed && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(new URL("sw.js", document.baseURI))
      .catch(() => {
        // Offline support is an enhancement; the app works without it.
      });
  });
}

const root = createRoot(document.getElementById("root")!);
root.render(
  framed ? (
    <main className="error-page">
      <h1>Open Fridge Friends directly</h1>
      <p>
        This app does not run inside another site&rsquo;s frame.{" "}
        <a href={window.location.href} target="_blank" rel="noreferrer noopener">
          Open it in a new tab
        </a>
        .
      </p>
    </main>
  ) : (
    <StrictMode>
      <ErrorBoundary>
        <Home />
      </ErrorBoundary>
    </StrictMode>
  ),
);
