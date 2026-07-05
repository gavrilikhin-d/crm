import preview from "../../../../../.storybook/preview";
import { CurrentTimeMarker } from "./current-time-marker";

const meta = preview.meta({
  component: CurrentTimeMarker,
  tags: ["ai-generated"]
});

export const Default = meta.story({
  args: {
    top: 120,
    currentTime: new Date("2024-04-01T09:30:00")
  },
  render: (args) => (
    <div className="relative h-60 w-80 rounded-lg border">
      <CurrentTimeMarker {...args} />
    </div>
  )
});
