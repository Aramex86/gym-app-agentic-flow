/* .storybook/main — Storybook tooling config (outside the FSAA src layers;
   never imported by app code). Discovers stories co-located next to atoms
   under src/**. Addon set per plan A6: docs + a11y only — addon-vitest is
   deliberately absent (it would need browser-test wiring in vite.config.ts,
   which is a forbidden file). `@storybook/react-vite` loads vite.config.ts
   automatically, so the Tailwind plugin and path aliases apply. */

import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
  framework: "@storybook/react-vite",
};

export default config;
