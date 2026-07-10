import preview from "../../.storybook/preview";
import { getStudent, lessons, recurringSchedules, storyNow, students } from "../../.storybook/fixtures";
import { LessonOverviewSheet } from "./lesson-overview-sheet";

const meta = preview.meta({
  component: LessonOverviewSheet,
  tags: ["ai-generated"]
});

const asyncNoop = async () => {};

export const GroupLesson = meta.story({
  args: {
    lesson: lessons[1],
    open: true,
    referenceNow: storyNow.getTime(),
    recurringSchedule: recurringSchedules[0],
    getStudent,
    availableStudents: students.filter((student) => !lessons[1].participants.some((participant) => participant.studentId === student.id)),
    onOpenChange: asyncNoop,
    onAddParticipant: asyncNoop,
    onRemoveParticipant: asyncNoop,
    onSetParticipantStatus: asyncNoop,
    onUpdateLesson: asyncNoop,
    onDeleteLesson: asyncNoop
  }
});

export const CompletedLesson = meta.story({
  args: {
    lesson: lessons[2],
    open: true,
    referenceNow: storyNow.getTime(),
    getStudent,
    availableStudents: students,
    onOpenChange: asyncNoop,
    onAddParticipant: asyncNoop,
    onRemoveParticipant: asyncNoop,
    onSetParticipantStatus: asyncNoop,
    onUpdateLesson: asyncNoop,
    onDeleteLesson: asyncNoop
  }
});
