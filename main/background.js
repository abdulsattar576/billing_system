const path = require('path')
const { app, ipcMain } = require('electron')
const serve = require('electron-serve')
const { createWindow } = require('./helpers/index.js')

const isProd = process.env.NODE_ENV === 'production'

if (isProd) {
  serve({ directory: 'app' })
} else {
  app.setPath('userData', `${app.getPath('userData')} (development)`)
}

;(async () => {
  await app.whenReady()

  const mainWindow = createWindow('main', {
    width: 1000,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  if (isProd) {
  await mainWindow.loadURL('app://./')
} else {
  const port = process.argv[2]
  await mainWindow.loadURL(`http://localhost:${port}/`)
  mainWindow.webContents.openDevTools()
}
})()

app.on('window-all-closed', () => {
  app.quit()
})

ipcMain.on('message', async (event, arg) => {
  event.reply('message', `${arg} World!`)
})
