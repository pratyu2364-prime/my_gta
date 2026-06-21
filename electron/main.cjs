// Gully Run — Electron entry. Serves the static game over an in-process localhost
// origin (NOT file://) so ES modules, the import map, fetch() for GLB/HDRI, and
// WebAudio all behave exactly as on the web build.
const { app, BrowserWindow, shell } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');              // app root (index.html, src/, vendor/, assets/)
const MIME = {
  '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.cjs':'text/javascript',
  '.json':'application/json', '.wasm':'application/wasm', '.css':'text/css',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml',
  '.glb':'model/gltf-binary', '.gltf':'model/gltf+json', '.hdr':'image/vnd.radiance',
  '.woff2':'font/woff2', '.woff':'font/woff', '.ttf':'font/ttf', '.bin':'application/octet-stream'
};

function startServer() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      let urlPath = decodeURIComponent(req.url.split('?')[0]);
      if (urlPath === '/') urlPath = '/index.html';
      // resolve safely inside ROOT (no path traversal)
      const filePath = path.normalize(path.join(ROOT, urlPath));
      if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); return res.end('not found'); }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));   // port 0 = OS picks a free port
  });
}

async function createWindow() {
  const port = await startServer();
  const win = new BrowserWindow({
    width: 1280, height: 720, minWidth: 960, minHeight: 540,
    backgroundColor: '#070b12',
    autoHideMenuBar: true,
    title: 'Gully Run',
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  });
  win.setMenuBarVisibility(false);
  // open any external links (none expected) in the system browser, not a new Electron window
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.loadURL(`http://127.0.0.1:${port}/index.html`);
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
