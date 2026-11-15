/* shared/ui/atoms Button stories — documentation only (Storybook layer);
   never imported by runtime code. Imports the atom relatively (same layer)
   and types from the framework package. No color literals — the preview
   stylesheet provides the Kinetic Obsidian token canvas (ADR-0001 D5). */

import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./Button";

const meta = {
  title: "Atoms/Button",
  component: Button,
  tags: ["autodocs"],
  args: { children: "Start session", onClick: () => {} },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { variant: "primary" } };
export const Secondary: Story = { args: { variant: "secondary" } };
export const Disabled: Story = { args: { disabled: true } };
