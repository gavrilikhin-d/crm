import preview from "../../.storybook/preview";
import { lessons } from "../../.storybook/fixtures";
import { LessonParticipantSummary } from "./lesson-participant-summary";

const meta = preview.meta({
  component: LessonParticipantSummary,
  tags: ["ai-generated"]
});

export const GroupLesson = meta.story({
  args: {
    participants: lessons[1].participants
  }
});

export const Compact = meta.story({
  args: {
    participants: lessons[1].participants,
    compact: true
  }
});
