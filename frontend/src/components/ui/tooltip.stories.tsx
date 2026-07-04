import preview from "../../../.storybook/preview";
import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

const meta = preview.meta({
  component: Tooltip,
  tags: ["ai-generated"]
});

export const Open = meta.story({
  args: {
    defaultOpen: true
  },
  render: (args) => (
    <Tooltip {...args}>
      <TooltipTrigger asChild>
        <Button variant="outline">Live</Button>
      </TooltipTrigger>
      <TooltipContent>Обновления приходят автоматически</TooltipContent>
    </Tooltip>
  )
});
