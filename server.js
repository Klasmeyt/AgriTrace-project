const express = require('express');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;
const DB_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DB_DIR, 'database.json');

app.use(express.json({ limit: '5mb' }));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.static(__dirname));

async function ensureDatabase() {
  await fs.mkdir(DB_DIR, { recursive: true });
  try {
    await fs.access(DB_FILE);
  } catch {
    const emptyDb = { users: [], farms: [], incidents: [], activityLog: [] };
    await fs.writeFile(DB_FILE, JSON.stringify(emptyDb, null, 2), 'utf8');
  }
}

async function readDatabase() {
  await ensureDatabase();
  const raw = await fs.readFile(DB_FILE, 'utf8');
  const parsed = JSON.parse(raw || '{}');
  return {
    users: Array.isArray(parsed.users) ? parsed.users : [],
    farms: Array.isArray(parsed.farms) ? parsed.farms : [],
    incidents: Array.isArray(parsed.incidents) ? parsed.incidents : [],
    activityLog: Array.isArray(parsed.activityLog) ? parsed.activityLog : []
  };
}

async function writeDatabase(nextState) {
  await ensureDatabase();
  const safeState = {
    users: Array.isArray(nextState.users) ? nextState.users : [],
    farms: Array.isArray(nextState.farms) ? nextState.farms : [],
    incidents: Array.isArray(nextState.incidents) ? nextState.incidents : [],
    activityLog: Array.isArray(nextState.activityLog) ? nextState.activityLog : []
  };
  await fs.writeFile(DB_FILE, JSON.stringify(safeState, null, 2), 'utf8');
  return safeState;
}

app.get('/api/state', async (req, res) => {
  try {
    const db = await readDatabase();
    res.json(db);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read database' });
  }
});

app.post('/api/state', async (req, res) => {
  try {
    const saved = await writeDatabase(req.body || {});
    res.json({ success: true, data: saved });
  } catch (err) {
    res.status(500).json({ error: 'Failed to write database' });
  }
});

app.post('/api/reset', async (req, res) => {
  try {
    const cleared = await writeDatabase({ users: [], farms: [], incidents: [], activityLog: [] });
    res.json({ success: true, data: cleared });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset database' });
  }
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

ensureDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`AgriTrace backend running at http://localhost:${PORT}`);
  });
});
