import preview from "../../../../../.storybook/preview";
import { responsiveViewports } from "../../../../../.storybook/fixtures";
import { CalendarScrollArea } from "./calendar-scroll-area";

const meta = preview.meta({
  component: CalendarScrollArea,
  tags: ["ai-generated"]
});


export const VerticalAndHorizontal = meta.story({
  args: {
    minWidth: 760,
    scrollAnchorOffset: 240,
    horizontalAnchorOffset: 360,
    scrollKey: "storybook-scroll",
    stickyHeader: true,
    children: (
      <div className="grid h-[900px] place-items-center rounded-lg border bg-muted/40">
        Большой календарь
      </div>
    )
  },
  parameters: {
    chromatic: {
      viewports: responsiveViewports
    }
  }
});
