/* shared/ui/atoms ToggleChip stories — documentation only (Storybook layer);
   never imported by runtime code. Imports the atom relatively (same layer).
   No color literals — the preview stylesheet provides the Kinetic Obsidian
   token canvas (ADR-0001 D5). */

import type { Meta, StoryObj } from "@storybook/react-vite";
import { ToggleChip } from "./ToggleChip";

const meta = {
  title: "Atoms/ToggleChip",
  component: ToggleChip,
  tags: ["autodocs"],
  args: { label: "Compact", on: false, onToggle: () => {} },
} satisfies Meta<typeof ToggleChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Off: Story = { args: { on: false } };
export const On: Story = { args: { on: true } };
