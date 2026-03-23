/**
 * AgriTrace+ Core Application
 * State, Auth, Utilities, Map, Sensors
 * @version 2.0
 */

/* ============================================================
   APP STATE
============================================================ */
/** Demo accounts when the API is unreachable (same as quick-login test users). */
const DEMO_SEED_USERS = [
  { id: 'u-seed-admin', name: 'System Admin', email: 'admin@agritrace.ph', password: 'admin123', role: 'admin', status: 'active', avatar: null, phone: '', created: new Date().toISOString() },
  { id: 'u-seed-officer', name: 'Maria Santos', email: 'officer@agritrace.ph', password: 'officer123', role: 'officer', status: 'active', avatar: null, phone: '', created: new Date().toISOString() },
  { id: 'u-seed-farmer', name: 'Juan dela Cruz', email: 'farmer@agritrace.ph', password: 'farmer123', role: 'farmer', status: 'active', avatar: null, phone: '', created: new Date().toISOString() },
];

const SB_LIB = typeof globalThis !== 'undefined' ? globalThis.supabase : null;
let supabase = null;
try {
  if (SB_LIB?.createClient) {
    supabase = SB_LIB.createClient(
      'https://vkgwhdhreoxokaohcvxp.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrZ3doZGhyZW94b2thb2hjdnhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNzI0NzAsImV4cCI6MjA4OTc0ODQ3MH0.gjNM0Ujc7powUhAs9vn1z6bBoyOlvnVuSF1i01tn7y0'
    );
  }
} catch (e) {
  console.warn('Supabase client init failed:', e);
}
const Api = {
  baseUrl: '',
  async loadState() {
    const res = await fetch(`${this.baseUrl}/api/state`);
    const text = await res.text();
    if (!res.ok) throw new Error(text || 'Failed to load backend state');
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('Invalid JSON from server');
    }
  },
  async saveState(payload) {
    const res = await fetch(`${this.baseUrl}/api/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to save backend state');
    return res.json();
  }
};

const AppState = {
  currentUser: null,
  currentPanel: null,
  notifications: [],
  farms: [],
  incidents: [],
  users: [],
  activityLog: [],
  _saveTimer: null,

  async init() {
    this.loadCurrentUser();

    if (supabase?.auth) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const googleUser = {
            id: session.user.id,
            name: session.user.user_metadata?.full_name || session.user.email,
            email: session.user.email,
            role: 'farmer',
            status: 'active',
            avatar: session.user.user_metadata?.avatar_url || null,
            phone: '',
            created: new Date().toISOString()
          };
          AppState.currentUser = googleUser;
          localStorage.setItem('agritrace_user', JSON.stringify(googleUser));
        }
      } catch (e) {
        console.warn('Supabase session check failed:', e);
      }
    }

    await this.loadFromBackend();
    this.syncCurrentUserWithServer();
    this.refreshHeroStats();
    this.initRuntimeNotifications();
  },

  syncCurrentUserWithServer() {
    const cu = this.currentUser;
    if (!cu) return;
    if (cu.password) {
      const u = this.users.find(x => x.email?.toLowerCase() === cu.email?.toLowerCase());
      if (!u || u.password !== cu.password) {
        this.currentUser = null;
        try { localStorage.removeItem('agritrace_user'); } catch (e) {}
        Toast?.show?.('Session expired — please sign in again.', 'info');
      } else {
        this.currentUser = u;
        try { localStorage.setItem('agritrace_user', JSON.stringify(u)); } catch (e) {}
      }
    }
  },

  refreshHeroStats() {
    const farmsEl = document.getElementById('hero-stat-farms');
    const animalsEl = document.getElementById('hero-stat-animals');
    const officersEl = document.getElementById('hero-stat-officers');
    if (!farmsEl || !animalsEl || !officersEl) return;
    const farmCount = this.farms.length;
    const totalAnimals = this.farms.reduce((s, f) => s + (Number(f.totalCount) || 0), 0);
    const officerCount = this.users.filter(u => u.role === 'officer' || u.role === 'admin').length;
    farmsEl.textContent = String(farmCount);
    animalsEl.textContent = String(totalAnimals);
    officersEl.textContent = String(Math.max(officerCount, 1));
  },

  loadCurrentUser() {
    try {
      const u = localStorage.getItem('agritrace_user');
      if (u) this.currentUser = JSON.parse(u);
    } catch (e) { console.warn('Storage load error:', e); }
  },

  async loadFromBackend() {
    try {
      const data = await Api.loadState();
      this.farms = Array.isArray(data.farms) ? data.farms : [];
      this.users = Array.isArray(data.users) ? data.users : [];
      this.incidents = Array.isArray(data.incidents) ? data.incidents : [];
      this.activityLog = Array.isArray(data.activityLog) ? data.activityLog : [];
      if (this.users.length === 0) {
        this.users = DEMO_SEED_USERS.map((u) => ({ ...u }));
      }
    } catch (e) {
      console.warn('Backend load error:', e);
      this.farms = [];
      this.users = DEMO_SEED_USERS.map(u => ({ ...u }));
      this.incidents = [];
      this.activityLog = [];
      Toast?.show?.('Using offline demo accounts. Run npm start with Supabase configured to sync data.', 'warning');
    }
  },

  save() {
    try {
      if (this.currentUser) localStorage.setItem('agritrace_user', JSON.stringify(this.currentUser));
      clearTimeout(this._saveTimer);
      this._saveTimer = setTimeout(() => {
        Api.saveState({
          farms: this.farms,
          users: this.users,
          incidents: this.incidents,
          activityLog: this.activityLog
        }).catch(err => console.warn('Backend save error:', err));
      }, 200);
      this.refreshHeroStats();
    } catch (e) { console.warn('Storage save error:', e); }
  },

  initRuntimeNotifications() {
    this.notifications = [];
    // Notifications always refreshed
  }
};

/* ============================================================
   AUTH
============================================================ */
const Auth = {
  login(email, password) {
    const user = AppState.users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!user) return { success:false, error:'Invalid email or password' };
    if (user.status !== 'active') return { success:false, error:'Your account has been deactivated. Contact admin.' };
    AppState.currentUser = user;
    localStorage.setItem('agritrace_user', JSON.stringify(user));
    return { success:true, user }; 
  },

  async loginWithGoogle() {
    if (!supabase?.auth) {
      Toast?.show?.('Google sign-in is unavailable (Supabase not loaded).', 'error');
      return { success: false, error: 'Supabase not available' };
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/auth/callback' }
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  },
  
  register(data) {
    if (AppState.users.find(u => u.email.toLowerCase() === data.email.toLowerCase()))
      return { success:false, error:'An account with this email already exists' };
    const newUser = {
      id: 'u' + Date.now(), name: data.name, email: data.email,
      password: data.password, role: data.role || 'farmer',
      status: 'active', avatar: null, phone: data.phone || '',
      created: new Date().toISOString()
    };
    AppState.users.push(newUser);
    AppState.save();
    return { success:true, user:newUser };
  },

  logout() {
    if (sensorInterval) clearInterval(sensorInterval);
    supabase?.auth?.signOut?.().catch(() => {});
    AppState.currentUser = null;
    localStorage.removeItem('agritrace_user');
    showPage('home');
    Toast.show('You have been signed out', 'info');
  },

  updateProfile(userId, data) {
    const idx = AppState.users.findIndex(u => u.id === userId);
    if (idx === -1) return { success:false, error:'User not found' };
    AppState.users[idx] = { ...AppState.users[idx], ...data };
    AppState.currentUser = AppState.users[idx];
    localStorage.setItem('agritrace_user', JSON.stringify(AppState.currentUser));
    AppState.save();
    return { success:true };
  },

  changePassword(userId, oldPass, newPass) {
    const user = AppState.users.find(u => u.id === userId);
    if (!user) return { success:false, error:'User not found' };
    if (user.password !== oldPass) return { success:false, error:'Current password is incorrect' };
    return this.updateProfile(userId, { password: newPass });
  }
};

/* ============================================================
   UTILITIES
============================================================ */
const Utils = {
  formatDate(dateStr, format = 'short') {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    if (format === 'short') return d.toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' });
    if (format === 'long')  return d.toLocaleDateString('en-PH', { weekday:'long', month:'long', day:'numeric', year:'numeric' });
    if (format === 'time')  return d.toLocaleString('en-PH', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
    return d.toLocaleDateString();
  },

  getDensityClass(count) {
    if (count > 30) return 'high';
    if (count > 20) return 'medium';
    return 'low';
  },

  getDensityColor(count) {
    if (count > 30) return '#C0392B';
    if (count > 20) return '#D4A843';
    return '#4A7C59';
  },

  getDensityLabel(count) {
    if (count > 30) return 'High Density';
    if (count > 20) return 'Medium';
    return 'Low Density';
  },

  statusColor(status) {
    const map = { approved:'success', active:'success', normal:'success', resolved:'success', pending:'warning', investigating:'warning', medium:'warning', open:'danger', rejected:'danger', critical:'danger', high:'danger', inactive:'neutral', low:'info' };
    return map[status] || 'neutral';
  },

  initials(name) {
    if (!name) return '?';
    return name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase();
  },

  generateId() {
    return 'id' + Date.now().toString(36) + Math.random().toString(36).substr(2,5);
  },

  exportToCSV(data, filename) {
    if (!data || !data.length) { Toast.show('No data to export', 'warning'); return; }
    const flatten = (obj, prefix = '') => {
      return Object.entries(obj).reduce((acc, [k,v]) => {
        const key = prefix ? `${prefix}_${k}` : k;
        if (v !== null && typeof v === 'object' && !Array.isArray(v)) Object.assign(acc, flatten(v, key));
        else acc[key] = v === null ? '' : v;
        return acc;
      }, {});
    };
    const flat = data.map(r => flatten(r));
    const keys = [...new Set(flat.flatMap(Object.keys))];
    const escape = v => `"${String(v).replace(/"/g,'""')}"`;
    const csv = [keys.map(escape).join(','), ...flat.map(r => keys.map(k => escape(r[k]??'')).join(','))].join('\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${filename}_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    AppState.activityLog.unshift({ id: Utils.generateId(), user: AppState.currentUser?.name||'System', action:`Exported ${filename} data (${data.length} records)`, type:'export', timestamp: new Date().toISOString() });
    AppState.save();
    Toast.show(`Exported ${data.length} records to CSV`, 'success');
  },

  importFromCSV(file, onSuccess) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const lines = e.target.result.split('\n').filter(Boolean);
        const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g,'').trim());
        const rows = lines.slice(1).map(line => {
          const vals = []; let cur = ''; let inQ = false;
          for (const ch of line) { if (ch==='"') inQ=!inQ; else if (ch===','&&!inQ) { vals.push(cur); cur=''; } else cur+=ch; }
          vals.push(cur);
          return Object.fromEntries(headers.map((h,i) => [h, vals[i]?.replace(/^"|"$/g,'').trim()||'']));
        });
        AppState.activityLog.unshift({ id: Utils.generateId(), user: AppState.currentUser?.name||'System', action:`Imported ${file.name} (${rows.length} records)`, type:'import', timestamp: new Date().toISOString() });
        AppState.save();
        if (onSuccess) onSuccess(rows);
        Toast.show(`Imported ${rows.length} records from ${file.name}`, 'success');
      } catch (err) { Toast.show('Failed to parse CSV file', 'error'); }
    };
    reader.readAsText(file);
  },

  backupDB() {
    const backup = {
      version: '2.0', exportedAt: new Date().toISOString(),
      farms: AppState.farms, users: AppState.users.map(u => ({...u, password:'[redacted]'})),
      incidents: AppState.incidents, activityLog: AppState.activityLog
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type:'application/json' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `agritrace_backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    AppState.activityLog.unshift({ id:Utils.generateId(), user:AppState.currentUser?.name||'System', action:'Database backup downloaded', type:'backup', timestamp:new Date().toISOString() });
    AppState.save();
    Toast.show('Database backup downloaded successfully', 'success');
  },

  restoreDB(file, onSuccess) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.farms || !data.incidents) throw new Error('Invalid backup format');
        if (data.farms)      AppState.farms       = data.farms;
        if (data.incidents)  AppState.incidents   = data.incidents;
        if (data.activityLog) AppState.activityLog = data.activityLog;
        AppState.activityLog.unshift({ id:Utils.generateId(), user:AppState.currentUser?.name||'System', action:`Database restored from backup (${file.name})`, type:'restore', timestamp:new Date().toISOString() });
        AppState.save();
        if (onSuccess) onSuccess();
        Toast.show('Database restored successfully!', 'success');
      } catch (err) { Toast.show('Invalid backup file. Please use a valid AgriTrace+ backup.', 'error'); }
    };
    reader.readAsText(file);
  }
};

/* ============================================================
   TOAST
============================================================ */
const Toast = {
  init() { /* container already in HTML */ },
  show(msg, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span style="flex:1">${msg}</span><span class="toast-close" onclick="this.parentElement.remove()">✕</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.animation = 'toastOut .25s both'; setTimeout(() => toast.remove(), 260); }, duration);
  }
};

/* ============================================================
   MODAL
============================================================ */
const Modal = {
  open(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.add('show'); document.body.style.overflow = 'hidden'; }
  },
  close(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('show'); document.body.style.overflow = ''; }
  },
  closeAll() {
    document.querySelectorAll('.modal-overlay.show').forEach(el => el.classList.remove('show'));
    document.body.style.overflow = '';
  },
  switchTo(fromId, toId) {
    this.close(fromId);
    setTimeout(() => this.open(toId), 80);
  }
};

/* ============================================================
   MAP MANAGER
============================================================ */
const MapManager = {
  maps: {},
  markers: {},

  initMap(elId, lat = 14.2, lng = 121.1, zoom = 11) {
    if (this.maps[elId]) {
      try { this.maps[elId].remove(); } catch(e) {}
      delete this.maps[elId];
    }
    const el = document.getElementById(elId);
    if (!el || !window.L) return null;
    const map = L.map(elId, { zoomControl: true, scrollWheelZoom: true }).setView([lat, lng], zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 19
    }).addTo(map);
    this.maps[elId] = map;
    this.markers[elId] = [];
    return map;
  },

  clearMarkers(mapId) {
    (this.markers[mapId] || []).forEach(m => { try { m.remove(); } catch(e) {} });
    this.markers[mapId] = [];
  },

  addFarmMarkers(mapId, farms) {
    const map = this.maps[mapId];
    if (!map) return;
    this.clearMarkers(mapId);
    farms.forEach(farm => {
      if (!farm.lat || !farm.lng) return;
      const color = Utils.getDensityColor(farm.totalCount);
      const label = Utils.getDensityLabel(farm.totalCount);
      const icon  = L.divIcon({
        html: `<div style="background:${color};color:white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2.5px solid white;box-shadow:0 2px 10px rgba(0,0,0,.35)">${farm.totalCount}</div>`,
        iconSize:[32,32], iconAnchor:[16,16], className:''
      });
      const marker = L.marker([farm.lat, farm.lng], { icon });
      const popupHTML = `
        <div style="font-family:'DM Sans',sans-serif;min-width:210px;font-size:13px">
          <div style="font-weight:700;font-size:15px;margin-bottom:5px">${farm.name}</div>
          <div style="color:#666;margin-bottom:8px">📍 ${farm.municipality}, ${farm.province}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:9px">
            <span style="background:${color};color:white;padding:2px 8px;border-radius:100px;font-size:10px;font-weight:700">${label}</span>
            <span style="background:#eee;padding:2px 8px;border-radius:100px;font-size:10px">${farm.type}</span>
          </div>
          <div><b>Total Animals:</b> ${farm.totalCount}</div>
          ${farm.animals.pigs     ? `<div>🐷 Pigs: ${farm.animals.pigs}</div>` : ''}
          ${farm.animals.chickens ? `<div>🐔 Chickens: ${farm.animals.chickens}</div>` : ''}
          ${farm.animals.cattle   ? `<div>🐄 Cattle: ${farm.animals.cattle}</div>` : ''}
          ${farm.animals.goats    ? `<div>🐐 Goats: ${farm.animals.goats}</div>` : ''}
          <div style="margin-top:6px"><b>Status:</b> <span style="text-transform:capitalize;font-weight:600">${farm.status}</span></div>
        </div>`;
      marker.bindPopup(popupHTML, { maxWidth:260 });
      marker.addTo(map);
      this.markers[mapId].push(marker);
    });

    // Incident markers (blue)
    AppState.incidents.filter(i => i.lat && i.lng && i.status !== 'resolved').forEach(inc => {
      const icon = L.divIcon({
        html:`<div style="background:#2980B9;color:white;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:13px;border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3)">⚠</div>`,
        iconSize:[30,30], iconAnchor:[15,15], className:''
      });
      const m = L.marker([inc.lat, inc.lng], { icon });
      m.bindPopup(`<div style="font-family:'DM Sans',sans-serif"><b>🚨 Incident Alert</b><br><div style="margin-top:5px;font-size:13px">${inc.title}</div><div style="font-size:12px;color:#666;margin-top:3px">${Utils.formatDate(inc.date,'time')}</div><div style="margin-top:5px;font-size:11px;font-weight:600;text-transform:capitalize;color:#2980B9">${inc.status}</div></div>`);
      m.addTo(map);
      this.markers[mapId].push(m);
    });
  },

  addHeatmap(mapId) {
    const map = this.maps[mapId];
    if (!map) return;
    AppState.farms.forEach(farm => {
      if (!farm.lat || !farm.lng) return;
      const color = Utils.getDensityColor(farm.totalCount);
      L.circle([farm.lat, farm.lng], { color, fillColor:color, fillOpacity:0.1, radius:900, weight:0 }).addTo(map);
    });
  }
};

/* ============================================================
   SENSOR SIMULATION (Arduino IoT)
============================================================ */
let sensorInterval = null;
const SensorSim = {
  data: {},

  init(farmId) {
    this.data[farmId] = { temperature:38.5, humidity:65, feedLevel:78, waterLevel:85, ammoniaLevel:12, co2Level:380, motion:true, heartRate:72 };
    return this.data[farmId];
  },

  update(farmId) {
    if (!this.data[farmId]) this.init(farmId);
    const d = this.data[farmId];
    const fl = (v, r, mn, mx) => Math.min(mx, Math.max(mn, v + (Math.random() - 0.5) * r));
    d.temperature  = parseFloat(fl(d.temperature, 0.5, 36, 42).toFixed(1));
    d.humidity     = Math.round(fl(d.humidity, 4, 40, 95));
    d.feedLevel    = Math.max(0, parseFloat((d.feedLevel - 0.08 + Math.random() * 0.04).toFixed(1)));
    d.waterLevel   = Math.max(0, parseFloat((d.waterLevel - 0.06 + Math.random() * 0.04).toFixed(1)));
    d.ammoniaLevel = parseFloat(fl(d.ammoniaLevel, 2.5, 0, 50).toFixed(1));
    d.co2Level     = Math.round(fl(d.co2Level, 25, 300, 1000));
    d.motion       = Math.random() > 0.28;
    d.heartRate    = Math.round(fl(d.heartRate, 6, 50, 120));
    return d;
  },

  getStatus(key, value) {
    const t = {
      temperature:  { normal:[37, 39.5], warning:[35.5, 41] },
      humidity:     { normal:[50, 80],   warning:[40, 90]   },
      ammoniaLevel: { normal:[0, 20],    warning:[0, 35]    },
      co2Level:     { normal:[300, 600], warning:[300, 800] },
      heartRate:    { normal:[60, 100],  warning:[50, 110]  },
    };
    const thres = t[key];
    if (!thres) return 'normal';
    if (value < thres.warning[0] || value > thres.warning[1]) return 'critical';
    if (value < thres.normal[0]  || value > thres.normal[1])  return 'warning';
    return 'normal';
  }
};

/* ============================================================
   PAGE / PANEL NAVIGATION
============================================================ */
function showPage(id) {
  document.querySelectorAll('.app-page').forEach(p => p.style.display = 'none');
  const pg = document.getElementById('page-' + id);
  if (pg) pg.style.display = id === 'panel' ? 'flex' : 'block';
}

/* HTML `onclick="..."` only sees `window.*` — `const` globals are not on window */
(function exposeForInlineHandlers() {
  const g = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : null);
  if (!g) return;
  g.AppState = AppState;
  g.Auth = Auth;
  g.Utils = Utils;
  g.Toast = Toast;
  g.Modal = Modal;
  g.MapManager = MapManager;
  g.SensorSim = SensorSim;
})();
