export interface ExportAspiration {
  id: string;
  student_name: string;
  student_class: string | null;
  content: string;
  status: string;
  created_at: string;
  comments: Array<{ comment_text: string; created_at: string }>;
}

export interface ExportOptions {
  title?: string;
  schoolName?: string;
  dateFrom?: string;
  dateTo?: string;
  statusFilter?: string;
}

export const COLORS = {
  primary: "1E3A5F",
  accent: "2E86AB",
  success: "1B7A43",
  successBg: "E7F6EC",
  warning: "B45309",
  warningBg: "FEF3E2",
  text: "1F2937",
  textSec: "6B7280",
  border: "E2E8F0",
  zebra: "F8FAFC",
  white: "FFFFFF",
} as const;

export function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function statusLabel(s: string) {
  return s === "sudah_ditanggapi" ? "Sudah Ditanggapi" : "Belum Ditanggapi";
}

export function safeName(n: string) {
  return n.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_");
}

export function escXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function escExcel(s: string) {
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

export function genFilename(prefix: string, ext: string, opts: ExportOptions) {
  const parts = [prefix];
  if (opts.dateFrom && opts.dateTo) parts.push(`${safeName(opts.dateFrom)}_sd_${safeName(opts.dateTo)}`);
  if (opts.statusFilter && opts.statusFilter !== "all") parts.push(opts.statusFilter);
  parts.push(new Date().toISOString().split("T")[0]);
  return `${safeName(parts.join("_"))}.${ext}`;
}
