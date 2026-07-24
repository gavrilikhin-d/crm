import type { Lesson, Payment } from "./types";

export type PackageLessonProgress = {
  n: number;
  m: number;
};

function isCountableParticipantLesson(lesson: Lesson, studentId: string): boolean {
  if (lesson.status === "cancelled_by_teacher") {
    return false;
  }

  const participant = lesson.participants.find((item) => item.studentId === studentId);
  return Boolean(participant && participant.status !== "declined");
}

export function getPackageLessonProgress(input: {
  studentId: string;
  lessonId: string;
  lessons: Lesson[];
  payments: Payment[];
}): PackageLessonProgress | null {
  const { studentId, lessonId, lessons, payments } = input;

  const currentLesson = lessons.find((lesson) => lesson.id === lessonId);
  if (!currentLesson || !isCountableParticipantLesson(currentLesson, studentId)) {
    return null;
  }

  const studentPayments = payments
    .filter((payment) => payment.studentId === studentId && payment.lessonCount > 0)
    .sort((first, second) => {
      const paidAtDiff = new Date(first.paidAt).getTime() - new Date(second.paidAt).getTime();
      if (paidAtDiff !== 0) {
        return paidAtDiff;
      }
      return first.id.localeCompare(second.id);
    });

  if (!studentPayments.length) {
    return null;
  }

  const countableLessons = lessons
    .filter((lesson) => isCountableParticipantLesson(lesson, studentId))
    .sort((first, second) => {
      const startsAtDiff = new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime();
      if (startsAtDiff !== 0) {
        return startsAtDiff;
      }
      return first.id.localeCompare(second.id);
    });

  let paymentIndex = 0;
  let usedInPayment = 0;

  for (const lesson of countableLessons) {
    while (
      paymentIndex < studentPayments.length &&
      usedInPayment >= studentPayments[paymentIndex]!.lessonCount
    ) {
      paymentIndex += 1;
      usedInPayment = 0;
    }

    if (paymentIndex >= studentPayments.length) {
      return null;
    }

    usedInPayment += 1;
    const payment = studentPayments[paymentIndex]!;

    if (lesson.id === lessonId) {
      return { n: usedInPayment, m: payment.lessonCount };
    }
  }

  return null;
}

export function formatPackageLessonProgress(progress: PackageLessonProgress): string {
  return `${progress.n}/${progress.m}`;
}

export function formatParticipantNameWithPackageProgress(
  name: string,
  progress: PackageLessonProgress | null
): string {
  if (!progress) {
    return name;
  }

  return `${name} ${formatPackageLessonProgress(progress)}`;
}
