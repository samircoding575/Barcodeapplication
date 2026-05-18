import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  ImageRun, TextRun, WidthType, HeightRule, AlignmentType, VerticalAlign,
  BorderStyle, PageBreak, convertMillimetersToTwip,
} from 'docx'
import bwipjs from 'bwip-js'

export interface BarcodeExportRecord {
  token: string
  studentName: string
  externalId: string
  examName: string
}

export interface DocxLayout {
  cellW: number       // mm — sticker width
  cellH: number       // mm — sticker height
  topMargin: number   // mm — signed delta added to auto-centered top margin
  leftMargin: number  // mm — signed delta added to auto-centered left margin
}

const ROWS_PER_PAGE = 17
const RECORDS_PER_ROW = 2
const RECORDS_PER_PAGE = ROWS_PER_PAGE * RECORDS_PER_ROW
const PAGE_W_MM = 210
const PAGE_H_MM = 297

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
// Light grey cell outline so user can visually verify the sticker grid on screen.
// They can remove all borders inside Word later if not wanted on print.
const CELL_BORDER = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' }

async function makeBarcodePng(token: string): Promise<Buffer> {
  return bwipjs.toBuffer({
    bcid: 'code128',
    text: token,
    scale: 3,
    height: 10,
    includetext: false,
    backgroundcolor: 'FFFFFF',
  })
}

// 45mm × 11mm barcode image, in pixels at 96 DPI (Word's image render basis)
const BARCODE_PX_W = Math.round(45 * 96 / 25.4)  // ≈ 170
const BARCODE_PX_H = Math.round(11 * 96 / 25.4)  // ≈ 42

function emptyCell(cellW: number): TableCell {
  return new TableCell({
    width: { size: convertMillimetersToTwip(cellW), type: WidthType.DXA },
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    borders: { top: CELL_BORDER, bottom: CELL_BORDER, left: CELL_BORDER, right: CELL_BORDER },
    children: [new Paragraph({ children: [] })],
  })
}

function barcodeCell(rec: BarcodeExportRecord, png: Buffer, cellW: number): TableCell {
  return new TableCell({
    width: { size: convertMillimetersToTwip(cellW), type: WidthType.DXA },
    margins: {
      top: convertMillimetersToTwip(0.5),
      bottom: convertMillimetersToTwip(0.3),
      left: convertMillimetersToTwip(1.5),
      right: convertMillimetersToTwip(1.5),
    },
    verticalAlign: VerticalAlign.CENTER,
    borders: { top: CELL_BORDER, bottom: CELL_BORDER, left: CELL_BORDER, right: CELL_BORDER },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0, line: 240 },
        children: [
          new ImageRun({
            type: 'png',
            data: png,
            transformation: { width: BARCODE_PX_W, height: BARCODE_PX_H },
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0, line: 200 },
        children: [
          // size is half-points: 13 = 6.5pt
          new TextRun({ text: rec.token, font: 'Arial', size: 13, bold: true }),
        ],
      }),
    ],
  })
}

function textCell(rec: BarcodeExportRecord, cellW: number): TableCell {
  return new TableCell({
    width: { size: convertMillimetersToTwip(cellW), type: WidthType.DXA },
    margins: {
      top: convertMillimetersToTwip(0.8),
      bottom: convertMillimetersToTwip(0.8),
      left: convertMillimetersToTwip(2),
      right: convertMillimetersToTwip(2),
    },
    verticalAlign: VerticalAlign.CENTER,
    borders: { top: CELL_BORDER, bottom: CELL_BORDER, left: CELL_BORDER, right: CELL_BORDER },
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        spacing: { before: 0, after: 0, line: 220 },
        children: [
          new TextRun({ text: rec.studentName, font: 'Arial', size: 15, bold: true, rightToLeft: true }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        spacing: { before: 0, after: 0, line: 200 },
        children: [
          new TextRun({ text: `ID: ${rec.externalId}`, font: 'Arial', size: 13 }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        spacing: { before: 0, after: 0, line: 200 },
        children: [
          new TextRun({ text: rec.examName, font: 'Arial', size: 13 }),
        ],
      }),
    ],
  })
}

export async function buildBarcodesDocx(
  records: BarcodeExportRecord[],
  layout: DocxLayout,
): Promise<Buffer> {
  const { cellW, cellH, topMargin, leftMargin } = layout

  // Auto-center the table on A4, then apply signed deltas. Same math as PDF mode.
  const tableW = cellW * (RECORDS_PER_ROW * 2)  // 4 cells per row × cell width
  const tableH = cellH * ROWS_PER_PAGE
  const baseTop = Math.max(0, (PAGE_H_MM - tableH) / 2 + topMargin)
  const baseLeft = Math.max(0, (PAGE_W_MM - tableW) / 2 + leftMargin)
  const baseBottom = Math.max(0, PAGE_H_MM - tableH - baseTop)
  const baseRight = Math.max(0, PAGE_W_MM - tableW - baseLeft)

  // Pre-generate all barcode PNGs in parallel
  const pngs = await Promise.all(records.map((r) => makeBarcodePng(r.token)))

  const sectionChildren: (Table | Paragraph)[] = []
  for (let p = 0; p < records.length; p += RECORDS_PER_PAGE) {
    const pageRecords = records.slice(p, p + RECORDS_PER_PAGE)
    const pagePngs = pngs.slice(p, p + RECORDS_PER_PAGE)

    const rows: TableRow[] = []
    for (let r = 0; r < ROWS_PER_PAGE; r++) {
      const cells: TableCell[] = []
      for (let c = 0; c < RECORDS_PER_ROW; c++) {
        const idx = r * RECORDS_PER_ROW + c
        if (idx >= pageRecords.length) {
          cells.push(emptyCell(cellW), emptyCell(cellW))
        } else {
          cells.push(barcodeCell(pageRecords[idx], pagePngs[idx], cellW))
          cells.push(textCell(pageRecords[idx], cellW))
        }
      }
      rows.push(new TableRow({
        children: cells,
        height: { value: convertMillimetersToTwip(cellH), rule: HeightRule.EXACT },
        cantSplit: true,
      }))
    }

    const table = new Table({
      rows,
      width: { size: convertMillimetersToTwip(tableW), type: WidthType.DXA },
      columnWidths: Array(RECORDS_PER_ROW * 2).fill(convertMillimetersToTwip(cellW)),
      borders: {
        top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER,
        insideHorizontal: NO_BORDER, insideVertical: NO_BORDER,
      },
    })

    if (p > 0) sectionChildren.push(new Paragraph({ children: [new PageBreak()] }))
    sectionChildren.push(table)
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: {
            width: convertMillimetersToTwip(PAGE_W_MM),
            height: convertMillimetersToTwip(PAGE_H_MM),
          },
          margin: {
            top: convertMillimetersToTwip(baseTop),
            bottom: convertMillimetersToTwip(baseBottom),
            left: convertMillimetersToTwip(baseLeft),
            right: convertMillimetersToTwip(baseRight),
          },
        },
      },
      children: sectionChildren.length > 0
        ? sectionChildren
        : [new Paragraph({ text: 'No barcodes to export.' })],
    }],
  })

  return Packer.toBuffer(doc) as unknown as Buffer
}
