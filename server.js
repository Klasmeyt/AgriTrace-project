const express = require('express');
const path = require('path');

// Load .env file if present (local dev)
try { require('dotenv').config(); } catch {}

const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 8080;

// ── Supabase client ──────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY (or SUPABASE_ANON_KEY) must be set in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.static(__dirname));

// ── Helpers ──────────────────────────────────────────────────────────────────
function supaErr(operation, error) {
  console.error(`[Supabase] ${operation}:`, error.message);
  return { error: `${operation} failed: ${error.message}` };
}

// Fetch all four tables and return them as the unified state object the
// frontend already expects: { users, farms, incidents, activityLog }
async function readAllTables() {
  const [users, farms, incidents, activity] = await Promise.all([
    supabase.from('users').select('*').order('created', { ascending: true }),
    supabase.from('farms').select('*').order('registered', { ascending: true }),
    supabase.from('incidents').select('*').order('date', { ascending: false }),
    supabase.from('activityLog').select('*').order('timestamp', { ascending: false }),
  ]);

  for (const [name, result] of [['users', users], ['farms', farms], ['incidents', incidents], ['activityLog', activity]]) {
    if (result.error) throw new Error(`Failed to read ${name}: ${result.error.message}`);
  }

  return {
    users: users.data || [],
    farms: farms.data || [],
    incidents: incidents.data || [],
    activityLog: activity.data || [],
  };
}

// ── GET /api/state  –  load full state ──────────────────────────────────────
app.get('/api/state', async (req, res) => {
  try {
    const state = await readAllTables();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/state  –  full-replace sync (upsert all rows) ─────────────────
// The frontend sends the entire state object and expects it to be persisted.
// We upsert every record so that inserts and updates are handled in one pass.
app.post('/api/state', async (req, res) => {
  try {
    const { users = [], farms = [], incidents = [], activityLog = [] } = req.body || {};

    const ops = [
      users.length      ? supabase.from('users').upsert(users,       { onConflict: 'id' }) : null,
      farms.length      ? supabase.from('farms').upsert(farms,       { onConflict: 'id' }) : null,
      incidents.length  ? supabase.from('incidents').upsert(incidents,{ onConflict: 'id' }) : null,
      activityLog.length? supabase.from('activityLog').upsert(activityLog,{ onConflict: 'id' }) : null,
    ].filter(Boolean);

    const results = await Promise.all(ops);
    for (const r of results) {
      if (r.error) throw new Error(r.error.message);
    }

    const saved = await readAllTables();
    res.json({ success: true, data: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/reset  –  delete all rows from all tables ─────────────────────
app.post('/api/reset', async (req, res) => {
  try {
    // Delete in reverse FK order to avoid constraint violations
    const deletes = await Promise.all([
      supabase.from('activityLog').delete().neq('id', '___none___'),
      supabase.from('incidents').delete().neq('id', '___none___'),
      supabase.from('farms').delete().neq('id', '___none___'),
      supabase.from('users').delete().neq('id', '___none___'),
    ]);
    for (const r of deletes) {
      if (r.error) throw new Error(r.error.message);
    }
    res.json({ success: true, data: { users: [], farms: [], incidents: [], activityLog: [] } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  Granular REST endpoints (used by the frontend for individual record ops)
// ─────────────────────────────────────────────────────────────────────────────

// ── USERS ────────────────────────────────────────────────────────────────────
app.get('/api/users', async (req, res) => {
  const { data, error } = await supabase.from('users').select('*').order('created', { ascending: true });
  if (error) return res.status(500).json(supaErr('users:select', error));
  res.json(data);
});

app.post('/api/users', async (req, res) => {
  const { data, error } = await supabase.from('users').insert([req.body]).select().single();
  if (error) return res.status(500).json(supaErr('users:insert', error));
  res.json(data);
});

app.put('/api/users/:id', async (req, res) => {
  const { data, error } = await supabase.from('users').update(req.body).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json(supaErr('users:update', error));
  res.json(data);
});

app.delete('/api/users/:id', async (req, res) => {
  const { error } = await supabase.from('users').delete().eq('id', req.params.id);
  if (error) return res.status(500).json(supaErr('users:delete', error));
  res.json({ success: true });
});

// ── FARMS ────────────────────────────────────────────────────────────────────
app.get('/api/farms', async (req, res) => {
  const { data, error } = await supabase.from('farms').select('*').order('registered', { ascending: true });
  if (error) return res.status(500).json(supaErr('farms:select', error));
  res.json(data);
});

app.post('/api/farms', async (req, res) => {
  const { data, error } = await supabase.from('farms').insert([req.body]).select().single();
  if (error) return res.status(500).json(supaErr('farms:insert', error));
  res.json(data);
});

app.put('/api/farms/:id', async (req, res) => {
  const { data, error } = await supabase.from('farms').update(req.body).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json(supaErr('farms:update', error));
  res.json(data);
});

app.delete('/api/farms/:id', async (req, res) => {
  const { error } = await supabase.from('farms').delete().eq('id', req.params.id);
  if (error) return res.status(500).json(supaErr('farms:delete', error));
  res.json({ success: true });
});

// ── INCIDENTS ────────────────────────────────────────────────────────────────
app.get('/api/incidents', async (req, res) => {
  const { data, error } = await supabase.from('incidents').select('*').order('date', { ascending: false });
  if (error) return res.status(500).json(supaErr('incidents:select', error));
  res.json(data);
});

app.post('/api/incidents', async (req, res) => {
  const { data, error } = await supabase.from('incidents').insert([req.body]).select().single();
  if (error) return res.status(500).json(supaErr('incidents:insert', error));
  res.json(data);
});

app.put('/api/incidents/:id', async (req, res) => {
  const { data, error } = await supabase.from('incidents').update(req.body).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json(supaErr('incidents:update', error));
  res.json(data);
});

app.delete('/api/incidents/:id', async (req, res) => {
  const { error } = await supabase.from('incidents').delete().eq('id', req.params.id);
  if (error) return res.status(500).json(supaErr('incidents:delete', error));
  res.json({ success: true });
});

// ── ACTIVITY LOG ─────────────────────────────────────────────────────────────
app.get('/api/activity', async (req, res) => {
  const { data, error } = await supabase.from('activityLog').select('*').order('timestamp', { ascending: false });
  if (error) return res.status(500).json(supaErr('activityLog:select', error));
  res.json(data);
});

app.post('/api/activity', async (req, res) => {
  const { data, error } = await supabase.from('activityLog').insert([req.body]).select().single();
  if (error) return res.status(500).json(supaErr('activityLog:insert', error));
  res.json(data);
});

// ── AUTH CALLBACK ─────────────────────────────────────────────────────────────
app.get('/auth/callback', (req, res) => {
  res.redirect('/');
});

// ── SPA fallback ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`AgriTrace+ (Supabase) running at http://localhost:${PORT}`);
});