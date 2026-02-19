import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().indexOf("MAC") >= 0;
const mod = isMac ? "⌘" : "Ctrl";

const shortcuts = [
  { keys: [`${mod}`, "K"], description: "Open command palette" },
  { keys: [`${mod}`, "B"], description: "Toggle sidebar" },
  { keys: ["?"], description: "Show keyboard shortcuts" },
];

export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener("open-shortcuts-dialog", handleOpen);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "?" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target as HTMLElement)?.isContentEditable
      ) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("open-shortcuts-dialog", handleOpen);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md bg-gray-900 border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-gray-100">Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-1 pt-2">
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.description}
              className="flex items-center justify-between py-2 px-1"
            >
              <span className="text-sm text-gray-400">
                {shortcut.description}
              </span>
              <div className="flex items-center space-x-1">
                {shortcut.keys.map((key, i) => (
                  <span key={i}>
                    {i > 0 && (
                      <span className="text-gray-600 mx-0.5">+</span>
                    )}
                    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 text-xs font-mono bg-gray-800 text-gray-400 border border-gray-700 rounded">
                      {key}
                    </kbd>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
