import preview from "../../.storybook/preview";
import { selectedDate, vacationPeriods } from "../../.storybook/fixtures";
import { VacationDialog } from "./vacation-dialog";

const meta = preview.meta({
  component: VacationDialog,
  tags: ["ai-generated"]
});

export const WithExistingPeriod = meta.story({
  args: {
    vacationPeriods,
    defaultDate: selectedDate,
    onChanged: async () => {}
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /отпуск/i }));
  }
});

export const Empty = meta.story({
  args: {
    vacationPeriods: [],
    defaultDate: selectedDate,
    onChanged: async () => {}
  }
});
