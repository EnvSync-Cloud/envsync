import { AlertTriangle, WifiOff, ShieldAlert, ServerCrash, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ApiError } from "@envsync-cloud/envsync-ts-sdk";
import { ApiRequestError } from "@/api/base";

/** Coerces any value (including Zod error objects) to a safe string for React rendering. */
function safeString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  // Zod-style validation error: { issues: [{ message }], name }
  if (typeof value === "object" && "issues" in value && Array.isArray((value as { issues: unknown[] }).issues)) {
    const issues = (value as { issues: { message?: string }[] }).issues;
    if (issues.length > 0 && issues[0]?.message) {
      return issues[0].message;
    }
  }

  // Object with a message or error property
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.error === "string") return obj.error;
    if (typeof obj.message === "string") return obj.message;
  }

  return "An unexpected error occurred";
}

interface ErrorAlertProps {
  error: Error | ApiError | ApiRequestError | unknown;
  onDismiss?: () => void;
  className?: string;
}

function getErrorInfo(error: unknown): { title: string; message: string; icon: typeof AlertTriangle } {
  // Network errors
  if (error instanceof TypeError && error.message === "Failed to fetch") {
    return {
      title: "Connection failed",
      message: "Check your internet connection and try again.",
      icon: WifiOff,
    };
  }

  if (error instanceof TypeError && error.message.includes("NetworkError")) {
    return {
      title: "Network error",
      message: "Unable to reach the server. Check your connection and try again.",
      icon: WifiOff,
    };
  }

  // ApiError from SDK
  if (error instanceof ApiError) {
    const status = error.status;
    const bodyCode = error.body?.code as string | undefined;

    if (status === 401) {
      return {
        title: "Authentication required",
        message: "Your session has expired. Please sign in again.",
        icon: ShieldAlert,
      };
    }

    if (status === 403) {
      return {
        title: "Permission denied",
        message: "You don't have permission to perform this action. Contact your organization admin for access.",
        icon: ShieldAlert,
      };
    }

    if (status === 404) {
      return {
        title: "Not found",
        message: "The requested resource was not found. It may have been deleted.",
        icon: AlertTriangle,
      };
    }

    if (status === 409) {
      return {
        title: "Conflict",
        message: safeString(error.body?.error) || "This resource already exists or has been modified. Refresh and try again.",
        icon: AlertTriangle,
      };
    }

    if (status === 422) {
      const fieldErrors = error.body?.details;
      if (fieldErrors && typeof fieldErrors === "object") {
        const messages = Object.entries(fieldErrors)
          .map(([field, msg]) => `${field}: ${safeString(msg)}`)
          .join("\n");
        return {
          title: "Validation error",
          message: messages,
          icon: AlertTriangle,
        };
      }
      return {
        title: "Validation error",
        message: safeString(error.body?.error) || "Please check your input and try again.",
        icon: AlertTriangle,
      };
    }

    if (status === 429) {
      return {
        title: "Rate limited",
        message: "Too many requests. Please wait a moment and try again.",
        icon: AlertTriangle,
      };
    }

    if (status >= 500) {
      return {
        title: "Server error",
        message: "Something went wrong on our end. Please try again later.",
        icon: ServerCrash,
      };
    }

    // Generic API error
    return {
      title: "Request failed",
      message: safeString(error.body?.error) || error.message || "An unexpected error occurred.",
      icon: AlertTriangle,
    };
  }

  // ApiRequestError (custom fetch wrapper)
  if (error instanceof ApiRequestError) {
    if (error.status === 401) {
      return {
        title: "Authentication required",
        message: "Your session has expired. Please sign in again.",
        icon: ShieldAlert,
      };
    }

    if (error.status === 403) {
      return {
        title: "Permission denied",
        message: "You don't have permission to perform this action. Contact your organization admin for access.",
        icon: ShieldAlert,
      };
    }

    if (error.status >= 500) {
      return {
        title: "Server error",
        message: "Something went wrong on our end. Please try again later.",
        icon: ServerCrash,
      };
    }

    return {
      title: "Request failed",
      message: error.message || "An unexpected error occurred.",
      icon: AlertTriangle,
    };
  }

  // Generic Error
  if (error instanceof Error) {
    if (error.message.includes("fetch")) {
      return {
        title: "Connection failed",
        message: "Check your internet connection and try again.",
        icon: WifiOff,
      };
    }
    return {
      title: "Something went wrong",
      message: error.message || "An unexpected error occurred. Please try again.",
      icon: AlertTriangle,
    };
  }

  // Unknown error
  return {
    title: "Something went wrong",
    message: "An unexpected error occurred. Please try again.",
    icon: AlertTriangle,
  };
}

export function ErrorAlert({ error, onDismiss, className }: ErrorAlertProps) {
  if (!error) return null;

  const { title, message, icon: Icon } = getErrorInfo(error);

  return (
    <div
      role="alert"
      className={cn(
        "relative rounded-lg border border-red-500/20 bg-red-500/5 p-4",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-5 shrink-0 text-red-400" />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-red-300">{title}</h4>
          <p className="mt-1 text-sm text-red-200/80 whitespace-pre-line">{message}</p>
        </div>
        {onDismiss && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 shrink-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
            onClick={onDismiss}
            aria-label="Dismiss error"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
