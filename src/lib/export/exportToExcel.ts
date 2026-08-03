import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { ExportAspiration, ExportOptions, COLORS, fmtDate, fmtDateTime, statusLabel, escExcel, genFilename } from "./types";

const HEADERS = ["No", "Nama Siswa", "Kelas", "Isi Aspirasi", "Status", "Tanggal Dikirim", "Tanggapan Admin", "Tanggal Ditanggapi"];
const LAST_COL = "H"; // 8 kolom

export async function exportToExcel(data: ExportAspiration[], opts: ExportOptions) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "FASPIRA";
  wb.created = new Date();

  const ws = wb.addWorksheet("Data Aspirasi", {
    views: [{ state: "frozen", ySplit: 5, showGridLines: false }],
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.5, header: 0.2, footer: 0.2 },
      printTitlesRow: "5:5",
    },
    headerFooter: {
      oddFooter: "&C&8Halaman &P dari &N",
    },
  });

  const sudah = data.filter((a) => a.status === "sudah_ditanggapi").length;
  const belum = data.length - sudah;

  ws.columns = [
    { width: 5 },   // No
    { width: 22 },  // Nama Siswa
    { width: 12 },  // Kelas
    { width: 52 },  // Isi Aspirasi
    { width: 16 },  // Status
    { width: 19 },  // Tanggal Dikirim
    { width: 40 },  // Tanggapan Admin
    { width: 19 },  // Tanggal Ditanggapi
  ];

  // ── Baris 1: Judul (merge penuh sesuai jumlah kolom yang benar-benar dipakai) ──
  ws.mergeCells(`A1:${LAST_COL}1`);
  const titleCell = ws.getCell("A1");
  titleCell.value = "REKAP ASPIRASI SISWA";
  titleCell.font = { bold: true, size: 18, color: { argb: COLORS.white }, name: "Calibri" };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.primary } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 34;

  // ── Baris 2: nama sekolah + periode ──
  ws.mergeCells(`A2:${LAST_COL}2`);
  const schoolCell = ws.getCell("A2");
  const period = opts.dateFrom && opts.dateTo ? `Periode ${fmtDate(opts.dateFrom)} — ${fmtDate(opts.dateTo)}` : "Seluruh Periode";
  schoolCell.value = `${opts.schoolName || "SMA Negeri 1 Kendal"}  •  ${period}`;
  schoolCell.font = { bold: true, size: 11, color: { argb: COLORS.primary }, name: "Calibri" };
  schoolCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "EAF1F8" } };
  schoolCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = 22;

  // ── Baris 3: sub-info jumlah data + waktu export ──
  ws.mergeCells(`A3:${LAST_COL}3`);
  const subCell = ws.getCell("A3");
  subCell.value = `${data.length} aspirasi  (Sudah: ${sudah} • Belum: ${belum})  —  Diekspor ${fmtDateTime(new Date().toISOString())} WIB`;
  subCell.font = { italic: true, size: 9.5, color: { argb: COLORS.textSec }, name: "Calibri" };
  subCell.alignment = { horizontal: "center" };
  ws.getRow(3).height = 18;

  // ── Baris 4: kosong (spacer) ──
  ws.getRow(4).height = 6;

  // ── Baris 5: header tabel ──
  const headerRow = ws.getRow(5);
  HEADERS.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 10.5, color: { argb: COLORS.white }, name: "Calibri" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.primary } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: COLORS.primary } },
      bottom: { style: "medium", color: { argb: COLORS.accent } },
      left: { style: "thin", color: { argb: COLORS.white } },
      right: { style: "thin", color: { argb: COLORS.white } },
    };
  });
  headerRow.height = 30;

  // ── Baris data ──
  data.forEach((asp, i) => {
    const rowNum = i + 6;
    const row = ws.getRow(rowNum);
    const isSudah = asp.status === "sudah_ditanggapi";
    const isZebra = i % 2 === 1;
    const latestComment = asp.comments && asp.comments.length > 0 ? asp.comments[asp.comments.length - 1] : null;

    const values = [
      i + 1,
      escExcel(asp.student_name),
      escExcel(asp.student_class || "-"),
      escExcel(asp.content),
      statusLabel(asp.status),
      fmtDateTime(asp.created_at),
      latestComment ? escExcel(latestComment.comment_text) : "—",
      latestComment ? fmtDateTime(latestComment.created_at) : "—",
    ];

    values.forEach((v, j) => {
      const cell = row.getCell(j + 1);
      cell.value = v;
      cell.font = { size: 10.5, name: "Calibri", color: { argb: j === 6 && !latestComment ? COLORS.textSec : COLORS.text } };
      cell.alignment = {
        vertical: "top",
        wrapText: j === 3 || j === 6,
        horizontal: j === 0 || j === 2 || j === 4 ? "center" : "left",
      };
      cell.border = {
        bottom: { style: "thin", color: { argb: COLORS.border } },
        top: { style: "thin", color: { argb: COLORS.border } },
        left: { style: "thin", color: { argb: COLORS.border } },
        right: { style: "thin", color: { argb: COLORS.border } },
      };
      if (isZebra) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.zebra } };
      }
    });

    // Status column: chip warna
    const statusCell = row.getCell(5);
    statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isSudah ? COLORS.successBg : COLORS.warningBg } };
    statusCell.font = { size: 10.5, bold: true, name: "Calibri", color: { argb: isSudah ? COLORS.success : COLORS.warning } };
    statusCell.alignment = { horizontal: "center", vertical: "middle" };

    // Tinggi baris menyesuaikan panjang isi aspirasi & tanggapan (mana yang lebih panjang)
    const contentLines = Math.ceil(asp.content.length / 68);
    const commentLines = latestComment ? Math.ceil(latestComment.comment_text.length / 55) : 1;
    row.height = Math.max(24, Math.max(contentLines, commentLines) * 15);
  });

  const lastRow = data.length + 5;
  ws.autoFilter = { from: "A5", to: `${LAST_COL}${lastRow}` };

  // Border luar tabel dipertegas sedikit
  for (let c = 1; c <= 8; c++) {
    ws.getRow(5).getCell(c).border = { ...ws.getRow(5).getCell(c).border, top: { style: "medium", color: { argb: COLORS.primary } } };
  }

  // ── Sheet 2: Ringkasan ──
  const ws2 = wb.addWorksheet("Ringkasan", { views: [{ showGridLines: false }] });
  ws2.columns = [{ width: 26 }, { width: 16 }, { width: 14 }];

  ws2.mergeCells("A1:C1");
  const title2 = ws2.getCell("A1");
  title2.value = "RINGKASAN ASPIRASI";
  title2.font = { bold: true, size: 15, color: { argb: COLORS.white }, name: "Calibri" };
  title2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.primary } };
  title2.alignment = { horizontal: "center", vertical: "middle" };
  ws2.getRow(1).height = 32;

  ws2.mergeCells("A2:C2");
  const sub2 = ws2.getCell("A2");
  sub2.value = opts.schoolName || "SMA Negeri 1 Kendal";
  sub2.font = { italic: true, size: 10, color: { argb: COLORS.textSec }, name: "Calibri" };
  sub2.alignment = { horizontal: "center" };
  ws2.getRow(2).height = 20;

  ws2.mergeCells("A3:C3");

  const summaryRows: [string, string | number, string][] = [
    ["Total Aspirasi", data.length, ""],
    ["Sudah Ditanggapi", sudah, data.length ? `${Math.round((sudah / data.length) * 100)}%` : "0%"],
    ["Belum Ditanggapi", belum, data.length ? `${Math.round((belum / data.length) * 100)}%` : "0%"],
  ];

  summaryRows.forEach((r, i) => {
    const row = ws2.getRow(i + 4);
    row.height = 24;
    const accentColor = i === 1 ? COLORS.success : i === 2 ? COLORS.warning : COLORS.primary;
    const bg = i === 1 ? COLORS.successBg : i === 2 ? COLORS.warningBg : COLORS.zebra;
    r.forEach((v, j) => {
      const cell = row.getCell(j + 1);
      cell.value = v;
      cell.font = { size: 11.5, bold: j !== 2, name: "Calibri", color: { argb: j === 0 ? COLORS.text : accentColor } };
      cell.alignment = { vertical: "middle", horizontal: j === 0 ? "left" : "center" };
      cell.border = { bottom: { style: "thin", color: { argb: COLORS.border } }, top: { style: "thin", color: { argb: COLORS.border } }, left: { style: "thin", color: { argb: COLORS.border } }, right: { style: "thin", color: { argb: COLORS.border } } };
      if (j === 0) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
    });
  });

  const infoRow = ws2.getRow(8);
  ws2.mergeCells(`A8:C8`);
  infoRow.getCell(1).value = `Diekspor pada ${fmtDateTime(new Date().toISOString())} WIB`;
  infoRow.getCell(1).font = { italic: true, size: 9.5, color: { argb: COLORS.textSec }, name: "Calibri" };

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  saveAs(blob, genFilename("Rekap-Aspirasi", "xlsx", opts));
}
