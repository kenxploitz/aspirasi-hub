import PptxGenJS from "pptxgenjs";
import { ExportAspiration, ExportOptions, COLORS, fmtDate, fmtDateTime, statusLabel, genFilename } from "./types";

const FONT = "Calibri";

/** Word-wrap sederhana berbasis karakter — dipakai untuk menghitung baris teks di dalam text box PPTX. */
function wrapLines(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const next = current ? `${current} ${w}` : w;
    if (next.length > maxCharsPerLine) {
      if (current) lines.push(current);
      current = w;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function exportToPptx(data: ExportAspiration[], opts: ExportOptions) {
  const pptx = new PptxGenJS();
  pptx.author = "FASPIRA";
  pptx.title = "Rekap Aspirasi Siswa";
  pptx.layout = "LAYOUT_16x9"; // 10 x 5.63 in

  const schoolName = opts.schoolName || "SMA Negeri 1 Kendal";
  const sudah = data.filter((a) => a.status === "sudah_ditanggapi").length;
  const belum = data.length - sudah;
  const TOTAL_SLIDES = data.length + 2; // cover + ringkasan + N aspirasi

  const addSlideChrome = (slide: any, slideNum: number) => {
    slide.background = { color: "FFFFFF" };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.32, fill: { color: COLORS.primary } });
    slide.addText(schoolName, { x: 0.3, y: 0.04, w: 5, h: 0.26, fontSize: 8, color: "FFFFFF", fontFace: FONT, valign: "middle" });
    slide.addText(`${slideNum} / ${TOTAL_SLIDES}`, { x: 8.7, y: 0.04, w: 1, h: 0.26, fontSize: 8, color: "FFFFFF", fontFace: FONT, align: "right", valign: "middle" });
  };

  // ═══════════════════════ SLIDE 1 — COVER ═══════════════════════
  const cover = pptx.addSlide();
  cover.background = { color: COLORS.primary };
  cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.12, fill: { color: COLORS.accent } });

  cover.addText(schoolName.toUpperCase(), {
    x: 0.5, y: 1.15, w: 9, h: 0.4, fontSize: 12, color: "C7D6E8", fontFace: FONT, align: "center", charSpacing: 3,
  });
  cover.addText("REKAP ASPIRASI SISWA", {
    x: 0.5, y: 1.65, w: 9, h: 0.9, fontSize: 34, bold: true, color: "FFFFFF", fontFace: FONT, align: "center",
  });
  cover.addShape(pptx.ShapeType.rect, { x: 4.1, y: 2.55, w: 1.8, h: 0.03, fill: { color: COLORS.accent } });
  cover.addText(
    opts.dateFrom && opts.dateTo ? `Periode ${fmtDate(opts.dateFrom)} — ${fmtDate(opts.dateTo)}` : "Seluruh Periode",
    { x: 0.5, y: 2.72, w: 9, h: 0.35, fontSize: 13, color: "DCE6F2", fontFace: FONT, align: "center" },
  );

  const cardW = 2.5, cardH = 1.35, cardGap = 0.35;
  const cardStartX = (10 - cardW * 3 - cardGap * 2) / 2;
  const cardY = 3.35;
  [
    { label: "Total Aspirasi", value: `${data.length}`, color: "2E86AB" },
    { label: "Sudah Ditanggapi", value: `${sudah} (${data.length ? Math.round((sudah / data.length) * 100) : 0}%)`, color: COLORS.success },
    { label: "Belum Ditanggapi", value: `${belum} (${data.length ? Math.round((belum / data.length) * 100) : 0}%)`, color: COLORS.warning },
  ].forEach((c, i) => {
    const x = cardStartX + i * (cardW + cardGap);
    cover.addShape(pptx.ShapeType.roundRect, { x, y: cardY, w: cardW, h: cardH, fill: { color: "FFFFFF" }, rectRadius: 0.07, shadow: { type: "outer", blur: 5, offset: 2, opacity: 0.25, color: "000000" } });
    cover.addShape(pptx.ShapeType.rect, { x, y: cardY, w: cardW, h: 0.06, fill: { color: c.color } });
    cover.addText(c.value, { x, y: cardY + 0.18, w: cardW, h: 0.62, fontSize: 24, bold: true, color: c.color, fontFace: FONT, align: "center", valign: "middle" });
    cover.addText(c.label, { x: x + 0.1, y: cardY + 0.85, w: cardW - 0.2, h: 0.4, fontSize: 9.5, color: COLORS.textSec, fontFace: FONT, align: "center", valign: "middle" });
  });

  cover.addText(`Dicetak pada ${fmtDateTime(new Date().toISOString())} WIB`, {
    x: 0.5, y: 5.15, w: 9, h: 0.3, fontSize: 8.5, color: "AEC2D8", fontFace: FONT, align: "center",
  });

  // ═══════════════════════ SLIDE 2 — RINGKASAN STATISTIK ═══════════════════════
  const summary = pptx.addSlide();
  addSlideChrome(summary, 2);
  summary.addText("Ringkasan Statistik", { x: 0.5, y: 0.55, w: 9, h: 0.5, fontSize: 22, bold: true, color: COLORS.primary, fontFace: FONT });
  summary.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.05, w: 1.6, h: 0.035, fill: { color: COLORS.accent } });

  const barX = 2.4, barMaxW = 6.2, barH = 0.62, labelW = 1.8;
  const sudahW = data.length ? Math.max(0.4, (sudah / data.length) * barMaxW) : 0.4;
  const belumW = data.length ? Math.max(0.4, (belum / data.length) * barMaxW) : 0.4;

  summary.addText("Sudah Ditanggapi", { x: 0.5, y: 1.55, w: labelW, h: barH, fontSize: 11, bold: true, color: COLORS.text, fontFace: FONT, valign: "middle" });
  summary.addShape(pptx.ShapeType.roundRect, { x: barX, y: 1.55, w: barMaxW, h: barH, fill: { color: COLORS.successBg }, rectRadius: 0.05 });
  summary.addShape(pptx.ShapeType.roundRect, { x: barX, y: 1.55, w: sudahW, h: barH, fill: { color: COLORS.success }, rectRadius: 0.05 });
  summary.addText(`${sudah} (${data.length ? Math.round((sudah / data.length) * 100) : 0}%)`, { x: barX + 0.15, y: 1.55, w: barMaxW - 0.3, h: barH, fontSize: 11, bold: true, color: "FFFFFF", fontFace: FONT, valign: "middle" });

  summary.addText("Belum Ditanggapi", { x: 0.5, y: 2.35, w: labelW, h: barH, fontSize: 11, bold: true, color: COLORS.text, fontFace: FONT, valign: "middle" });
  summary.addShape(pptx.ShapeType.roundRect, { x: barX, y: 2.35, w: barMaxW, h: barH, fill: { color: COLORS.warningBg }, rectRadius: 0.05 });
  summary.addShape(pptx.ShapeType.roundRect, { x: barX, y: 2.35, w: belumW, h: barH, fill: { color: COLORS.warning }, rectRadius: 0.05 });
  summary.addText(`${belum} (${data.length ? Math.round((belum / data.length) * 100) : 0}%)`, { x: barX + 0.15, y: 2.35, w: barMaxW - 0.3, h: barH, fontSize: 11, bold: true, color: "FFFFFF", fontFace: FONT, valign: "middle" });

  summary.addShape(pptx.ShapeType.rect, { x: 0.5, y: 3.35, w: 9, h: 0.01, fill: { color: COLORS.border } });
  summary.addText(`Total keseluruhan: ${data.length} aspirasi tercatat dalam laporan ini.`, {
    x: 0.5, y: 3.55, w: 9, h: 0.4, fontSize: 12, color: COLORS.textSec, fontFace: FONT, italic: true,
  });

  // ═══════════════════════ SLIDE 3+ — 1 ASPIRASI / SLIDE ═══════════════════════
  data.forEach((asp, i) => {
    const slide = pptx.addSlide();
    const slideNum = i + 3;
    addSlideChrome(slide, slideNum);

    const isSudah = asp.status === "sudah_ditanggapi";
    const statusColor = isSudah ? COLORS.success : COLORS.warning;
    const statusBg = isSudah ? COLORS.successBg : COLORS.warningBg;
    const hasReply = !!(asp.comments && asp.comments.length > 0);

    // Kartu utama
    const cardY = 0.55, cardH = 4.65;
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.45, y: cardY, w: 9.1, h: cardH,
      fill: { color: "FFFFFF" }, rectRadius: 0.08,
      shadow: { type: "outer", blur: 7, offset: 2, opacity: 0.14, color: "000000" },
      line: { color: COLORS.border, width: 0.75 },
    });

    // Status chip
    slide.addShape(pptx.ShapeType.roundRect, { x: 0.75, y: cardY + 0.3, w: 1.55, h: 0.33, fill: { color: statusBg }, rectRadius: 0.16 });
    slide.addText(statusLabel(asp.status), { x: 0.75, y: cardY + 0.3, w: 1.55, h: 0.33, fontSize: 9.5, bold: true, color: statusColor, fontFace: FONT, align: "center", valign: "middle" });

    // Nomor urut
    slide.addText(`#${i + 1}`, { x: 8.5, y: cardY + 0.3, w: 0.9, h: 0.33, fontSize: 10, color: COLORS.textSec, fontFace: FONT, align: "right", valign: "middle" });

    // Nama + kelas
    slide.addText(
      [{ text: asp.student_name, options: { bold: true, fontSize: 17, color: COLORS.text } },
       ...(asp.student_class ? [{ text: `   •   ${asp.student_class}`, options: { fontSize: 12, color: COLORS.textSec } }] : [])],
      { x: 0.75, y: cardY + 0.72, w: 6, h: 0.4, fontFace: FONT, valign: "middle" },
    );

    // Tanggal
    slide.addText(fmtDateTime(asp.created_at), { x: 5.8, y: cardY + 0.75, w: 3.05, h: 0.34, fontSize: 9.5, color: COLORS.textSec, fontFace: FONT, align: "right", valign: "middle" });

    // Garis pemisah
    slide.addShape(pptx.ShapeType.rect, { x: 0.75, y: cardY + 1.28, w: 7.8, h: 0.014, fill: { color: COLORS.border } });

    // Area isi aspirasi — tinggi menyesuaikan apakah ada tanggapan
    const contentY = cardY + 1.48;
    const replyBoxH = 1.15;
    const contentH = hasReply ? cardH - 1.48 - replyBoxH - 0.35 : cardH - 1.48 - 0.3;

    let fontSize = 15;
    if (asp.content.length > 600) fontSize = 10.5;
    else if (asp.content.length > 420) fontSize = 11.5;
    else if (asp.content.length > 280) fontSize = 12.5;
    else if (asp.content.length > 150) fontSize = 13.5;

    const maxCharsPerLine = Math.floor(78 - (fontSize - 10.5) * 3.5);
    const lines = wrapLines(asp.content, Math.max(28, maxCharsPerLine));
    const lineHeight = fontSize * 1.32;
    const maxLines = Math.max(2, Math.floor((contentH * 72) / lineHeight));
    let displayLines = lines;
    if (lines.length > maxLines) {
      displayLines = lines.slice(0, maxLines);
      const last = displayLines[displayLines.length - 1];
      displayLines[displayLines.length - 1] = last.length > 3 ? `${last.slice(0, -3)}...` : `${last}...`;
    }

    slide.addText(displayLines.join("\n"), {
      x: 0.75, y: contentY, w: 7.8, h: contentH,
      fontSize, color: COLORS.text, fontFace: FONT, valign: "top", lineSpacingMultiple: 1.3, align: "left",
    });

    // Kotak "Tanggapan Admin" — callout dengan bar aksen kiri
    if (hasReply) {
      const latest = asp.comments[asp.comments.length - 1];
      const replyY = cardY + cardH - replyBoxH - 0.25;
      slide.addShape(pptx.ShapeType.rect, { x: 0.75, y: replyY, w: 7.8, h: replyBoxH, fill: { color: COLORS.zebra }, line: { color: COLORS.border, width: 0.5 } });
      slide.addShape(pptx.ShapeType.rect, { x: 0.75, y: replyY, w: 0.06, h: replyBoxH, fill: { color: "2E86AB" } });
      slide.addText(
        [
          { text: "TANGGAPAN ADMIN", options: { bold: true, fontSize: 9, color: "2E86AB", charSpacing: 1 } },
          { text: `   ${fmtDateTime(latest.created_at)}`, options: { fontSize: 8.5, italic: true, color: COLORS.textSec } },
        ],
        { x: 0.98, y: replyY + 0.08, w: 7.4, h: 0.28, fontFace: FONT },
      );
      const replyLines = wrapLines(latest.comment_text, 100);
      const replyDisplay = replyLines.slice(0, 3);
      if (replyLines.length > 3) replyDisplay[2] = `${replyDisplay[2].slice(0, -3)}...`;
      slide.addText(replyDisplay.join("\n"), {
        x: 0.98, y: replyY + 0.36, w: 7.4, h: replyBoxH - 0.4,
        fontSize: 10.5, color: COLORS.text, fontFace: FONT, valign: "top", lineSpacingMultiple: 1.2,
      });
    }
  });

  const blob = await pptx.writeBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = genFilename("Rekap-Aspirasi", "pptx", opts);
  a.click();
  URL.revokeObjectURL(url);
}
