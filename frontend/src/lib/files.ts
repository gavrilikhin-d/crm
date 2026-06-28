import { t } from "@/i18n";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(t("error.readFileFailed")));
    reader.readAsDataURL(file);
  });
}

export { readFileAsDataUrl };
