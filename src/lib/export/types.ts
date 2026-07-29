// Export types and utilities

export interface ExportAspiration {
  id: string;
  student_name: string;
  student_class: string | null;
  content: string;
  status: string;
  created_at: string;
  comments: Array<{
    comment_text: string;
    created_at: string;
  }>;
}

export interface ExportOptions {
  title?: string;
  schoolName?: string;
  dateFrom?: string;
  dateTo?: string;
  statusFilter?: string;
}

// Report color palette (HEX, professional school report)
export const REPORT_COLORS = {
  primary: "1E3A5F",
  accent: "2E86AB",
  success: "1B7A43",
  successBg: "E7F6EC",
  warning: "B45309",
  warningBg: "FEF3E2",
  textBody: "1F2937",
  textSecondary: "6B7280",
  border: "E2E8F0",
  zebraRow: "F8FAFC",
  white: "FFFFFF",
} as const;

export function formatDateID(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDateTimeID(dateStr: string): string {
  return new Date(dateStr).toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen - 3) + "...";
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_");
}

export function generateFilename(
  prefix: string,
  ext: string,
  options: ExportOptions
): string {
  const parts = [prefix];
  if (options.dateFrom && options.dateTo) {
    parts.push(`${sanitizeFilename(options.dateFrom)}_sd_${sanitizeFilename(options.dateTo)}`);
  }
  if (options.statusFilter && options.statusFilter !== "all") {
    parts.push(options.statusFilter);
  }
  parts.push(new Date().toISOString().split("T")[0]);
  return `${sanitizeFilename(parts.join("_"))}.${ext}`;
}

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function escapeExcelCell(value: string): string {
  // Prevent formula injection
  if (/^[=+\-@\t\r]/.test(value)) {
    return "'" + value;
  }
  return value;
}

export function getStatusLabel(status: string): string {
  return status === "sudah_ditanggapi" ? "Sudah Ditanggapi" : "Belum Ditanggapi";
}

export function getStatusColor(status: string): { bg: string; text: string } {
  return status === "sudah_ditanggapi"
    ? { bg: REPORT_COLORS.successBg, text: REPORT_COLORS.success }
    : { bg: REPORT_COLORS.warningBg, text: REPORT_COLORS.warning };
}
