import { Function } from "@/utils/env";
import { useMutation } from "@tanstack/react-query";

interface CopyOptions {
  /** Optional callback that runs when copy is successful */
  onSuccess?: Function<string, void>;
  /** Optional callback that runs when copy fails */
  onError?: Function<Error, void>;
  /** Text to add before the copied content */
  prefix?: string;
  /** Text to add after the copied content */
  suffix?: string;
}

/** Clipboard API is unavailable on http://app.lvh.me (not a secure context). */
export async function copyTextToClipboard(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to execCommand for http hosts and denied permissions.
    }
  }

  if (typeof document === "undefined") {
    throw new Error("Clipboard is not available");
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!copied) {
    throw new Error("Failed to copy to clipboard");
  }
}

export const useCopy = (options: CopyOptions = {}) => {
  return useMutation({
    mutationFn: async (text: string) => {
      const content = `${options.prefix || ""}${text}${options.suffix || ""}`;
      await copyTextToClipboard(content);
    },
    onSuccess: (_data, text) => options.onSuccess?.(text),
    onError: (error) => options.onError?.(error),
  });
};
