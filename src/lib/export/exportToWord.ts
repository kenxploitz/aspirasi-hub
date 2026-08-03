import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, ShadingType, PageBreak,
  Footer, Header, PageNumber, TabStopType, TabStopPosition,
  VerticalAlign, convertInchesToTwip,
} from "docx";
import { saveAs } from "file-saver";
import { ExportAspiration, ExportOptions, COLORS, fmtDate, fmtDateTime, statusLabel, genFilename } from "./types";

const FONT = "Calibri";
const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } as const;
const thinBorder = (color = COLORS.border) => ({ style: BorderStyle.SINGLE, size: 4, color });

// Satu paragraf kosong sebagai spacer presisi (dalam twips)
const spacer = (h: number) => new Paragraph({ spacing: { before: 0, after: h }, children: [] });

export async function exportToWord(data: ExportAspiration[], opts: ExportOptions) {
  const schoolName = opts.schoolName || "SMA Negeri 1 Kendal";
  const now = new Date();
  const sudah = data.filter((a) => a.status === "sudah_ditanggapi").length;
  const belum = data.length - sudah;
  const children: any[] = [];

  // ───────────────────────── COVER ─────────────────────────
  children.push(
    spacer(2200),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
      children: [new TextRun({ text: schoolName.toUpperCase(), size: 20, color: COLORS.textSec, font: FONT, characterSpacing: 40 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: "REKAP ASPIRASI SISWA", bold: true, size: 50, color: COLORS.primary, font: FONT })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: opts.dateFrom && opts.dateTo ? `Periode ${fmtDate(opts.dateFrom)} — ${fmtDate(opts.dateTo)}` : "Seluruh Periode",
          size: 20, color: COLORS.textSec, font: FONT,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 500 },
      children: [
        new TextRun({ text: "─────  ", color: COLORS.accent, font: FONT, size: 20 }),
        new TextRun({ text: "◆", color: COLORS.accent, font: FONT, size: 16 }),
        new TextRun({ text: "  ─────", color: COLORS.accent, font: FONT, size: 20 }),
      ],
    }),

    // 3 kartu ringkasan (borderless table, jadi terasa seperti "summary cards")
    new Table({
      width: { size: 92, type: WidthType.PERCENTAGE },
      alignment: AlignmentType.CENTER,
      borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder },
      rows: [new TableRow({ children: [
        summaryCardCell(`${data.length}`, "Total Aspirasi", COLORS.primary, 33),
        summaryCardCell(`${sudah}`, `Sudah Ditanggapi (${data.length ? Math.round((sudah / data.length) * 100) : 0}%)`, COLORS.success, 34),
        summaryCardCell(`${belum}`, `Belum Ditanggapi (${data.length ? Math.round((belum / data.length) * 100) : 0}%)`, COLORS.warning, 33),
      ] })],
    }),

    spacer(3400),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `Dicetak pada ${fmtDateTime(now.toISOString())} WIB`, size: 18, color: COLORS.textSec, italics: true, font: FONT })],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // ───────────────────────── RINGKASAN STATISTIK ─────────────────────────
  children.push(
    sectionTitle("Ringkasan Statistik"),
    spacer(200),
    new Table({
      width: { size: 62, type: WidthType.PERCENTAGE },
      borders: outerAndInsideBorders(),
      rows: [
        statRow("Total Aspirasi", `${data.length}`, COLORS.primary, true),
        statRow("Sudah Ditanggapi", `${sudah}  (${data.length ? Math.round((sudah / data.length) * 100) : 0}%)`, COLORS.success, false),
        statRow("Belum Ditanggapi", `${belum}  (${data.length ? Math.round((belum / data.length) * 100) : 0}%)`, COLORS.warning, false, true),
      ],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // ───────────────────────── DAFTAR ASPIRASI ─────────────────────────
  children.push(sectionTitle("Daftar Aspirasi"), spacer(160));

  data.forEach((asp, i) => {
    children.push(aspirationCard(asp, i));
    children.push(spacer(220));
  });

  // ───────────────────────── PENUTUP ─────────────────────────
  children.push(
    new Paragraph({ children: [new PageBreak()] }),
    sectionTitle("Penutup"),
    spacer(160),
    new Paragraph({
      spacing: { after: 200 },
      alignment: AlignmentType.JUSTIFIED,
      children: [new TextRun({
        text: "Demikian rekap aspirasi siswa ini disusun berdasarkan data yang tercatat pada sistem, untuk dapat ditindaklanjuti dan dipergunakan sebagaimana mestinya.",
        size: 22, font: FONT, color: COLORS.text,
      })],
    }),
    spacer(900),
    new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${schoolName}, ${fmtDate(now.toISOString())}`, size: 20, font: FONT, color: COLORS.textSec })] }),
    spacer(900),
    new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "_________________________", size: 22, font: FONT })] }),
    new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Nama & Jabatan Penanggung Jawab", size: 18, color: COLORS.textSec, font: FONT })] }),
  );

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: FONT, size: 22, color: COLORS.text } },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: convertInchesToTwip(0.9), bottom: convertInchesToTwip(0.9), left: convertInchesToTwip(1), right: convertInchesToTwip(1) },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
              border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.accent } },
              spacing: { after: 120 },
              children: [
                new TextRun({ text: schoolName, size: 16, color: COLORS.textSec, font: FONT, bold: true }),
                new TextRun({ text: "\tRekap Aspirasi Siswa", size: 16, color: COLORS.textSec, font: FONT }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              border: { top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.border } },
              spacing: { before: 80 },
              children: [
                new TextRun({ text: "Rekap Aspirasi Siswa  •  Halaman ", size: 16, color: COLORS.textSec, font: FONT }),
                new TextRun({ children: [PageNumber.CURRENT], size: 16, color: COLORS.textSec, font: FONT }),
                new TextRun({ text: " dari ", size: 16, color: COLORS.textSec, font: FONT }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: COLORS.textSec, font: FONT }),
              ],
            }),
          ],
        }),
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, genFilename("Rekap-Aspirasi", "docx", opts));
}

// ══════════════════════════ HELPERS ══════════════════════════

function sectionTitle(text: string) {
  return new Paragraph({
    spacing: { after: 40 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.accent } },
    children: [new TextRun({ text, bold: true, size: 30, color: COLORS.primary, font: FONT })],
  });
}

function summaryCardCell(value: string, label: string, color: string, widthPct: number) {
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: value, bold: true, size: 50, color, font: FONT })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: label, size: 17, color: COLORS.textSec, font: FONT })] }),
    ],
  });
}

function outerAndInsideBorders() {
  const b = thinBorder();
  return { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b };
}

function statRow(label: string, value: string, valueColor: string, isPrimaryHeader: boolean, isLast = false) {
  const fill = isPrimaryHeader ? COLORS.primary : (isLast ? COLORS.zebra : COLORS.white);
  const labelColor = isPrimaryHeader ? COLORS.white : COLORS.text;
  return new TableRow({ children: [
    new TableCell({
      width: { size: 55, type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, fill },
      margins: { top: 100, bottom: 100, left: 150, right: 150 },
      children: [new Paragraph({ children: [new TextRun({ text: label, bold: isPrimaryHeader, size: 22, font: FONT, color: labelColor })] })],
    }),
    new TableCell({
      width: { size: 45, type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, fill },
      margins: { top: 100, bottom: 100, left: 150, right: 150 },
      children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: value, bold: true, size: 22, font: FONT, color: isPrimaryHeader ? COLORS.white : valueColor })] })],
    }),
  ] });
}

/**
 * Satu "kartu" aspirasi = table 1x1 dengan border penuh, berisi beberapa
 * paragraph di dalam SATU cell (header info, isi aspirasi, dan — kalau ada —
 * nested table kecil untuk kotak "Tanggapan Admin"). Ini trik supaya docx
 * merender seperti card, bukan sekadar teks berjajar.
 */
function aspirationCard(asp: ExportAspiration, index: number) {
  const isSudah = asp.status === "sudah_ditanggapi";
  const statusColor = isSudah ? COLORS.success : COLORS.warning;
  const statusBg = isSudah ? COLORS.successBg : COLORS.warningBg;

  const cardChildren: any[] = [
    // Header row: nomor + chip status (nested 1-cell table = chip beneran, bukan cuma teks)
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder },
      rows: [new TableRow({ children: [
        new TableCell({
          width: { size: 62, type: WidthType.PERCENTAGE },
          verticalAlign: VerticalAlign.CENTER,
          borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
          children: [new Paragraph({ children: [
            new TextRun({ text: `${index + 1}.  `, bold: true, size: 22, font: FONT, color: COLORS.textSec }),
            new TextRun({ text: asp.student_name, bold: true, size: 24, font: FONT, color: COLORS.text }),
            new TextRun({ text: asp.student_class ? `   ·   ${asp.student_class}` : "", size: 20, font: FONT, color: COLORS.textSec }),
          ] })],
        }),
        new TableCell({
          width: { size: 38, type: WidthType.PERCENTAGE },
          verticalAlign: VerticalAlign.CENTER,
          borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [
            new TextRun({ text: fmtDateTime(asp.created_at), size: 18, italics: true, font: FONT, color: COLORS.textSec }),
          ] })],
        }),
      ] })],
    }),
    // Chip status di baris sendiri (kecil, kiri)
    new Table({
      width: { size: 40, type: WidthType.PERCENTAGE },
      alignment: AlignmentType.LEFT,
      borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder },
      rows: [new TableRow({ children: [
        new TableCell({
          width: { size: 100, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: statusBg },
          margins: { top: 30, bottom: 30, left: 120, right: 120 },
          borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
          children: [new Paragraph({
            spacing: { before: 60, after: 60 },
            children: [new TextRun({ text: statusLabel(asp.status), bold: true, size: 16, font: FONT, color: statusColor })],
          })],
        }),
      ] })],
    }),
    // Isi aspirasi
    new Paragraph({
      spacing: { before: 160, after: asp.comments?.length ? 140 : 20 },
      alignment: AlignmentType.JUSTIFIED,
      indent: { left: 100 },
      children: [new TextRun({ text: asp.content, size: 22, font: FONT, color: COLORS.text })],
    }),
  ];

  // Kotak "Tanggapan Admin" — nested table, border kiri tebal warna accent (gaya callout box)
  if (asp.comments && asp.comments.length > 0) {
    const latest = asp.comments[asp.comments.length - 1];
    cardChildren.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: thinBorder(COLORS.border), bottom: thinBorder(COLORS.border), right: thinBorder(COLORS.border),
        left: { style: BorderStyle.SINGLE, size: 24, color: COLORS.accent },
        insideHorizontal: noBorder, insideVertical: noBorder,
      },
      rows: [new TableRow({ children: [new TableCell({
        width: { size: 100, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: COLORS.zebra },
        margins: { top: 120, bottom: 120, left: 200, right: 200 },
        children: [
          new Paragraph({ spacing: { after: 40 }, children: [
            new TextRun({ text: "TANGGAPAN ADMIN", bold: true, size: 16, font: FONT, color: COLORS.accent, characterSpacing: 10 }),
            new TextRun({ text: `   ${fmtDateTime(latest.created_at)}`, size: 16, italics: true, font: FONT, color: COLORS.textSec }),
          ] }),
          new Paragraph({ children: [new TextRun({ text: latest.comment_text, size: 20, font: FONT, color: COLORS.text })] }),
        ],
      })] })],
    }));
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: outerAndInsideBorders(),
    rows: [new TableRow({ children: [new TableCell({
      width: { size: 100, type: WidthType.PERCENTAGE },
      margins: { top: 180, bottom: 180, left: 200, right: 200 },
      children: cardChildren,
    })] })],
  });
}
