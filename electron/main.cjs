const {app, BrowserWindow, ipcMain, dialog} = require('electron');
const path = require('path');
const fs = require('fs/promises');
let win;
function create() {
  win = new BrowserWindow({width: 1440, height: 900, minWidth: 900, minHeight: 640,
    webPreferences: {preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true}});
  win.loadFile(path.join(__dirname, '../dist/index.html'));
}
app.whenReady().then(create);
app.on('window-all-closed', () => {if (process.platform !== 'darwin') app.quit();});
ipcMain.handle('open-files', async () => {
  const r = await dialog.showOpenDialog(win, {properties: ['openFile', 'multiSelections'],
    filters: [{name: 'Audio', extensions: ['mp3', 'm4a', 'aac', 'ogg', 'opus', 'flac', 'wav']}]});
  if (r.canceled) return [];
  return Promise.all(r.filePaths.map(async p => ({name: path.basename(p), base64: (await fs.readFile(p)).toString('base64')})));
});
