/* .storybook/preview — global decorators/parameters for the Storybook layer
   (tooling, outside FSAA src layers). Imports the app stylesheet
   (plan A4): globals.css pulls in fonts, Tailwind, tokens.css (ADR-0001 D5
   source of truth) and the body canvas styles — same entry as main.tsx.
   No token values are duplicated here. Stories are documentation only;
   nothing in this folder is imported by runtime code. */

import type { Preview } from "@storybook/react-vite";
import "../src/app/globals.css";

const preview: Preview = {
  parameters: {
    layout: "centered",
    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/i },
    },
    a11y: { test: "todo" },
  },
};

export default preview;
