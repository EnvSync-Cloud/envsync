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

export const useCopy = (options: CopyOptions = {}) => {
  return useMutation({
    mutationFn: async (text: string) => {
      if (!navigator.clipboard) {
        throw new Error("Clipboard API is not supported in your browser");
      }

      const content = `${options.prefix || ""}${text}${options.suffix || ""}`;
      await navigator.clipboard.writeText(content);
      return text;
    },
    onSuccess: (data) => options.onSuccess?.(data),
    onError: (error) => options.onError?.(error),
  });
};

interface PasteOptions {
  /** Optional callback that runs when copy is successful */
  onSuccess?: Function<string, void>;
  /** Optional callback that runs when copy fails */
  onError?: Function<Error, void>;
  /** Optional sanitizer function */
  sanitize?: Function<string, string>;
}

export const usePaste = (options: PasteOptions = {}) => {
  return useMutation({
    mutationFn: async (set: Function<string>) => {
      if (!navigator.clipboard) {
        throw new Error("Clipboard API is not supported in your browser");
      }

      const content = await navigator.clipboard
        .readText()
        .then((raw) => (options.sanitize ? options.sanitize(raw) : raw));

      set(content);
      return content;
    },
    onSuccess: (data) => options.onSuccess?.(data),
    onError: (error) => options.onError?.(error),
  });
};
