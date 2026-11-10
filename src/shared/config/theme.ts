export const theme = {
  colors: {
    accent: "var(--accent-volt)",
    accentTeal: "var(--accent-teal)",
    accentAmber: "var(--accent-amber)",
    canvas: "var(--canvas)",
    surface: "var(--surface)",
    surfaceLifted: "var(--surface-lifted)",
    edge: "var(--edge)",
    textHigh: "var(--text-high)",
    textMuted: "var(--text-muted)",
  },
  glow: { volt: "var(--accent-glow-volt)", amber: "var(--accent-glow-amber)" },
  sizes: {
    buttonH: 52, // mobile primary CTA
    inputH: 48, // stepper blocks / thumb targets
    chipH: 28,
  },
  fonts: {
    heading: "var(--font-heading)",
    body: "var(--font-body)",
    metric: "var(--font-metric)",
  },
} as const;
