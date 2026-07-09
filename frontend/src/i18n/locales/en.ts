import type { ru } from "@/i18n/locales/ru";

type TranslationShape<T> = {
  [K in keyof T]: T[K] extends string ? string : TranslationShape<T[K]>;
};

const en = {
  app: {
    title: "Teacher CRM",
    description: "A mini CRM for vocal teachers and tutors"
  },
  auth: {
    loginDescription: "Sign in with Google to manage your students and schedule.",
    signInWithGoogle: "Sign in with Google",
    signInWithLocalOidc: "Sign in with Local OIDC",
    signOut: "Sign out"
  },
  plan: {
    current: "Current plan",
    free: "Free",
    standard: "Standard",
    premium: "Premium",
    prioritySupport: "Priority support",
    usageDescription: "Your plan usage.",
    usage: {
      students: "Students",
      lessonsThisMonth: "Lessons this month",
      packages: "Packages",
      recurringSchedules: "Recurring lessons"
    },
    recurringEnabled: "Recurring lessons are available.",
    recurringDisabled: "Recurring lessons are not available on the free plan.",
    upgradeSoon: "Upgrade plan — soon",
    limit: {
      students: "You have reached the student limit on the free plan.",
      lessons: "You have reached this month's lesson limit.",
      packages: "You have reached the package limit on the free plan.",
      recurring: "You have reached the recurring lesson limit on your plan."
    }
  },
  nav: {
    mainAria: "Main navigation",
    payments: "Payments",
    students: "Students",
    schedule: "Schedule",
    packages: "Packages",
    settings: "Settings"
  },
  section: {
    schedule: "Schedule",
    students: "Students",
    payments: "Payments",
    packages: "Lesson packages",
    settings: "Settings"
  },
  calendar: {
    view: {
      day: "Day",
      week: "Week",
      month: "Month"
    },
    today: "Today",
    prevPeriod: "Previous period",
    nextPeriod: "Next period",
    scheduleLesson: "Schedule lesson",
    createLesson: "Create lesson",
    createLessonTitle: "Create lesson",
    moreLessons: "+{count} more",
    lessonFallback: "Lesson",
    refresh: "Refresh",
    live: "Live",
    liveUpdates: "Updates arrive automatically",
    reconnectingShort: "Connecting...",
    reconnecting: "Reconnecting in {seconds}s",
    lastRefreshed: "Last refreshed: {time}",
    vacation: {
      title: "Vacation",
      description: "Add vacation dates, and all scheduled lessons in this period will be cancelled.",
      label: "Vacation",
      startsOn: "From",
      endsOn: "To",
      labelField: "Name",
      labelPlaceholder: "For example, summer break",
      labelHint: "Optional. Helps distinguish multiple vacation periods.",
      add: "Vacation",
      submit: "Add vacation",
      empty: "No vacation periods yet.",
      createConfirm: "Add vacation? All scheduled lessons on selected dates will be cancelled by the teacher.",
      deleteConfirm: "Delete this vacation period? Cancelled lessons will not be restored automatically.",
      deleteAria: "Delete vacation period",
      created: "Vacation added. Cancelled lessons: {count}.",
      deleted: "Vacation period deleted.",
      missingDates: "Set vacation start and end dates.",
      useTime: "Set time",
      useTimeHint: "If no time is set, all lessons on selected days are cancelled.",
      startsAtTime: "Start time",
      endsAtTime: "End time"
    }
  },
  weekday: {
    short: {
      mon: "Mon",
      tue: "Tue",
      wed: "Wed",
      thu: "Thu",
      fri: "Fri",
      sat: "Sat",
      sun: "Sun"
    }
  },
  lessonStatus: {
    scheduled: "Scheduled",
    confirmed: "Confirmed",
    cancelled_by_student: "Cancelled by student",
    cancelled_by_teacher: "Cancelled by teacher",
    completed: "Completed",
    missed: "Missed"
  },
  lessonType: {
    individual: "Individual",
    group: "Group"
  },
  participantStatus: {
    awaiting: "Awaiting reply",
    confirmed: "Confirmed",
    declined: "Declined",
    missed: "Missed",
    attended: "Attended"
  },
  paymentMethod: {
    cash: "Cash",
    transfer: "Transfer",
    other: "Other"
  },
  studentStatus: {
    active: "Active",
    inactive: "Inactive"
  },
  badge: {
    debt: "Debt",
    debtWithCount: "Debt: {count}"
  },
  modal: {
    addStudent: "Add student",
    editStudent: "Edit student",
    addPayment: "Add payment",
    addPackage: "Add package"
  },
  form: {
    save: "Save",
    cancel: "Cancel",
    fullName: "Full name",
    fullNameRequired: "Enter full name.",
    dateTime: "Date and time",
    durationMinutes: "Duration, min",
    students: "Students",
    addStudent: "Add student",
    repeatWeekly: "Repeat weekly",
    addToCalendar: "Add to calendar",
    student: "Student",
    selectStudent: "Select student",
    package: "Package",
    noPackage: "No package",
    lessonCount: "Lessons",
    amount: "Amount",
    currency: "Currency",
    paymentMethod: "Payment method",
    addPayment: "Add payment",
    packageName: "Package name",
    price: "Price",
    addPackage: "Add package"
  },
  combobox: {
    selectStudent: "Select student",
    addStudent: "Add student",
    searchStudent: "Search student...",
    studentNotFound: "Student not found.",
    removeStudentAria: "Remove {name}"
  },
  table: {
    student: "Student",
    date: "Date",
    lessonCount: "Lessons",
    amount: "Amount",
    method: "Method"
  },
  clients: {
    title: "Students",
    addStudentAria: "Add student",
    editStudentAria: "Edit {name}",
    telegramConnected: "Telegram connected",
    connectTelegram: "Connect Telegram",
    telegramBotUsernameMissing: "Set Telegram bot username"
  },
  payments: {
    title: "Payment history",
    addPaymentAria: "Add payment",
    studentDeleted: "Student deleted",
    packageFallback: "Package"
  },
  packages: {
    addPackageAria: "Add package",
    deletePackageAria: "Delete package {name}",
    perLesson: "/lesson",
    summary: "{count} lessons · {price}"
  },
  settings: {
    title: "Settings",
    description: "App settings.",
    language: "Language",
    languages: {
      ru: "Русский",
      en: "English"
    },
    currency: "Currency",
    currencies: {
      BYN: "Belarusian ruble",
      RUB: "Russian ruble",
      USD: "US dollar",
      EUR: "Euro"
    },
    selectCurrency: "Select currency",
    currencyHint: "Currency for payments and packages.",
    lessonReminders: {
      title: "Lesson reminders",
      description: "Default Telegram reminders.",
      leadTimes: "Send before",
      hint: "Students can override this in the bot.",
      customLabel: "Custom interval",
      customPlaceholder: "For example: 45, 180",
      customHint: "Minutes, separated by comma or space.",
      customAdd: "Add",
      customInvalid: "Enter a positive number of minutes.",
      units: {
        twentyFourHours: "24 h",
        days: "{count} d",
        hours: "{count} h",
        minutes: "{count} min"
      },
      save: "Save reminders",
      saving: "Saving..."
    },
    googleCalendar: {
      title: "Google Calendar",
      description: "Lesson sync.",
      connect: "Connect Google Calendar",
      connectHint: "Add lessons to Google Calendar.",
      syncEnabled: "Sync lessons",
      syncEnabledHint: "CRM will add and update events.",
      syncNow: "Sync now",
      disconnect: "Disconnect",
      disconnectConfirm: "Disconnect Google Calendar? Existing calendar events will not be deleted."
    },
    accountDeletion: {
      title: "Delete account",
      description: "Deletes the account and all CRM data.",
      open: "Delete account",
      confirmTitle: "Delete account?",
      confirmDescription: "This cannot be undone. To confirm deleting all data, enter the account email: {email}",
      confirmLabel: "Account email",
      confirmHint: "The delete button activates only after an exact match.",
      confirm: "Delete account",
      deleting: "Deleting...",
      loading: "Account data is loading. Deletion will be available after loading."
    }
  },
  toast: {
    loadFailed: "Could not load data.",
    actionFailed: "Action failed.",
    studentAdded: "Student added.",
    studentUpdated: "Student updated.",
    selectAtLeastOneStudent: "Select at least one student.",
    lessonAdded: "Lesson added.",
    lessonUpdated: "Lesson updated.",
    duplicateLesson: "This lesson already exists.",
    recurringLessonCreated: "Recurring lesson created.",
    enterLessonCountAndAmount: "Enter lesson count and amount.",
    paymentAdded: "Payment added.",
    packageAdded: "Package added.",
    currencyUpdated: "Currency updated.",
    lessonReminderMinutesUpdated: "Reminder time updated.",
    googleCalendarConnected: "Google Calendar connected.",
    googleCalendarConnectFailed: "Could not connect Google Calendar.",
    googleCalendarDisconnected: "Google Calendar disconnected.",
    googleCalendarSyncEnabled: "Google Calendar sync enabled.",
    googleCalendarSyncDisabled: "Google Calendar sync disabled.",
    googleCalendarSynced: "Synced lessons: {synced}. Errors: {failed}.",
    studentDeleted: "Student deleted.",
    participantRemoved: "{name} removed from lesson.",
    participantStatusUpdated: "{name}'s status updated.",
    participantAdded: "{name} added to lesson.",
    participantAddedGroup: "{name} added. Lesson became a group lesson.",
    participantsAdded: "Students added: {count}.",
    participantsAddedGroup: "Students added: {count}. Lesson became a group lesson.",
    lessonDeletedSingle: "Lesson deleted.",
    lessonDeletedFollowing: "This and following lessons were deleted.",
    lessonDeletedAll: "The whole lesson series was deleted.",
    packageDeleted: "Package deleted.",
    accountDeleteFailed: "Could not delete account.",
    telegramLinkCopied: "Link copied, send it to the student",
    selectStudent: "Select a student.",
    saveFailed: "Could not save changes."
  },
  confirm: {
    deleteStudent: "Delete student {name}? Their payments and lesson participation will also be deleted.",
    removeParticipant: "Remove {name} from this lesson?",
    removeLastParticipant: "Remove {name}? The lesson will be deleted.",
    deleteLesson: "Delete lesson {date}?",
    deletePackage: 'Delete package "{name}"? Existing payments will keep their lesson count.'
  },
  common: {
    back: "Back",
    loading: "Loading...",
    minutes: "{count} min",
    lessonsCount: "{count} lessons",
    recordsCount: "{count} records",
    schedulesCount: "{count} schedules",
    formatLabel: "Format: ",
    fromDate: "From {date}",
    toDate: " to {date}"
  },
  student: {
    notFound: "Student not found.",
    edit: {
      title: "Edit",
      description: "Student name and avatar",
      button: "Edit"
    },
    telegram: "Telegram: ",
    telegramConnected: "Connected",
    telegramNotConnected: "Not connected",
    connectTelegram: "Connect Telegram",
    addedAt: "Added: "
  },
  balance: {
    remaining: "Remaining",
    used: "Used",
    paidLessons: "Paid lessons",
    debt: "Debt"
  },
  studentPage: {
    paymentsTitle: "Payments",
    paymentsEmpty: "No payments yet.",
    recurringTitle: "Recurring lessons",
    recurringEmpty: "Does not participate in recurring lessons.",
    recurringSchedule: "Every {weekday} at {time}, {type}",
    upcomingLessons: "Upcoming lessons",
    pastLessons: "Past lessons",
    upcomingEmpty: "No upcoming lessons.",
    pastEmpty: "No past lessons."
  },
  lessonOverview: {
    wasGroup: "Was group",
    oneOff: "One-off lesson",
    participants: "Participants",
    deletedStudent: "Deleted student",
    addParticipant: "Add students",
    selectStudent: "Select student",
    selectStudents: "Select one or more students",
    addParticipantsButton: "Add to lesson",
    noStudentsToAdd: "All active students are already in this lesson.",
    addParticipantAria: "Add student to lesson",
    removeParticipantAria: "Remove {name} from lesson",
    participantStatusAria: "Click to change participant status for {name}",
    participantStatusHint: "Click to change status",
    recurring: "Every week, {weekday} at {time}",
    delete: {
      title: "Delete lesson",
      single: "Only this lesson",
      following: "This and all following",
      all: "Whole series",
      button: "Delete lesson"
    }
  },
  avatar: {
    selectImage: "Select an image.",
    maxSize: "Image must be no larger than 2 MB.",
    uploadFailed: "Could not upload avatar.",
    uploadAria: "Upload avatar",
    uploadForAria: "Upload avatar for {name}",
    defaultAlt: "Avatar",
    dropHint: "Drop an image or click to choose",
    removePhoto: "Remove photo"
  },
  dateTime: {
    placeholder: "Select date and time",
    hourAria: "Hour",
    minuteAria: "Minutes"
  },
  error: {
    readFileFailed: "Could not read file."
  }
} satisfies TranslationShape<typeof ru>;

export { en };
