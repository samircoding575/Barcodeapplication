import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import fs from 'fs'
import path from 'path'
import { AdminChannels } from '@shared/ipc'
import { closeDb, getDb, migrateLegacyUserRoles } from './db'
import { registerAdminHandlers } from './ipc/admin'
import { registerTeacherHandlers } from './ipc/teacher'
import { registerConfigHandlers } from './ipc/config'
import { registerAuthHandlers } from './ipc/auth'
import { registerSessionHandlers } from './ipc/session'
import { registerExamHandlers } from './ipc/exam'
import { buildBarcodesDocx, type BarcodeExportRecord } from './services/barcodeDocx'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'ScanGrade — Lebanese Bar Association',
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

ipcMain.handle(AdminChannels.EXPORT_BARCODES_DOCX, async (event, args: { records: BarcodeExportRecord[] }) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return { error: 'No window found' }

  try {
    const db = getDb()
    const cfg = await db.appConfig.findUnique({ where: { id: 'singleton' } })
    const layout = {
      cellW: cfg?.printStickerW ?? 48.5,
      cellH: cfg?.printStickerH ?? 16.9,
      topMargin: cfg?.printTopMm ?? 0,
      leftMargin: cfg?.printLeftMm ?? 0,
    }

    const buffer = await buildBarcodesDocx(args.records ?? [], layout)

    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Save Barcodes (Word)',
      defaultPath: `barcodes-${new Date().toISOString().slice(0, 10)}.docx`,
      filters: [{ name: 'Word Document', extensions: ['docx'] }],
    })

    if (canceled || !filePath) return { canceled: true }

    try {
      fs.writeFileSync(filePath, buffer)
      await shell.openPath(filePath)
      return { success: true }
    } catch (err: any) {
      if (err.code === 'EBUSY') {
        dialog.showErrorBox('File in Use', `The file is currently open in another program.\n\nPlease close Word and try again.\n\nPath: ${filePath}`)
        return { success: false, error: 'File in use' }
      }
      console.error('[export-docx]', err)
      return { success: false, error: err.message }
    }
  } catch (err: any) {
    console.error('[export-docx]', err)
    return { success: false, error: err.message }
  }
})

app.whenReady().then(async () => {
  await migrateLegacyUserRoles()
  registerAuthHandlers()
  registerSessionHandlers()
  registerExamHandlers()
  registerAdminHandlers()
  registerTeacherHandlers()
  registerConfigHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', async () => {
  await closeDb()
  if (process.platform !== 'darwin') app.quit()
})
