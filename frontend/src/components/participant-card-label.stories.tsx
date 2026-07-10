import preview from "../../.storybook/preview";
import { students } from "../../.storybook/fixtures";
import { ParticipantCardAvatar, ParticipantCardLabel } from "./participant-card-label";

const meta = preview.meta({
  component: ParticipantCardLabel,
  tags: ["ai-generated"]
});

export const WithLink = meta.story({
  args: {
    name: students[0].fullName,
    studentId: students[0].id
  },
  render: (args) => (
    <div className="flex items-center gap-2 rounded-lg border p-2">
      <ParticipantCardAvatar student={students[0]} status="confirmed" />
      <ParticipantCardLabel {...args} />
    </div>
  )
});

export const CompactDeclined = meta.story({
  args: {
    name: students[1].fullName,
    compact: true
  },
  render: (args) => (
    <div className="flex w-36 items-center gap-1 rounded-md border p-1">
      <ParticipantCardAvatar student={students[1]} status="declined" compact />
      <ParticipantCardLabel {...args} />
    </div>
  )
});

