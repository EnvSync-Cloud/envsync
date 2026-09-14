export function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

export function buildAuditExportCsv(
  rows: Array<{
    created_at: string;
    action: string;
    user_name: string;
    details: string;
  }>,
): string {
  const header = ["timestamp", "action", "user", "details"];
  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [row.created_at, row.action, row.user_name, row.details].map(csvEscape).join(","),
    ),
  ];
  return `${lines.join("\n")}\n`;
}
