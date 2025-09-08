// Express server for templating engine (simplified single SQLite via sql.js)
const express = require('express');
const { initData, registerApi } = require('./sharedApi');

const app = express();
const PORT = process.env.PORT || 3000;
let server;

app.use(express.json({ limit: '1mb' }));
registerApi(app); // mounts /api routes

// Serve built client if present
const path = require('path');
const fs = require('fs');
const clientDist = path.join(__dirname, 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req,res)=> res.sendFile(path.join(clientDist,'index.html')));
}

async function bootstrap(){
  await initData();
  server = app.listen(PORT, ()=> console.log(`Server running on :${PORT}`));
  return server;
}

const ready = bootstrap();
module.exports = { app, get server(){ return server; }, ready };
