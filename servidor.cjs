const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const files = {
  '/propuesta.html': ['propuesta.html', 'text/html; charset=utf-8'],
  '/propuesta.js': ['propuesta.js', 'text/javascript; charset=utf-8'],
  '/torneo.json': ['torneo.json', 'application/json; charset=utf-8']
};
http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = files[pathname === '/' ? '/propuesta.html' : pathname];
  if (!file) { res.writeHead(404); res.end('No encontrado'); return; }
  fs.readFile(path.join(__dirname, file[0]), (error, contents) => {
    res.writeHead(error ? 500 : 200, {'Content-Type': file[1], 'Cache-Control': 'no-store'});
    res.end(error ? 'No se pudo leer el archivo' : contents);
  });
}).listen(8765, '127.0.0.1', () => console.log('Torneo: http://localhost:8765/propuesta.html'));
