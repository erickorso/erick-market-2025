import React, { Suspense } from "react";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import ErrorBoundary from "./ErrorBoundary";

const ThreeDBackground = React.lazy(() => import("./ThreeDBackground"));

/**
 * Decorative Three.js scene, mounted defensively:
 *
 * - skipped entirely when the visitor asked for reduced motion, which also
 *   spares them the ~475 kB chunk;
 * - lazy, so it never blocks first paint;
 * - behind a boundary that falls back to nothing, since a WebGL failure must
 *   not cost anyone the market.
 */
const MarketBackground: React.FC = () => {
  if (useReducedMotion()) return null;

  return (
    <ErrorBoundary source="background" fallback={null}>
      <Suspense fallback={null}>
        <ThreeDBackground />
      </Suspense>
    </ErrorBoundary>
  );
};

export default MarketBackground;
