import { app, BrowserWindow } from 'electron'
import path from 'path'
import { closeDb } from './db'
import { registerAdminHandlers } from './ipc/admin'
import { registerTeacherHandlers } from './ipc/teacher'
import { registerConfigHandlers } from './ipc/config'
import { registerAuthHandlers } from './ipc/auth'
import { registerSessionHandlers } from './ipc/session'

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

app.whenReady().then(() => {
  registerAuthHandlers()
  registerSessionHandlers()
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
