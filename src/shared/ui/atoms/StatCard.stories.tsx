/* shared/ui/atoms StatCard stories — documentation only (Storybook layer);
   never imported by runtime code. Imports the atom relatively (same layer).
   Both tones shown side by side (muted history vs accent primary metric,
   plan A2). No color literals — the preview stylesheet provides the
   Kinetic Obsidian token canvas (ADR-0001 D5). */

import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatCard } from "./StatCard";

const meta = {
  title: "Atoms/StatCard",
  component: StatCard,
  tags: ["autodocs"],
  args: { label: "Weekly volume", value: "12,480 kg", tone: "muted" },
} satisfies Meta<typeof StatCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Muted: Story = { args: { tone: "muted" } };
export const Accent: Story = { args: { tone: "accent" } };
