const ru = {
  app: {
    title: "CRM преподавателя",
    description: "Мини-CRM для преподавателя вокала или репетитора"
  },
  auth: {
    loginDescription: "Войдите через Google, чтобы управлять своими учениками и расписанием.",
    signInWithGoogle: "Войти через Google",
    signOut: "Выйти"
  },
  plan: {
    current: "Текущий тариф",
    free: "Бесплатный",
    standard: "Стандарт",
    premium: "Премиум",
    prioritySupport: "Приоритетная поддержка",
    usageDescription: "Использование лимитов вашего тарифа.",
    usage: {
      students: "Ученики",
      lessonsThisMonth: "Занятия в этом месяце",
      packages: "Пакеты",
      recurringSchedules: "Повторяющиеся занятия"
    },
    recurringEnabled: "Повторяющиеся занятия доступны.",
    recurringDisabled: "Повторяющиеся занятия недоступны на бесплатном тарифе.",
    upgradeSoon: "Обновить тариф — скоро",
    limit: {
      students: "Достигнут лимит учеников на бесплатном тарифе.",
      lessons: "Достигнут лимит занятий в этом месяце.",
      packages: "Достигнут лимит пакетов на бесплатном тарифе.",
      recurring: "Достигнут лимит повторяющихся занятий на вашем тарифе."
    }
  },
  nav: {
    mainAria: "Основная навигация",
    payments: "Оплаты",
    students: "Ученики",
    schedule: "Расписание",
    packages: "Пакеты",
    settings: "Настройки"
  },
  section: {
    schedule: "Расписание",
    students: "Ученики",
    payments: "Оплаты",
    packages: "Пакеты занятий",
    settings: "Настройки"
  },
  calendar: {
    view: {
      day: "День",
      week: "Неделя",
      month: "Месяц"
    },
    today: "Сегодня",
    prevPeriod: "Предыдущий период",
    nextPeriod: "Следующий период",
    scheduleLesson: "Запланировать занятие",
    createLesson: "Создать занятие",
    createLessonTitle: "Создать занятие",
    moreLessons: "+{count} еще",
    lessonFallback: "Занятие",
    refresh: "Обновить",
    live: "Live",
    liveUpdates: "Обновления приходят автоматически",
    reconnectingShort: "Связь...",
    reconnecting: "Переподключение через {seconds} с",
    lastRefreshed: "Последнее обновление: {time}",
    vacation: {
      title: "Отпуск",
      description: "Добавьте даты отпуска — все запланированные занятия в этот период будут отменены.",
      label: "Отпуск",
      startsOn: "С",
      endsOn: "По",
      labelField: "Название",
      labelPlaceholder: "Например, летний отпуск",
      labelHint: "Необязательно. Поможет отличать несколько периодов отпуска.",
      add: "Отпуск",
      submit: "Добавить отпуск",
      empty: "Периоды отпуска пока не добавлены.",
      createConfirm:
        "Добавить отпуск? Все запланированные занятия в выбранные даты будут отменены преподавателем.",
      deleteConfirm: "Удалить этот период отпуска? Отменённые занятия не будут восстановлены автоматически.",
      deleteAria: "Удалить период отпуска",
      created: "Отпуск добавлен. Отменено занятий: {count}.",
      deleted: "Период отпуска удалён.",
      missingDates: "Укажите даты начала и окончания отпуска.",
      useTime: "Указать время",
      useTimeHint: "Если время не указано, отменяются все занятия на выбранные дни.",
      startsAtTime: "Время начала",
      endsAtTime: "Время окончания"
    }
  },
  weekday: {
    short: {
      mon: "Пн",
      tue: "Вт",
      wed: "Ср",
      thu: "Чт",
      fri: "Пт",
      sat: "Сб",
      sun: "Вс"
    }
  },
  lessonStatus: {
    scheduled: "Запланировано",
    confirmed: "Подтверждено",
    cancelled_by_student: "Отменено учеником",
    cancelled_by_teacher: "Отменено преподавателем",
    completed: "Проведено",
    missed: "Пропуск"
  },
  lessonType: {
    individual: "Индивидуальное",
    group: "Групповое"
  },
  participantStatus: {
    awaiting: "Ожидает ответа",
    confirmed: "Подтверждено",
    declined: "Отказался",
    missed: "Пропуск",
    attended: "Посетил"
  },
  paymentMethod: {
    cash: "Наличные",
    transfer: "Перевод",
    other: "Другое"
  },
  studentStatus: {
    active: "Активный",
    inactive: "Неактивный"
  },
  badge: {
    debt: "Долг",
    debtWithCount: "Долг: {count}"
  },
  modal: {
    addStudent: "Добавить ученика",
    editStudent: "Редактировать ученика",
    addPayment: "Добавить оплату",
    addPackage: "Добавить пакет"
  },
  form: {
    save: "Сохранить",
    cancel: "Отмена",
    fullName: "ФИО",
    fullNameRequired: "Укажите ФИО.",
    dateTime: "Дата и время",
    durationMinutes: "Длительность, мин",
    students: "Ученики",
    addStudent: "Добавить ученика",
    repeatWeekly: "Повторять еженедельно",
    addToCalendar: "Добавить в календарь",
    student: "Ученик",
    selectStudent: "Выберите ученика",
    package: "Пакет",
    noPackage: "Без пакета",
    lessonCount: "Занятий",
    amount: "Сумма",
    paymentMethod: "Способ оплаты",
    addPayment: "Добавить оплату",
    packageName: "Название пакета",
    price: "Цена",
    addPackage: "Добавить пакет"
  },
  combobox: {
    selectStudent: "Выберите ученика",
    addStudent: "Добавить ученика",
    searchStudent: "Найти ученика...",
    studentNotFound: "Ученик не найден.",
    removeStudentAria: "Убрать {name}"
  },
  table: {
    student: "Ученик",
    date: "Дата",
    lessonCount: "Занятий",
    amount: "Сумма",
    method: "Способ"
  },
  clients: {
    title: "Ученики",
    addStudentAria: "Добавить ученика",
    editStudentAria: "Редактировать {name}",
    telegramConnected: "Telegram подключен",
    connectTelegram: "Подключить Telegram",
    telegramBotUsernameMissing: "Укажите Telegram bot username"
  },
  payments: {
    title: "История оплат",
    addPaymentAria: "Добавить оплату",
    studentDeleted: "Ученик удален",
    packageFallback: "Пакет"
  },
  packages: {
    addPackageAria: "Добавить пакет",
    deletePackageAria: "Удалить пакет {name}",
    perLesson: "/занятие",
    summary: "{count} занятий · {price}"
  },
  settings: {
    title: "Настройки",
    description: "Параметры приложения.",
    currency: "Валюта",
    selectCurrency: "Выберите валюту",
    currencyHint: "Валюта оплат и пакетов.",
    lessonReminders: {
      title: "Напоминания о занятиях",
      description: "Telegram-напоминания по умолчанию.",
      leadTimes: "Отправлять за",
      hint: "Ученики могут переопределить это в боте.",
      customLabel: "Свой интервал",
      customPlaceholder: "Например: 45, 180",
      customHint: "Минуты через запятую или пробел.",
      customAdd: "Добавить",
      customInvalid: "Укажите положительное число минут.",
      save: "Сохранить напоминания",
      saving: "Сохраняем..."
    },
    googleCalendar: {
      title: "Google Calendar",
      description: "Синхронизация занятий.",
      connect: "Подключить Google Calendar",
      connectHint: "Добавляйте занятия в Google Calendar.",
      syncEnabled: "Синхронизировать занятия",
      syncEnabledHint: "CRM будет добавлять и обновлять события.",
      syncNow: "Синхронизировать сейчас",
      disconnect: "Отключить",
      disconnectConfirm: "Отключить Google Calendar? Существующие события в календаре не будут удалены."
    },
    accountDeletion: {
      title: "Удаление аккаунта",
      description: "Удаляет аккаунт и все данные CRM.",
      open: "Удалить аккаунт",
      confirmTitle: "Удалить аккаунт?",
      confirmDescription:
        "Это действие нельзя отменить. Чтобы подтвердить удаление всех данных, введите email аккаунта: {email}",
      confirmLabel: "Email аккаунта",
      confirmHint: "Кнопка удаления станет активной только после точного совпадения.",
      confirm: "Удалить аккаунт",
      deleting: "Удаляем...",
      loading: "Данные аккаунта загружаются. Удаление станет доступно после загрузки."
    }
  },
  toast: {
    loadFailed: "Не удалось загрузить данные.",
    actionFailed: "Действие не выполнено.",
    studentAdded: "Ученик добавлен.",
    studentUpdated: "Данные ученика обновлены.",
    selectAtLeastOneStudent: "Выберите хотя бы одного ученика.",
    lessonAdded: "Занятие добавлено.",
    lessonUpdated: "Занятие обновлено.",
    duplicateLesson: "Такое занятие уже существует.",
    recurringLessonCreated: "Создано повторяющееся занятие.",
    enterLessonCountAndAmount: "Укажите количество занятий и сумму.",
    paymentAdded: "Оплата добавлена.",
    packageAdded: "Пакет добавлен.",
    currencyUpdated: "Валюта обновлена.",
    lessonReminderMinutesUpdated: "Время напоминаний обновлено.",
    googleCalendarConnected: "Google Calendar подключён.",
    googleCalendarConnectFailed: "Не удалось подключить Google Calendar.",
    googleCalendarDisconnected: "Google Calendar отключён.",
    googleCalendarSyncEnabled: "Синхронизация с Google Calendar включена.",
    googleCalendarSyncDisabled: "Синхронизация с Google Calendar выключена.",
    googleCalendarSynced: "Синхронизировано занятий: {synced}. Ошибок: {failed}.",
    studentDeleted: "Ученик удален.",
    participantRemoved: "{name} убран(а) с занятия.",
    participantStatusUpdated: "Статус {name} обновлён.",
    participantAdded: "{name} добавлен(а) на занятие.",
    participantAddedGroup: "{name} добавлен(а). Занятие стало групповым.",
    participantsAdded: "Добавлено учеников: {count}.",
    participantsAddedGroup: "Добавлено учеников: {count}. Занятие стало групповым.",
    lessonDeletedSingle: "Занятие удалено.",
    lessonDeletedFollowing: "Это и последующие занятия удалены.",
    lessonDeletedAll: "Вся серия занятий удалена.",
    packageDeleted: "Пакет удален.",
    accountDeleteFailed: "Не удалось удалить аккаунт.",
    telegramLinkCopied: "Ссылка скопирована, перешлите её ученику",
    selectStudent: "Выберите ученика.",
    saveFailed: "Не удалось сохранить изменения."
  },
  confirm: {
    deleteStudent:
      "Удалить ученика {name}? Его оплаты и участия в занятиях тоже будут удалены.",
    removeParticipant: "Убрать {name} с этого занятия?",
    removeLastParticipant: "Убрать {name}? Занятие будет удалено.",
    deleteLesson: "Удалить занятие {date}?",
    deletePackage:
      'Удалить пакет "{name}"? Уже внесенные оплаты сохранят количество занятий.'
  },
  common: {
    back: "Назад",
    loading: "Загрузка...",
    minutes: "{count} мин",
    lessonsCount: "{count} занятий",
    recordsCount: "{count} записей",
    schedulesCount: "{count} расписаний",
    formatLabel: "Формат: ",
    fromDate: "С {date}",
    toDate: " по {date}"
  },
  student: {
    notFound: "Ученик не найден.",
    edit: {
      title: "Редактирование",
      description: "Имя и аватар ученика",
      button: "Редактировать"
    },
    telegramConnected: "Подключен",
    telegramNotConnected: "Не подключен",
    connectTelegram: "Подключить Telegram",
    addedAt: "Добавлен: "
  },
  balance: {
    remaining: "Осталось",
    used: "Использовано",
    paidLessons: "Оплачено занятий",
    debt: "Долг"
  },
  studentPage: {
    paymentsTitle: "Оплаты",
    paymentsEmpty: "Оплат пока нет.",
    recurringTitle: "Повторяющиеся занятия",
    recurringEmpty: "Не участвует в повторяющихся занятиях.",
    recurringSchedule: "Каждую {weekday} в {time}, {type}",
    upcomingLessons: "Предстоящие занятия",
    pastLessons: "Прошедшие занятия",
    upcomingEmpty: "Предстоящих занятий нет.",
    pastEmpty: "Прошедших занятий нет."
  },
  lessonOverview: {
    wasGroup: "Было групповым",
    oneOff: "Разовое занятие",
    participants: "Участники",
    deletedStudent: "Удалённый ученик",
    addParticipant: "Добавить учеников",
    selectStudent: "Выберите ученика",
    selectStudents: "Выберите одного или нескольких учеников",
    addParticipantsButton: "Добавить на занятие",
    noStudentsToAdd: "Все активные ученики уже на этом занятии.",
    addParticipantAria: "Добавить ученика на занятие",
    removeParticipantAria: "Убрать {name} с занятия",
    participantStatusAria: "Нажмите, чтобы изменить статус участника {name}",
    participantStatusHint: "Нажмите, чтобы изменить статус",
    recurring: "Каждую неделю, {weekday} в {time}",
    delete: {
      title: "Удалить занятие",
      single: "Только это занятие",
      following: "Это и все последующие",
      all: "Всю серию",
      button: "Удалить занятие"
    }
  },
  avatar: {
    selectImage: "Выберите изображение.",
    maxSize: "Изображение должно быть не больше 2 МБ.",
    uploadFailed: "Не удалось загрузить аватар.",
    uploadAria: "Загрузить аватар",
    uploadForAria: "Загрузить аватар для {name}",
    defaultAlt: "Аватар",
    dropHint: "Перетащите изображение или нажмите для выбора",
    removePhoto: "Убрать фото"
  },
  dateTime: {
    placeholder: "Выберите дату и время",
    hourAria: "Час",
    minuteAria: "Минуты"
  },
  error: {
    readFileFailed: "Не удалось прочитать файл."
  }
} as const;

export { ru };
