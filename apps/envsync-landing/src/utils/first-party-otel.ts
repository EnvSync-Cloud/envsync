/** Browser OTLP must not use obs.<root> (ClickStack UI). Use t.<root>/obs. */
export function firstPartyOtelUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.startsWith("obs.")) {
      return `${parsed.protocol}//t.${parsed.hostname.slice(4)}/obs`;
    }
    return url.replace(/\/$/, "");
  } catch {
    return url;
  }
}
