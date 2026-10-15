/**
 * "الدخول كموظف" (manager preview): the CRM renders exactly as one employee
 * sees it — their clients, screens, and permissions — while the real signed-in
 * user is still the manager. Preview is read-only: every write path calls
 * assertWritable(), which tells the shell to show a notice and stops the write,
 * so nothing is ever saved in the employee's name.
 */
let previewOn = false;

export const setPreviewMode = (on: boolean) => {
  previewOn = on;
};
export const isPreview = () => previewOn;

export class PreviewBlockedError extends Error {
  constructor() {
    super("preview_read_only");
  }
}

export function assertWritable() {
  if (!previewOn) return;
  if (typeof window !== "undefined") window.dispatchEvent(new Event("crm-preview-blocked"));
  throw new PreviewBlockedError();
}
