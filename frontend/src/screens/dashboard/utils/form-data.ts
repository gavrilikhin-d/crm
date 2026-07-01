export function formData(form: HTMLFormElement): Record<string, string | number | string[]> {
  return Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
}
