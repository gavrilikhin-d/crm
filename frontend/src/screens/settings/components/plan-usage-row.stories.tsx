import preview from "../../../../.storybook/preview";
import { expect } from "storybook/test";
import { PlanUsageRow } from "./plan-usage-row";

const meta = preview.meta({
  component: PlanUsageRow,
  tags: ["ai-generated"]
});

export const Limited = meta.story({
  args: {
    label: "Ученики",
    used: 7,
    limit: 10
  },
  play: async ({ canvas, args }) => {
    await expect(canvas.getByText(`${args.used} / ${args.limit}`)).toBeVisible();
  }
});

export const Unlimited = meta.story({
  args: {
    label: "Занятия в этом месяце",
    used: 18,
    limit: null
  }
});
