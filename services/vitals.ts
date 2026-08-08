import { onCLS, onINP, onLCP, onFCP, onTTFB, type Metric } from "web-vitals";
import { reportVital } from "./reporter";

/**
 * Field performance, measured on real visitors rather than in a lab.
 *
 * The five Core-Web-Vitals-adjacent metrics answer different questions:
 * TTFB and FCP say whether the BFF and the bundle are the problem, LCP whether
 * the market grid paints fast, CLS whether the lazy 3D background and the
 * chart shift the page, and INP whether trading stays responsive.
 *
 * Each fires once per page when its value is final, so this costs one small
 * beacon per session, batched with everything else.
 */
export function reportWebVitals() {
  if (typeof window === "undefined") return;

  const send = (metric: Metric) =>
    reportVital({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
    });

  onTTFB(send);
  onFCP(send);
  onLCP(send);
  onCLS(send);
  onINP(send);
}
