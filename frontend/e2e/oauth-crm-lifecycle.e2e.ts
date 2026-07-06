import { expect, type Page, test as base } from "@playwright/test";

type NavSection = "Packages" | "Students" | "Payments" | "Schedule" | "Settings";

type LocalOidcUser = {
  email: string;
  password: string;
};

type CrmTestData = {
  packageName: string;
  firstStudent: string;
  secondStudent: string;
};

type Fixtures = {
  localOidcUser: LocalOidcUser;
  crmData: CrmTestData;
};

const test = base.extend<Fixtures>({
  page: async ({ context, page, baseURL }, providePage) => {
    await context.addCookies([{ name: "crm.locale", value: "en", url: baseURL ?? "http://localhost:3100" }]);
    await page.addInitScript(() => window.localStorage.setItem("crm.locale", "en"));
    await providePage(page);
  },
  // Playwright requires fixture callbacks to use object destructuring for the first argument.
  // eslint-disable-next-line no-empty-pattern
  localOidcUser: async ({}, provideLocalOidcUser) => {
    await provideLocalOidcUser({
      email: "e2e.teacher@example.com",
      password: "password"
    });
  },
  // eslint-disable-next-line no-empty-pattern
  crmData: async ({}, provideCrmData) => {
    const suffix = Date.now().toString(36);
    await provideCrmData({
      packageName: `E2E Package ${suffix}`,
      firstStudent: `E2E Alex ${suffix}`,
      secondStudent: `E2E Sam ${suffix}`
    });
  }
});

test("oauth user can create CRM data, relogin with data, delete account, and relogin empty", async ({
  page,
  localOidcUser,
  crmData
}) => {
  await loginWithLocalOidc(page, localOidcUser);
  await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();

  await createPackage(page, crmData.packageName);
  await createStudent(page, crmData.firstStudent);
  await createStudent(page, crmData.secondStudent);
  await createPayment(page, crmData.firstStudent, crmData.packageName);
  await createLesson(page, crmData.firstStudent, false);
  await createLesson(page, crmData.secondStudent, true);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();

  await expectCrmDataVisible(page, crmData);

  await signOut(page);
  await loginWithLocalOidc(page, localOidcUser);
  await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();
  await expectCrmDataVisible(page, crmData);

  await deleteAccount(page, localOidcUser);
  await expect(page).toHaveURL(/\/login$/);

  await loginWithLocalOidc(page, localOidcUser);
  await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();

  await expect(page.getByText(crmData.firstStudent)).toHaveCount(0);
  await expect(page.getByText(crmData.secondStudent)).toHaveCount(0);
  await verifySectionDoesNotContain(page, "Packages", crmData.packageName);
  await verifySectionDoesNotContain(page, "Payments", crmData.firstStudent);
});

async function loginWithLocalOidc(page: Page, user: LocalOidcUser) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in with Local OIDC" }).click();

  const loginInput = page.getByLabel("Email Address");
  if (await loginInput.waitFor({ state: "visible", timeout: 10_000 }).then(() => true).catch(() => false)) {
    await loginInput.fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: /log ?in/i }).click();
  }

  await expect(page).toHaveURL("/");
}

async function createPackage(page: Page, packageName: string) {
  await openSection(page, "Packages");
  await page.getByLabel("Add package").first().click();
  await page.locator("#package-name").fill(packageName);
  await page.locator("#package-lesson-count").fill("6");
  await page.locator("#package-price").fill("1200");
  await submitAndWait(page, "/api/lesson-packages", () =>
    page.getByRole("button", { name: "Add package" }).last().click()
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText(packageName)).toBeVisible();
}

async function createStudent(page: Page, fullName: string) {
  await openSection(page, "Students");
  await page.getByLabel("Add student").first().click();
  await page.locator("#student-full-name").fill(fullName);
  await submitAndWait(page, "/api/students", () => page.getByRole("button", { name: "Add student" }).last().click());
  await expect(page.getByText(fullName)).toBeVisible();
}

async function createPayment(page: Page, studentName: string, packageName: string) {
  await openSection(page, "Payments");
  await page.getByLabel("Add payment").first().click();
  await selectStudent(page, "#payment-student-id", studentName);
  const packageValue = await page.locator("#payment-package-id option", { hasText: packageName }).getAttribute("value");
  expect(packageValue).toBeTruthy();
  await page.locator("#payment-package-id").selectOption(packageValue!);
  await submitAndWait(page, "/api/payments", () => page.getByRole("button", { name: "Add payment" }).last().click());
  await expect(page.getByText(studentName).first()).toBeVisible();
}

async function createLesson(page: Page, studentName: string, repeatWeekly: boolean) {
  await openSection(page, "Schedule");
  await page.getByLabel("Create lesson").first().click();
  await selectStudent(page, "#lesson-students", studentName);

  if (repeatWeekly) {
    await page.getByLabel("Repeat weekly").click();
  }

  await submitAndWait(page, "/api/lessons", () => page.getByRole("button", { name: "Add to calendar" }).click());
  await expectCalendarLesson(page, studentName);
}

async function expectLessonsVisible(page: Page, studentNames: string[]) {
  await openSection(page, "Schedule");
  for (const studentName of studentNames) {
    await expectCalendarLesson(page, studentName);
  }
}

async function expectCrmDataVisible(page: Page, crmData: CrmTestData) {
  await expectLessonsVisible(page, [crmData.firstStudent, crmData.secondStudent]);
  await verifySectionContains(page, "Packages", crmData.packageName);
  await verifySectionContains(page, "Students", crmData.firstStudent, crmData.secondStudent);
  await verifySectionContains(page, "Payments", crmData.firstStudent, "6 lessons");
}

async function expectCalendarLesson(page: Page, studentName: string) {
  await expect(page.locator("button").filter({ hasText: studentName }).first()).toBeVisible();
}

async function signOut(page: Page) {
  await page.getByLabel("Sign out").click();
  await expect(page).toHaveURL(/\/login$/);
}

async function deleteAccount(page: Page, user: LocalOidcUser) {
  await openSection(page, "Settings");
  await page.getByRole("button", { name: "Delete account" }).click();
  await page.locator("#delete-account-confirmation").fill(user.email);
  await submitAndWait(page, "/api/account", () =>
    page.getByRole("button", { name: "Delete account" }).last().click()
  );
}

async function openSection(page: Page, name: NavSection) {
  await page.getByRole("button", { name, exact: true }).click();
  await expect(page.getByRole("heading", { name: headingByNavName(name) })).toBeVisible();
}

async function verifySectionContains(page: Page, section: NavSection, ...texts: string[]) {
  await openSection(page, section);
  for (const text of texts) {
    await expect(page.getByText(text).first()).toBeVisible();
  }
}

async function verifySectionDoesNotContain(page: Page, section: NavSection, text: string) {
  await openSection(page, section);
  await expect(page.getByText(text)).toHaveCount(0);
}

async function selectStudent(page: Page, triggerSelector: string, studentName: string) {
  await page.locator(triggerSelector).click();
  await page.getByPlaceholder("Search student...").fill(studentName);
  await page.getByRole("option", { name: studentName }).click();
  await page.keyboard.press("Escape");
}

async function submitAndWait(page: Page, path: string, submit: () => Promise<void>) {
  const responsePromise = page.waitForResponse((response) => response.url().includes(path));
  await submit();
  const response = await responsePromise;
  expect(response.ok(), `${path} responded with ${response.status()}`).toBe(true);
}

function headingByNavName(name: NavSection): string {
  return name === "Packages" ? "Lesson packages" : name;
}
