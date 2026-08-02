import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class names (shared design-system util). */
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
