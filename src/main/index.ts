import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import fs from 'fs'
import path from 'path'
import { AdminChannels } from '@shared/ipc'
import { closeDb } from './db'
import { registerAdminHandlers } from './ipc/admin'
import { registerTeacherHandlers } from './ipc/teacher'
import { registerConfigHandlers } from './ipc/config'
import { registerAuthHandlers } from './ipc/auth'
import { registerSessionHandlers } from './ipc/session'
import { registerExamHandlers } from './ipc/exam'

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

ipcMain.handle(AdminChannels.PRINT_BARCODES_PDF, async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return { error: 'No window found' }

  const pdfBuffer = await win.webContents.printToPDF({
    printBackground: true,
    pageSize: 'A4',
    landscape: false,
    margins: { marginType: 'custom', top: 0, bottom: 0, left: 0, right: 0 }
  })

  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Save Barcode PDF',
    defaultPath: `barcodes-${new Date().toISOString().slice(0, 10)}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  })

  if (!canceled && filePath) {
    try {
      fs.writeFileSync(filePath, pdfBuffer)
      await shell.openPath(filePath)
      return { success: true }
    } catch (err: any) {
      if (err.code === 'EBUSY') {
        dialog.showErrorBox('File in Use', `The file is currently open in another program.\n\nPlease close the PDF viewer and try again.\n\nPath: ${filePath}`)
        return { success: false, error: 'File in use' }
      }
      console.error('[print-pdf]', err)
      return { success: false, error: err.message }
    }
  }
  return { canceled: true }
})

app.whenReady().then(() => {
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
