import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { readFileSync } from 'fs'
import { getDb } from '../db'
import { parseGradeInput, MIN_GRADE_HUNDREDTHS, MAX_GRADE_HUNDREDTHS } from '../../shared/types'
import type { ValidatedRow, RowStatus, ImportPreview } from '../../shared/types'

interface RawRow {
  token: string
  grade: string
}

function parseFile(filePath: string): RawRow[] {
  if (filePath.toLowerCase().endsWith('.csv')) {
    const content = readFileSync(filePath, 'utf-8')
    const { data } = Papa.parse<RawRow>(content, { header: true, skipEmptyLines: true })
    return data
  }
  const wb = XLSX.readFile(filePath)
  const ws = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json<RawRow>(ws)
}

export async function previewImport(filePath: string): Promise<ImportPreview> {
  const raw = parseFile(filePath)
  const db = getDb()
  const seenTokens = new Map<string, number>()
  const rows: ValidatedRow[] = []

  for (let i = 0; i < raw.length; i++) {
    const r = raw[i]
    const token = String(r.token ?? '').trim()
    const gradeStr = String(r.grade ?? '').trim()

    if (seenTokens.has(token)) {
      rows.push({
        token,
        status: 'duplicate_in_file',
        proposedValue: 0,
        message: `Duplicate of row ${seenTokens.get(token)! + 1}`,
      })
      continue
    }
    seenTokens.set(token, i)

    const proposedValue = parseGradeInput(gradeStr)
    if (
      isNaN(proposedValue) ||
      proposedValue < MIN_GRADE_HUNDREDTHS ||
      proposedValue > MAX_GRADE_HUNDREDTHS
    ) {
      rows.push({
        token,
        status: 'invalid_grade',
        proposedValue: isNaN(proposedValue) ? 0 : proposedValue,
        message: isNaN(proposedValue)
          ? `Not a number: "${gradeStr}"`
          : `Out of range [${MIN_GRADE_HUNDREDTHS / 100}..${MAX_GRADE_HUNDREDTHS / 100}]`,
      })
      continue
    }

    const barcode = await db.barcode.findUnique({
      where: { token },
      include: { grade: true },
    })

    if (!barcode) {
      rows.push({ token, status: 'unknown_token', proposedValue })
      continue
    }

    if (barcode.grade) {
      rows.push({ token, status: 'already_graded', proposedValue, currentValue: barcode.grade.value })
      continue
    }

    rows.push({ token, status: 'ok', proposedValue })
  }

  const summary = {
    ok: rows.filter((r) => r.status === 'ok').length,
    conflicts: rows.filter((r) => r.status === 'already_graded').length,
    errors: rows.filter((r) =>
      (['unknown_token', 'invalid_grade', 'duplicate_in_file'] as RowStatus[]).includes(r.status)
    ).length,
  }

  return { rows, summary }
}

export async function commitImport(
  rows: ValidatedRow[],
  acceptedStatuses: RowStatus[]
): Promise<number> {
  const db = getDb()
  const toCommit = rows.filter((r) => acceptedStatuses.includes(r.status))
  let committed = 0

  await db.$transaction(async (tx) => {
    for (const row of toCommit) {
      const barcode = await tx.barcode.findUnique({ where: { token: row.token } })
      if (!barcode) continue

      await tx.grade.upsert({
        where: { barcodeId: barcode.id },
        create: { barcodeId: barcode.id, value: row.proposedValue },
        update: { value: row.proposedValue },
      })

      await tx.auditLog.create({
        data: {
          action: 'IMPORT_COMMIT',
          payload: JSON.stringify({
            token: row.token,
            value: row.proposedValue,
            prevValue: row.currentValue ?? null,
          }),
        },
      })

      committed++
    }
  })

  return committed
}
