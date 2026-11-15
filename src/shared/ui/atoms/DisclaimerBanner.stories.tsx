/* shared/ui/atoms DisclaimerBanner stories — documentation only (Storybook
   layer); never imported by runtime code. Documents the two fixed medical-
   disclaimer variants (ADR-0001 D4 — copy stays as-is in the atom).
   No color literals — the preview stylesheet provides the Kinetic Obsidian
   token canvas (ADR-0001 D5). */

import type { Meta, StoryObj } from "@storybook/react-vite";
import { DisclaimerBanner } from "./DisclaimerBanner";

const meta = {
  title: "Atoms/DisclaimerBanner",
  component: DisclaimerBanner,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: { variant: "basic" },
} satisfies Meta<typeof DisclaimerBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = { args: { variant: "basic" } };
export const Disease: Story = { args: { variant: "disease" } };
