import { EnvironmentType } from "@/constants";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatLastUsed = (lastUsedAt: Date | string | null) => {
  if (!lastUsedAt) return "Never";
  if (typeof lastUsedAt === "string") {
    lastUsedAt = new Date(lastUsedAt);
  } else if (!(lastUsedAt instanceof Date)) {
    throw new Error("Invalid date format");
  }

  const now = new Date();
  const diffMs = now.getTime() - lastUsedAt.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
};

export const formatDate = (date: Date | string) => {
  if (typeof date === "string") {
    date = new Date(date);
  } else if (!(date instanceof Date)) {
    throw new Error("Invalid date format");
  }

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } else {
    return date.toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
};

export const getRandomHexCode = () => {
  const code = `${Math.floor(Math.random() * 16777215).toString(16)}`;
  return `#${code.padStart(6, "0")}`;
};

/**
 * Determines if a color is light or dark based on its perceived brightness
 * @param hexColor - The hex color code (with or without #)
 * @returns true if the color is light, false if dark
 */
export const isLightColor = (hexColor: string): boolean => {
  // Remove # if present
  const hex = hexColor.replace(/^#/, "");

  // Parse the hex values
  let r = 0,
    g = 0,
    b = 0;

  if (hex.length === 3) {
    // For shorthand hex values like #FFF
    r = parseInt(hex.charAt(0) + hex.charAt(0), 16);
    g = parseInt(hex.charAt(1) + hex.charAt(1), 16);
    b = parseInt(hex.charAt(2) + hex.charAt(2), 16);
  } else {
    // For full hex values like #FFFFFF
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  }

  // Calculate perceived brightness using the YIQ formula
  // This formula gives more weight to colors the human eye is more sensitive to
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;

  // YIQ values above 128 are considered light, below are dark
  return yiq >= 128;
};

/**
 * Generates light and dark variations of a given color
 * @param hexColor - The hex color code (with or without #)
 * @param percentage - Percentage to lighten or darken (default: 20%)
 * @returns An object with light and dark variations of the color
 */
export const generateColorShades = (
  hexColor: string,
  percentage: number = 20
): { light: string; original: string; dark: string } => {
  // Ensure hex color starts with # and is valid
  const validHex = hexColor.replace(/^#/, "");

  // Parse the hex values
  let r, g, b;

  if (validHex.length === 3) {
    // For shorthand hex values like #FFF
    r = parseInt(validHex.charAt(0) + validHex.charAt(0), 16);
    g = parseInt(validHex.charAt(1) + validHex.charAt(1), 16);
    b = parseInt(validHex.charAt(2) + validHex.charAt(2), 16);
  } else {
    // For full hex values like #FFFFFF
    r = parseInt(validHex.substring(0, 2), 16);
    g = parseInt(validHex.substring(2, 4), 16);
    b = parseInt(validHex.substring(4, 6), 16);
  }

  // Generate lighter shade
  const lighterR = Math.min(255, r + (255 - r) * (percentage / 100));
  const lighterG = Math.min(255, g + (255 - g) * (percentage / 100));
  const lighterB = Math.min(255, b + (255 - b) * (percentage / 100));

  // Generate darker shade
  const darkerR = Math.max(0, r - (r * percentage) / 100);
  const darkerG = Math.max(0, g - (g * percentage) / 100);
  const darkerB = Math.max(0, b - (b * percentage) / 100);

  // Convert back to hex
  const lightHex =
    "#" +
    Math.round(lighterR).toString(16).padStart(2, "0") +
    Math.round(lighterG).toString(16).padStart(2, "0") +
    Math.round(lighterB).toString(16).padStart(2, "0");

  const darkHex =
    "#" +
    Math.round(darkerR).toString(16).padStart(2, "0") +
    Math.round(darkerG).toString(16).padStart(2, "0") +
    Math.round(darkerB).toString(16).padStart(2, "0");

  return {
    light: lightHex,
    original: "#" + validHex,
    dark: darkHex,
  };
};

export const getDefaultEnvironmentType = (
  environmentTypes: EnvironmentType[]
): string => {
  if (!environmentTypes || environmentTypes.length === 0) {
    return "";
  }
  const defaultEnvType = environmentTypes.find((env) => env.is_default);

  return defaultEnvType ? defaultEnvType.id : environmentTypes[0].id;
};
