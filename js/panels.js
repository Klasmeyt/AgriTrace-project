/**
 * AgriTrace+ Panel Renderer
 * Admin, DA Officer, Farmer panels
 * @version 2.0
 */

/* ============================================================
   PANEL ROUTER
============================================================ */
function renderPanel(role) {
  const user = AppState.currentUser;
  if (!user) return;
  const configs = {
    admin:   { title:'Admin Panel', items: adminNavItems() },
    officer: { title:'DA Officer Panel', items: officerNavItems() },
    farmer:  { title:'Farmer Portal', items: farmerNavItems() },
  };
  const cfg = configs[role];
  if (!cfg) return;

  // Render sidebar
  const sidebar = document.getElementById('panel-sidebar');
  if (sidebar) sidebar.innerHTML = buildSidebar(cfg, user, role);

  // Load first section
  const firstSection = cfg.items.find(i => i.type !== 'divider' && i.type !== 'label');
  if (firstSection) loadSection(firstSection.id, role);
}

function adminNavItems() {
  return [
    { id:'dashboard',      icon:'🏠', label:'Dashboard' },
    { type:'label', label:'Management' },
    { id:'live-map',       icon:'🗺️', label:'Live Map' },
    { id:'user-management',icon:'👥', label:'User Management' },
    { id:'data-management',icon:'💾', label:'Data Management' },
    { id:'activity-log',   icon:'📋', label:'Activity Log' },
    { id:'backup',         icon:'🔒', label:'Backup & Restore' },
    { type:'label', label:'Reports' },
    { id:'reports',        icon:'📊', label:'Reports & Analytics' },
    { type:'divider' },
    { id:'logout',         icon:'🚪', label:'Sign Out', action:'logout' },
  ];
}

function officerNavItems() {
  return [
    { id:'dashboard',       icon:'🏠', label:'Dashboard' },
    { type:'label', label:'Operations' },
    { id:'live-map',        icon:'🗺️', label:'Live Map' },
    { id:'registrations',   icon:'📋', label:'Farm Registrations', badge: AppState.farms.filter(f=>f.status==='pending').length || null },
    { id:'inspections',     icon:'🔍', label:'Farm Inspections' },
    { id:'incidents',       icon:'🚨', label:'Incident Management', badge: AppState.incidents.filter(i=>i.status==='open').length || null },
    { id:'public-reports',  icon:'📢', label:'Public Reports' },
    { type:'label', label:'Reports' },
    { id:'reports',         icon:'📊', label:'Reports & Analytics' },
    { type:'divider' },
    { id:'logout',          icon:'🚪', label:'Sign Out', action:'logout' },
  ];
}

function farmerNavItems() {
  const myFarms = AppState.farms.filter(f => f.owner === AppState.currentUser?.id);
  return [
    { id:'dashboard',      icon:'🏠', label:'Dashboard' },
    { type:'label', label:'My Farm' },
    { id:'my-farms',       icon:'🏡', label:'My Farms', badge: myFarms.filter(f=>f.status==='pending').length || null },
    { id:'register-farm',  icon:'➕', label:'Register Farm' },
    { id:'report-incident',icon:'🚨', label:'Report Incident' },
    { id:'health-monitor', icon:'💊', label:'Health Monitor (IoT)' },
    { type:'label', label:'Account' },
    { id:'notifications',  icon:'🔔', label:'Notifications', badge: AppState.notifications.filter(n=>!n.read).length || null },
    { type:'divider' },
    { id:'logout',         icon:'🚪', label:'Sign Out', action:'logout' },
  ];
}

function buildSidebar(cfg, user, role) {
  const roleLabels = { admin:'System Administrator', officer:'DA Officer', farmer:'Farmer' };
  const avatarHtml = user.avatar
    ? `<img src="${user.avatar}" alt="${user.name}">`
    : Utils.initials(user.name);

  const navHtml = cfg.items.map(item => {
    if (item.type === 'divider') return '<div style="height:1px;background:rgba(255,255,255,.06);margin:6px 8px"></div>';
    if (item.type === 'label')   return `<div class="nav-section-label">${item.label}</div>`;
    const badge = item.badge ? `<span class="nav-badge">${item.badge}</span>` : '';
    const onclick = item.action === 'logout'
      ? `Auth.logout()`
      : `loadSection('${item.id}','${role}')`;
    return `<div class="nav-item" id="nav-${item.id}" onclick="${onclick}"><span class="nav-icon">${item.icon}</span>${item.label}${badge}</div>`;
  }).join('');

  return `
    <div class="sidebar-header">
      <div class="sidebar-logo">
        <div class="logo-box">A</div>
        <div>
          <div class="logo-text">Agri<span>Trace</span>+</div>
          <div class="sidebar-role">${roleLabels[role] || role}</div>
        </div>
      </div>
    </div>
    <nav class="sidebar-nav">${navHtml}</nav>
    <div class="sidebar-footer">
      <div class="sidebar-user" onclick="openProfileModal()">
        <div class="user-avatar">${avatarHtml}</div>
        <div class="user-info">
          <div class="user-name">${user.name}</div>
          <div class="user-role">${roleLabels[role]}</div>
        </div>
        <span style="font-size:14px;color:rgba(250,246,238,.3)">⚙</span>
      </div>
    </div>`;
}

function loadSection(sectionId, role) {
  if (!role) role = AppState.currentPanel;
  // Update active nav
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navEl = document.getElementById('nav-' + sectionId);
  if (navEl) navEl.classList.add('active');

  // Update topbar title
  const allItems = [...adminNavItems(), ...officerNavItems(), ...farmerNavItems()];
  const item = allItems.find(i => i.id === sectionId);
  const titleEl = document.getElementById('topbar-title');
  if (titleEl && item) titleEl.textContent = item.label;

  // Clean up maps
  Object.keys(MapManager.maps).forEach(id => {
    try { MapManager.maps[id].remove(); } catch(e) {}
    delete MapManager.maps[id];
  });
  if (sensorInterval) { clearInterval(sensorInterval); sensorInterval = null; }

  // Close sidebar on mobile
  closeSidebar();

  // Render section
  const content = document.getElementById('panel-content');
  if (!content) return;
  content.innerHTML = '<div class="panel-body fade-in">' + getSectionHTML(sectionId, role) + '</div>';

  // Post-render hooks
  setTimeout(() => initSectionJS(sectionId, role), 80);
}

function getSectionHTML(id, role) {
  const renderers = {
    'dashboard':       () => renderDashboard(role),
    'live-map':        () => renderLiveMap(),
    'user-management': () => renderUserManagement(),
    'data-management': () => renderDataManagement(),
    'activity-log':    () => renderActivityLog(),
    'backup':          () => renderBackup(),
    'reports':         () => renderReports(role),
    'registrations':   () => renderRegistrations(),
    'inspections':     () => renderInspections(),
    'incidents':       () => renderIncidents(role),
    'public-reports':  () => renderPublicReports(),
    'my-farms':        () => renderMyFarms(),
    'register-farm':   () => renderRegisterFarm(),
    'report-incident': () => renderReportIncident(),
    'health-monitor':  () => renderHealthMonitor(),
    'notifications':   () => renderNotifications(),
  };
  return (renderers[id] || (() => `<div class="empty-state"><div class="empty-icon">🚧</div><h3>Coming Soon</h3></div>`))();
}

function initSectionJS(id, role) {
  if (id === 'live-map')       initLiveMap('panel-map');
  if (id === 'dashboard')      initDashboardMap(role);
  if (id === 'health-monitor') initHealthMonitor();
}

/* ============================================================
   DASHBOARD
============================================================ */
function renderDashboard(role) {
  const totalFarms     = AppState.farms.length;
  const totalAnimals   = AppState.farms.reduce((s,f) => s + (f.totalCount||0), 0);
  const openIncidents  = AppState.incidents.filter(i => i.status === 'open' || i.status === 'investigating').length;
  const pendingFarms   = AppState.farms.filter(f => f.status === 'pending').length;

  if (role === 'farmer') return renderFarmerDashboard();
  if (role === 'officer') return renderOfficerDashboard(totalFarms, totalAnimals, openIncidents, pendingFarms);
  return renderAdminDashboard(totalFarms, totalAnimals, openIncidents, pendingFarms);
}

function renderAdminDashboard(totalFarms, totalAnimals, openIncidents, pendingFarms) {
  const totalUsers = AppState.users.length;
  return `
    <div class="page-header"><div><h1>System Overview</h1><p>AgriTrace+ Administration Dashboard</p></div>
      <div class="actions"><button class="btn btn-secondary btn-sm" onclick="Utils.exportToCSV(AppState.farms,'farms_report')">⬇ Export Farms</button>
      <button class="btn btn-primary btn-sm" onclick="loadSection('live-map')">🗺 View Live Map</button></div>
    </div>
    <div class="stats-grid">
      ${statWidget('🏡','Total Farms', totalFarms, '↑ 3 this week','up','#D4EDDA')}
      ${statWidget('🐄','Total Animals', totalAnimals.toLocaleString(), '↑ 1,240 this month','up','#FFF3CD')}
      ${statWidget('🚨','Open Incidents', openIncidents, openIncidents>0?'Requires attention':'All clear', openIncidents>0?'down':'up','#F8D7DA')}
      ${statWidget('👥','System Users', totalUsers, `${pendingFarms} farms pending`, pendingFarms>0?'down':'up','#D1ECF1')}
    </div>
    <div class="grid-2 mt-4">
      <div class="card">
        <div class="card-header"><h3>🗺️ Live Farm Density Map</h3><button class="btn btn-sm btn-secondary" onclick="loadSection('live-map')">Full Map</button></div>
        <div style="height:300px;position:relative;" class="map-container">
          <div id="dash-map" style="height:100%"></div>
          ${mapLegend()}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><h3>⚠️ Recent Incidents</h3><button class="btn btn-sm btn-secondary" onclick="loadSection('incidents','admin')">View All</button></div>
        <div style="max-height:300px;overflow-y:auto">
          ${AppState.incidents.slice(0,5).map(renderIncidentRow).join('') || emptyState('No incidents recorded')}
        </div>
      </div>
    </div>
    <div class="grid-2 mt-4">
      <div class="card">
        <div class="card-header"><h3>🏡 Farm Status Overview</h3></div>
        <div class="card-body">
          ${farmStatusBar(AppState.farms)}
          <div class="mt-4">
            ${AppState.farms.slice(0,5).map(f => `
              <div class="flex items-center justify-between" style="padding:10px 0;border-bottom:1px solid var(--border-light)">
                <div><div class="font-semibold text-sm">${f.name}</div><div class="text-xs text-muted">${f.municipality}, ${f.province}</div></div>
                <div class="flex gap-2 items-center">
                  <span class="badge badge-${Utils.statusColor(f.status)}">${f.status}</span>
                  <span class="text-xs font-bold" style="color:${Utils.getDensityColor(f.totalCount)}">${f.totalCount}</span>
                </div>
              </div>`).join('')}
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><h3>📋 Recent Activity</h3></div>
        <div style="max-height:300px;overflow-y:auto;padding:8px 0">
          ${AppState.activityLog.slice(0,8).map(a => `
            <div class="flex gap-3 items-center" style="padding:9px 16px;border-bottom:1px solid var(--border-light)">
              <div style="font-size:18px">${{export:'⬇️',import:'⬆️',backup:'💾',restore:'♻️',user:'👤',approval:'✅'}[a.type]||'📌'}</div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-semibold truncate">${a.action}</div>
                <div class="text-xs text-muted">${a.user} · ${Utils.formatDate(a.timestamp,'time')}</div>
              </div>
            </div>`).join('') || '<div class="empty-state"><p>No activity yet</p></div>'}
        </div>
      </div>
    </div>`;
}

function renderOfficerDashboard(totalFarms, totalAnimals, openIncidents, pendingFarms) {
  return `
    <div class="page-header"><div><h1>Officer Dashboard</h1><p>Welcome, ${AppState.currentUser.name}</p></div>
      <button class="btn btn-primary btn-sm" onclick="loadSection('live-map')">🗺 Live Map</button>
    </div>
    <div class="stats-grid">
      ${statWidget('🏡','Total Farms', totalFarms, 'In your region','up','#D4EDDA')}
      ${statWidget('🐄','Total Animals', totalAnimals.toLocaleString(), 'Tracked livestock','up','#FFF3CD')}
      ${statWidget('⏳','Pending Review', pendingFarms, 'Farms awaiting approval', pendingFarms>0?'down':'up','#FFF3CD')}
      ${statWidget('🚨','Open Incidents', openIncidents, openIncidents>0?'Needs action':'All clear', openIncidents>0?'down':'up','#F8D7DA')}
    </div>
    <div class="grid-2 mt-4">
      <div class="card">
        <div class="card-header"><h3>📋 Pending Registrations</h3><button class="btn btn-sm btn-secondary" onclick="loadSection('registrations')">View All</button></div>
        <div>
          ${AppState.farms.filter(f=>f.status==='pending').slice(0,4).map(f => `
            <div class="flex items-center justify-between" style="padding:12px 18px;border-bottom:1px solid var(--border-light)">
              <div><div class="font-semibold text-sm">${f.name}</div><div class="text-xs text-muted">${f.ownerName} · ${f.municipality}</div></div>
              <div class="flex gap-2">
                <button class="btn btn-sm" style="background:#D4EDDA;color:#155724" onclick="approveFarm('${f.id}')">✓ Approve</button>
                <button class="btn btn-sm" style="background:#F8D7DA;color:#721C24" onclick="rejectFarm('${f.id}')">✕</button>
              </div>
            </div>`).join('') || '<div style="padding:24px;text-align:center;color:var(--text-muted)">No pending registrations</div>'}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><h3>🚨 Active Incidents</h3><button class="btn btn-sm btn-secondary" onclick="loadSection('incidents','officer')">View All</button></div>
        <div>${AppState.incidents.filter(i=>i.status!=='resolved').slice(0,5).map(renderIncidentRow).join('')||'<div style="padding:24px;text-align:center;color:var(--text-muted)">No active incidents</div>'}</div>
      </div>
    </div>`;
}

function renderFarmerDashboard() {
  const user = AppState.currentUser;
  const myFarms = AppState.farms.filter(f => f.owner === user.id);
  const totalAnimals = myFarms.reduce((s,f) => s+f.totalCount, 0);
  const myIncidents = AppState.incidents.filter(i => myFarms.some(f=>f.id===i.farmId));
  return `
    <div class="page-header"><div><h1>My Dashboard</h1><p>Welcome back, ${user.name}</p></div>
      <button class="btn btn-primary btn-sm" onclick="loadSection('register-farm')">➕ Register Farm</button>
    </div>
    <div class="stats-grid">
      ${statWidget('🏡','My Farms', myFarms.length, myFarms.filter(f=>f.status==='approved').length+' approved','up','#D4EDDA')}
      ${statWidget('🐄','My Animals', totalAnimals.toLocaleString(), 'Total livestock','up','#FFF3CD')}
      ${statWidget('✅','Approved Farms', myFarms.filter(f=>f.status==='approved').length,'','up','#D1ECF1')}
      ${statWidget('⏳','Pending Approval', myFarms.filter(f=>f.status==='pending').length,'', myFarms.filter(f=>f.status==='pending').length>0?'down':'up','#FFF3CD')}
    </div>
    <div class="grid-2 mt-4">
      <div class="card">
        <div class="card-header"><h3>🏡 My Farms</h3><button class="btn btn-sm btn-secondary" onclick="loadSection('my-farms')">Manage</button></div>
        <div>
          ${myFarms.length ? myFarms.map(f => `
            <div class="flex items-center justify-between" style="padding:12px 18px;border-bottom:1px solid var(--border-light)">
              <div><div class="font-semibold text-sm">${f.name}</div><div class="text-xs text-muted">${f.municipality} · ${f.type} · ${f.totalCount} animals</div></div>
              <span class="badge badge-${Utils.statusColor(f.status)}">${f.status}</span>
            </div>`).join('') : '<div style="padding:24px;text-align:center;color:var(--text-muted)">No farms registered yet</div>'}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><h3>🚨 My Incidents</h3><button class="btn btn-sm btn-secondary" onclick="loadSection('report-incident')">Report New</button></div>
        <div>
          ${myIncidents.length ? myIncidents.slice(0,4).map(renderIncidentRow).join('') : '<div style="padding:24px;text-align:center;color:var(--text-muted)">No incidents reported</div>'}
        </div>
      </div>
    </div>
    ${myFarms.length ? `
    <div class="card mt-4">
      <div class="card-header"><h3>💊 Quick Health Status</h3><button class="btn btn-sm btn-secondary" onclick="loadSection('health-monitor')">Full Monitor</button></div>
      <div class="card-body">
        <div class="alert alert-info">🔬 Real-time IoT sensors are active for your registered farms. Click Full Monitor for live data.</div>
        <div class="sensor-grid">
          ${['🌡️ Temp: 38.5°C','💧 Humidity: 65%','🌾 Feed: 78%','💧 Water: 85%','☣️ Ammonia: 12ppm','💨 CO₂: 380ppm'].map(s=>`<div class="sensor-card"><div style="font-size:28px;margin-bottom:8px">${s.split(' ')[0]}</div><div class="sensor-value">${s.split(': ')[1]}</div><div class="sensor-label">${s.split(' ').slice(1,2).join('').replace(':','')}</div><div class="sensor-status normal">Normal</div></div>`).join('')}
        </div>
      </div>
    </div>` : ''}`;
}

function initDashboardMap(role) {
  const el = document.getElementById('dash-map');
  if (!el || !window.L) return;
  const map = MapManager.initMap('dash-map', 14.2, 121.1, 10);
  if (map) {
    MapManager.addFarmMarkers('dash-map', AppState.farms);
    MapManager.addHeatmap('dash-map');
  }
}

/* ============================================================
   LIVE MAP
============================================================ */
function renderLiveMap() {
  return `
    <div class="page-header"><div><h1>Live Farm Map</h1><p>Real-time geo-tagged livestock density visualization</p></div>
      <div class="actions">
        <select class="form-control" id="map-filter-status" onchange="filterMapFarms()" style="width:auto;padding:6px 28px 6px 10px;font-size:13px">
          <option value="">All Farms</option><option value="approved">Approved</option><option value="pending">Pending</option><option value="rejected">Rejected</option>
        </select>
        <button class="btn btn-sm btn-secondary" onclick="MapManager.addFarmMarkers('panel-map',AppState.farms)">🔄 Refresh</button>
      </div>
    </div>
    <div class="card" style="overflow:hidden">
      <div style="height:520px;position:relative" class="map-container">
        <div id="panel-map" style="height:100%"></div>
        ${mapLegend()}
      </div>
    </div>
    <div class="grid-3 mt-4">
      <div class="card"><div class="card-body text-center">
        <div style="font-size:28px;font-weight:700;color:var(--density-low)">${AppState.farms.filter(f=>f.totalCount<=20).length}</div>
        <div class="text-sm text-muted mt-2">🟢 Low Density Farms (≤20)</div>
      </div></div>
      <div class="card"><div class="card-body text-center">
        <div style="font-size:28px;font-weight:700;color:var(--density-medium)">${AppState.farms.filter(f=>f.totalCount>20&&f.totalCount<=30).length}</div>
        <div class="text-sm text-muted mt-2">🟡 Medium Density (21–30)</div>
      </div></div>
      <div class="card"><div class="card-body text-center">
        <div style="font-size:28px;font-weight:700;color:var(--density-high)">${AppState.farms.filter(f=>f.totalCount>30).length}</div>
        <div class="text-sm text-muted mt-2">🔴 High Density Farms (>30)</div>
      </div></div>
    </div>`;
}

function initLiveMap(mapId) {
  if (!window.L) return;
  const map = MapManager.initMap(mapId, 14.2, 121.1, 10);
  if (map) {
    MapManager.addFarmMarkers(mapId, AppState.farms);
    MapManager.addHeatmap(mapId);
  }
}

function filterMapFarms() {
  const status = document.getElementById('map-filter-status')?.value;
  const farms = status ? AppState.farms.filter(f => f.status === status) : AppState.farms;
  MapManager.addFarmMarkers('panel-map', farms);
}

/* ============================================================
   USER MANAGEMENT (ADMIN)
============================================================ */
function renderUserManagement() {
  return `
    <div class="page-header"><div><h1>User Management</h1><p>Manage system users and access levels</p></div>
      <button class="btn btn-primary btn-sm" onclick="showCreateUserModal()">➕ Create User</button>
    </div>
    <div class="card">
      <div class="card-header">
        <h3>All Users (${AppState.users.length})</h3>
        <input class="form-control" id="user-search" placeholder="Search users..." oninput="filterUsers()" style="width:220px">
      </div>
      <div class="table-wrap">
        <table class="data-table" id="users-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
          <tbody id="users-tbody">${renderUsersRows(AppState.users)}</tbody>
        </table>
      </div>
    </div>
    <!-- Create User Modal -->
    <div class="modal-overlay" id="modal-create-user">
      <div class="modal">
        <div class="modal-close" onclick="closeModal('modal-create-user')">✕</div>
        <div class="modal-header"><div style="font-size:28px;margin-bottom:8px">👤</div><h2>Create New User</h2></div>
        <div class="form-group"><label class="form-label">Full Name *</label><input class="form-control" id="cu-name" placeholder="Full name"></div>
        <div class="form-group"><label class="form-label">Email *</label><input class="form-control" type="email" id="cu-email" placeholder="email@example.com"></div>
        <div class="form-group"><label class="form-label">Phone</label><input class="form-control" id="cu-phone" placeholder="+63 9XX XXX XXXX"></div>
        <div class="form-group"><label class="form-label">Role *</label>
          <select class="form-control" id="cu-role">
            <option value="farmer">🌾 Farmer</option>
            <option value="officer">🏛️ DA Officer</option>
            <option value="admin">⚙️ Admin</option>
          </select>
        </div>
        <div class="form-group"><label class="form-label">Password *</label><input class="form-control" type="password" id="cu-password" placeholder="Min 6 characters"></div>
        <div id="cu-error" class="form-error"></div>
        <button class="btn btn-primary btn-full mt-4" onclick="createUser()">Create User</button>
      </div>
    </div>`;
}

function renderUsersRows(users) {
  return users.map(u => `
    <tr>
      <td><div class="flex items-center gap-2">
        <div class="user-avatar" style="width:28px;height:28px;font-size:11px;flex-shrink:0">${u.avatar?`<img src="${u.avatar}">`:(Utils.initials(u.name))}</div>
        <span class="font-semibold">${u.name}</span>
      </div></td>
      <td>${u.email}</td>
      <td><span class="badge badge-${{admin:'danger',officer:'info',farmer:'success'}[u.role]||'neutral'}">${u.role}</span></td>
      <td><span class="badge badge-${u.status==='active'?'success':'neutral'}">${u.status}</span></td>
      <td>${Utils.formatDate(u.created)}</td>
      <td><div class="flex gap-2">
        <button class="btn btn-sm btn-secondary" onclick="toggleUserStatus('${u.id}')">${u.status==='active'?'🚫 Deactivate':'✅ Activate'}</button>
        <button class="btn btn-sm btn-danger" onclick="deleteUser('${u.id}')">🗑</button>
      </div></td>
    </tr>`).join('');
}

function filterUsers() {
  const q = document.getElementById('user-search')?.value.toLowerCase() || '';
  const filtered = AppState.users.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.includes(q));
  const tbody = document.getElementById('users-tbody');
  if (tbody) tbody.innerHTML = renderUsersRows(filtered);
}

function showCreateUserModal() {
  const m = document.getElementById('modal-create-user');
  if (m) { m.classList.add('show'); document.body.style.overflow = 'hidden'; }
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.remove('show'); document.body.style.overflow = ''; }
}

function createUser() {
  const name = document.getElementById('cu-name')?.value.trim();
  const email = document.getElementById('cu-email')?.value.trim();
  const phone = document.getElementById('cu-phone')?.value.trim();
  const role = document.getElementById('cu-role')?.value;
  const password = document.getElementById('cu-password')?.value;
  const errEl = document.getElementById('cu-error');
  if (!name || !email || !password) { errEl.textContent='Please fill required fields'; errEl.style.display='block'; return; }
  const r = Auth.register({ name, email, phone, role, password });
  if (r.success) {
    closeModal('modal-create-user');
    AppState.activityLog.unshift({ id:Utils.generateId(), user:AppState.currentUser.name, action:`Created user: ${name} (${role})`, type:'user', timestamp:new Date().toISOString() });
    AppState.save();
    loadSection('user-management');
    Toast.show(`User ${name} created successfully`, 'success');
  } else { errEl.textContent=r.error; errEl.style.display='block'; }
}

function toggleUserStatus(userId) {
  const u = AppState.users.find(x => x.id === userId);
  if (!u) return;
  u.status = u.status === 'active' ? 'inactive' : 'active';
  AppState.save();
  const tbody = document.getElementById('users-tbody');
  if (tbody) tbody.innerHTML = renderUsersRows(AppState.users);
  Toast.show(`User ${u.status === 'active' ? 'activated' : 'deactivated'}`, 'info');
}

function deleteUser(userId) {
  const u = AppState.users.find(x => x.id === userId);
  if (!u) return;
  if (!confirm(`Delete user "${u.name}"? This cannot be undone.`)) return;
  AppState.users = AppState.users.filter(x => x.id !== userId);
  AppState.save();
  loadSection('user-management');
  Toast.show('User deleted', 'info');
}

/* ============================================================
   DATA MANAGEMENT (ADMIN)
============================================================ */
function renderDataManagement() {
  return `
    <div class="page-header"><div><h1>Data Management</h1><p>Import and export livestock and farm data</p></div></div>
    <div class="grid-2">
      <div class="card">
        <div class="card-header"><h3>⬇️ Export Data</h3></div>
        <div class="card-body">
          <p class="text-sm text-muted mb-4">Export system data to CSV files for offline analysis and reporting.</p>
          <div style="display:flex;flex-direction:column;gap:10px">
            <button class="btn btn-secondary btn-full" onclick="Utils.exportToCSV(AppState.farms,'farms')">🏡 Export Farms Data</button>
            <button class="btn btn-secondary btn-full" onclick="Utils.exportToCSV(AppState.incidents,'incidents')">🚨 Export Incidents Data</button>
            <button class="btn btn-secondary btn-full" onclick="Utils.exportToCSV(AppState.users.map(u=>({...u,password:'[redacted]'})),'users')">👥 Export Users Data</button>
            <button class="btn btn-secondary btn-full" onclick="Utils.exportToCSV(AppState.activityLog,'activity_log')">📋 Export Activity Log</button>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><h3>⬆️ Import Data</h3></div>
        <div class="card-body">
          <p class="text-sm text-muted mb-4">Import farm or livestock data from CSV files. Ensure the file follows the AgriTrace+ format.</p>
          <div class="alert alert-warning mb-4">⚠️ Importing will add records but not delete existing data.</div>
          <div style="display:flex;flex-direction:column;gap:10px">
            <div>
              <label class="form-label">Import Farms CSV</label>
              <div style="display:flex;gap:8px;margin-top:6px">
                <input type="file" accept=".csv" id="import-farms-file" style="flex:1;padding:8px;border:1.5px solid var(--border);border-radius:8px;font-size:13px">
                <button class="btn btn-primary btn-sm" onclick="importFarms()">Import</button>
              </div>
            </div>
            <div>
              <label class="form-label">Import Incidents CSV</label>
              <div style="display:flex;gap:8px;margin-top:6px">
                <input type="file" accept=".csv" id="import-incidents-file" style="flex:1;padding:8px;border:1.5px solid var(--border);border-radius:8px;font-size:13px">
                <button class="btn btn-primary btn-sm" onclick="importIncidents()">Import</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="card mt-4">
      <div class="card-header"><h3>📊 Database Statistics</h3></div>
      <div class="card-body">
        <div class="grid-3">
          ${[['🏡','Farms',AppState.farms.length],['🚨','Incidents',AppState.incidents.length],['👥','Users',AppState.users.length],['📋','Activity Logs',AppState.activityLog.length],['✅','Approved Farms',AppState.farms.filter(f=>f.status==='approved').length],['⏳','Pending Farms',AppState.farms.filter(f=>f.status==='pending').length]].map(([icon,label,val])=>`
          <div style="padding:18px;background:var(--bg-secondary);border-radius:12px;text-align:center">
            <div style="font-size:26px">${icon}</div>
            <div style="font-size:22px;font-weight:700;margin:6px 0">${val}</div>
            <div class="text-xs text-muted">${label}</div>
          </div>`).join('')}
        </div>
      </div>
    </div>`;
}

function importFarms() {
  const file = document.getElementById('import-farms-file')?.files[0];
  if (!file) { Toast.show('Please select a CSV file', 'warning'); return; }
  Utils.importFromCSV(file, rows => {
    rows.forEach(r => {
      if (r.name && !AppState.farms.find(f=>f.name===r.name)) {
        AppState.farms.push({ id:Utils.generateId(), name:r.name, ownerName:r.ownerName||'Unknown', lat:parseFloat(r.lat)||14.2, lng:parseFloat(r.lng)||121.1, municipality:r.municipality||'Unknown', province:r.province||'Unknown', barangay:r.barangay||'Unknown', type:r.type||'Mixed', animals:{pigs:0,chickens:0,cattle:0,goats:0}, totalCount:parseInt(r.totalCount)||0, status:'pending', registered:new Date().toISOString(), lastInspection:null });
      }
    });
    AppState.save();
  });
}

function importIncidents() {
  const file = document.getElementById('import-incidents-file')?.files[0];
  if (!file) { Toast.show('Please select a CSV file', 'warning'); return; }
  Utils.importFromCSV(file, rows => {
    rows.forEach(r => {
      AppState.incidents.push({ id:Utils.generateId(), type:r.type||'disease', title:r.title||'Imported Incident', farmId:null, farmName:r.farmName||null, reporter:'Imported', reporterRole:'system', description:r.description||'', status:r.status||'open', priority:r.priority||'medium', date:r.date||new Date().toISOString(), assignedTo:null, lat:parseFloat(r.lat)||null, lng:parseFloat(r.lng)||null });
    });
    AppState.save();
  });
}

/* ============================================================
   ACTIVITY LOG (ADMIN)
============================================================ */
function renderActivityLog() {
  return `
    <div class="page-header"><div><h1>Activity Log</h1><p>System-wide audit trail of all actions</p></div>
      <div class="actions">
        <button class="btn btn-sm btn-secondary" onclick="Utils.exportToCSV(AppState.activityLog,'activity_log')">⬇ Export Log</button>
        <button class="btn btn-sm btn-danger" onclick="clearActivityLog()">🗑 Clear Log</button>
      </div>
    </div>
    <div class="card">
      <div class="card-header">
        <h3>All Activity (${AppState.activityLog.length} records)</h3>
        <input class="form-control" placeholder="Search logs..." oninput="filterActivityLog(this.value)" style="width:200px">
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Type</th><th>Action</th><th>User</th><th>Timestamp</th></tr></thead>
          <tbody id="activity-tbody">
            ${AppState.activityLog.map(a => `
              <tr>
                <td><span class="badge badge-${{export:'info',import:'success',backup:'neutral',restore:'warning',user:'info',approval:'success'}[a.type]||'neutral'}">${a.type}</span></td>
                <td>${a.action}</td>
                <td>${a.user}</td>
                <td>${Utils.formatDate(a.timestamp,'time')}</td>
              </tr>`).join('') || '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-muted)">No activity logged</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}

function filterActivityLog(q) {
  const filtered = AppState.activityLog.filter(a => a.action.toLowerCase().includes(q.toLowerCase()) || a.user.toLowerCase().includes(q.toLowerCase()));
  const tbody = document.getElementById('activity-tbody');
  if (tbody) tbody.innerHTML = filtered.map(a => `
    <tr>
      <td><span class="badge badge-${{export:'info',import:'success',backup:'neutral'}[a.type]||'neutral'}">${a.type}</span></td>
      <td>${a.action}</td><td>${a.user}</td><td>${Utils.formatDate(a.timestamp,'time')}</td>
    </tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">No matches</td></tr>';
}

function clearActivityLog() {
  if (!confirm('Clear all activity logs? This cannot be undone.')) return;
  AppState.activityLog = [];
  AppState.save();
  loadSection('activity-log');
  Toast.show('Activity log cleared', 'info');
}

/* ============================================================
   BACKUP & RESTORE (ADMIN)
============================================================ */
function renderBackup() {
  return `
    <div class="page-header"><div><h1>Backup & Restore</h1><p>Protect your data with regular backups</p></div></div>
    <div class="grid-2">
      <div class="card">
        <div class="card-header"><h3>💾 Create Backup</h3></div>
        <div class="card-body">
          <p class="text-sm text-muted mb-4">Download a complete backup of all AgriTrace+ data including farms, incidents, and users.</p>
          <div class="alert alert-info mb-4">ℹ️ Passwords are never included in backups for security.</div>
          <div style="background:var(--bg-secondary);border-radius:12px;padding:16px;margin-bottom:16px">
            <div class="flex justify-between text-sm mb-2"><span class="text-muted">Farms</span><strong>${AppState.farms.length} records</strong></div>
            <div class="flex justify-between text-sm mb-2"><span class="text-muted">Incidents</span><strong>${AppState.incidents.length} records</strong></div>
            <div class="flex justify-between text-sm mb-2"><span class="text-muted">Users</span><strong>${AppState.users.length} accounts</strong></div>
            <div class="flex justify-between text-sm"><span class="text-muted">Activity Logs</span><strong>${AppState.activityLog.length} entries</strong></div>
          </div>
          <button class="btn btn-primary btn-full" onclick="Utils.backupDB()">⬇️ Download Backup (.json)</button>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><h3>♻️ Restore from Backup</h3></div>
        <div class="card-body">
          <p class="text-sm text-muted mb-4">Restore data from a previously downloaded AgriTrace+ backup file.</p>
          <div class="alert alert-danger mb-4">⚠️ Restoring will overwrite current farm and incident data.</div>
          <div class="form-group">
            <label class="form-label">Select Backup File (.json)</label>
            <input type="file" accept=".json" id="restore-file" style="padding:8px;border:1.5px solid var(--border);border-radius:8px;width:100%;font-size:13px;margin-top:6px">
          </div>
          <button class="btn btn-danger btn-full mt-4" onclick="doRestore()">♻️ Restore Database</button>
        </div>
      </div>
    </div>
    <div class="card mt-4">
      <div class="card-header"><h3>📅 Backup Recommendations</h3></div>
      <div class="card-body">
        <div class="grid-3">
          ${[['Daily','Export activity logs','Keeps audit trail safe'],['Weekly','Full system backup','Protects all farm data'],['Monthly','Archive to external storage','Long-term data retention']].map(([freq,action,desc])=>`
          <div style="padding:18px;background:var(--bg-secondary);border-radius:12px">
            <div class="font-bold mb-1" style="color:var(--meadow)">${freq} Backup</div>
            <div class="text-sm font-semibold mb-1">${action}</div>
            <div class="text-xs text-muted">${desc}</div>
          </div>`).join('')}
        </div>
      </div>
    </div>`;
}

function doRestore() {
  const file = document.getElementById('restore-file')?.files[0];
  if (!file) { Toast.show('Please select a backup file', 'warning'); return; }
  if (!confirm('Are you sure you want to restore from this backup? Current farm and incident data will be overwritten.')) return;
  Utils.restoreDB(file, () => loadSection('backup'));
}

/* ============================================================
   REPORTS & ANALYTICS
============================================================ */
function renderReports(role) {
  const totalAnimals = AppState.farms.reduce((s,f) => s+f.totalCount, 0);
  const approvedFarms = AppState.farms.filter(f=>f.status==='approved').length;
  const criticalInc = AppState.incidents.filter(i=>i.priority==='critical').length;
  const resolvedInc = AppState.incidents.filter(i=>i.status==='resolved').length;

  return `
    <div class="page-header"><div><h1>Reports & Analytics</h1><p>Comprehensive livestock and farm reporting</p></div>
      <div class="actions">
        <button class="btn btn-sm btn-secondary" onclick="Utils.exportToCSV(AppState.farms,'farms_report')">⬇ Export Farms</button>
        <button class="btn btn-sm btn-secondary" onclick="Utils.exportToCSV(AppState.incidents,'incidents_report')">⬇ Export Incidents</button>
      </div>
    </div>
    <div class="stats-grid">
      ${statWidget('🏡','Total Farms',AppState.farms.length,approvedFarms+' approved','up','#D4EDDA')}
      ${statWidget('🐄','Total Animals',totalAnimals.toLocaleString(),'Across all farms','up','#FFF3CD')}
      ${statWidget('🚨','Critical Incidents',criticalInc,criticalInc>0?'Needs immediate action':'None critical',criticalInc>0?'down':'up','#F8D7DA')}
      ${statWidget('✅','Resolved Incidents',resolvedInc,'Cases closed','up','#D1ECF1')}
    </div>
    <div class="grid-2 mt-4">
      <div class="card">
        <div class="card-header"><h3>🏡 Farm Registration Summary</h3></div>
        <div class="card-body">
          ${[['Approved',AppState.farms.filter(f=>f.status==='approved').length,'#D4EDDA','#155724'],['Pending',AppState.farms.filter(f=>f.status==='pending').length,'#FFF3CD','#7D5A00'],['Rejected',AppState.farms.filter(f=>f.status==='rejected').length,'#F8D7DA','#721C24']].map(([label,count,bg,color])=>`
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
              <div style="width:10px;height:10px;border-radius:50%;background:${color}"></div>
              <span class="text-sm">${label} Farms</span>
            </div>
            <strong>${count}</strong>
          </div>
          <div class="progress-bar mb-4">
            <div class="progress-fill" style="width:${AppState.farms.length?count/AppState.farms.length*100:0}%;background:${color}"></div>
          </div>`).join('')}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><h3>🐄 Livestock by Type</h3></div>
        <div class="card-body">
          ${[['🐷','Pigs','pigs'],['🐔','Chickens','chickens'],['🐄','Cattle','cattle'],['🐐','Goats','goats']].map(([icon,label,key])=>{
            const count = AppState.farms.reduce((s,f)=>s+(f.animals[key]||0),0);
            const total = AppState.farms.reduce((s,f)=>s+f.totalCount,0)||1;
            return `
            <div class="flex items-center gap-3 mb-3">
              <span style="font-size:20px;width:24px">${icon}</span>
              <div style="flex:1"><div class="flex justify-between text-sm mb-1"><span>${label}</span><strong>${count.toLocaleString()}</strong></div>
              <div class="progress-bar"><div class="progress-fill" style="width:${count/total*100}%;background:var(--meadow)"></div></div></div>
            </div>`;}).join('')}
        </div>
      </div>
    </div>
    <div class="card mt-4">
      <div class="card-header"><h3>📋 All Farms Report</h3></div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Farm Name</th><th>Owner</th><th>Location</th><th>Type</th><th>Animals</th><th>Density</th><th>Status</th><th>Registered</th></tr></thead>
          <tbody>
            ${AppState.farms.map(f=>`
              <tr>
                <td class="font-semibold">${f.name}</td>
                <td>${f.ownerName}</td>
                <td>${f.municipality}, ${f.province}</td>
                <td>${f.type}</td>
                <td>${f.totalCount.toLocaleString()}</td>
                <td><span class="badge" style="background:${Utils.getDensityColor(f.totalCount)}22;color:${Utils.getDensityColor(f.totalCount)}">${Utils.getDensityLabel(f.totalCount)}</span></td>
                <td><span class="badge badge-${Utils.statusColor(f.status)}">${f.status}</span></td>
                <td>${Utils.formatDate(f.registered)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

/* ============================================================
   FARM REGISTRATIONS (OFFICER)
============================================================ */
function renderRegistrations() {
  const pending  = AppState.farms.filter(f=>f.status==='pending');
  const approved = AppState.farms.filter(f=>f.status==='approved');
  const rejected = AppState.farms.filter(f=>f.status==='rejected');
  let activeTab = 'pending';

  return `
    <div class="page-header"><div><h1>Farm Registrations</h1><p>Review and approve farmer registration requests</p></div>
      <button class="btn btn-sm btn-secondary" onclick="Utils.exportToCSV(AppState.farms,'registrations')">⬇ Export</button>
    </div>
    <div class="tabs">
      <div class="tab active" id="reg-tab-pending" onclick="switchRegTab('pending')">⏳ Pending (${pending.length})</div>
      <div class="tab" id="reg-tab-approved" onclick="switchRegTab('approved')">✅ Approved (${approved.length})</div>
      <div class="tab" id="reg-tab-rejected" onclick="switchRegTab('rejected')">❌ Rejected (${rejected.length})</div>
    </div>
    <div id="reg-content">
      ${renderRegList(pending)}
    </div>`;
}

function switchRegTab(tab) {
  document.querySelectorAll('.tab[id^="reg-tab"]').forEach(t => t.classList.remove('active'));
  const el = document.getElementById('reg-tab-' + tab);
  if (el) el.classList.add('active');
  const farms = AppState.farms.filter(f=>f.status===tab);
  const content = document.getElementById('reg-content');
  if (content) content.innerHTML = renderRegList(farms);
}

function renderRegList(farms) {
  if (!farms.length) return '<div class="empty-state"><div class="empty-icon">📋</div><h3>No farms here</h3><p>No registrations in this category.</p></div>';
  return farms.map(f => `
    <div class="card mb-4">
      <div class="card-body">
        <div class="flex justify-between items-center flex-wrap gap-3">
          <div>
            <div style="font-size:16px;font-weight:700;margin-bottom:4px">${f.name}</div>
            <div class="text-sm text-muted">👤 ${f.ownerName} · 📍 ${f.barangay}, ${f.municipality}, ${f.province}</div>
            <div class="text-sm text-muted mt-1">🐾 ${f.type} · 🐄 ${f.totalCount} animals · 📅 Registered ${Utils.formatDate(f.registered)}</div>
          </div>
          <div class="flex gap-2">
            ${f.status === 'pending' ? `
              <button class="btn btn-sm" style="background:#D4EDDA;color:#155724" onclick="approveFarm('${f.id}')">✓ Approve</button>
              <button class="btn btn-sm btn-danger" onclick="rejectFarm('${f.id}')">✕ Reject</button>` : ''}
            <button class="btn btn-sm btn-secondary" onclick="viewFarmDetails('${f.id}')">👁 View Details</button>
          </div>
        </div>
        <div class="grid-3 mt-3">
          ${[['🐷','Pigs',f.animals.pigs],['🐔','Chickens',f.animals.chickens],['🐄','Cattle',f.animals.cattle],['🐐','Goats',f.animals.goats]].filter(([,,v])=>v>0).map(([icon,label,val])=>`
          <div style="background:var(--bg-secondary);border-radius:8px;padding:10px;text-align:center">
            <div style="font-size:20px">${icon}</div>
            <div class="font-bold mt-1">${val}</div>
            <div class="text-xs text-muted">${label}</div>
          </div>`).join('')}
        </div>
      </div>
    </div>`).join('');
}

function approveFarm(farmId) {
  const f = AppState.farms.find(x=>x.id===farmId);
  if (!f) return;
  f.status = 'approved';
  f.lastInspection = new Date().toISOString();
  AppState.activityLog.unshift({ id:Utils.generateId(), user:AppState.currentUser.name, action:`Approved farm: ${f.name}`, type:'approval', timestamp:new Date().toISOString() });
  AppState.notifications.unshift({ id:Utils.generateId(), title:'Farm Approved', message:`${f.name} has been approved`, type:'success', read:false, time:'just now', icon:'✅' });
  AppState.save();
  loadSection('registrations');
  Toast.show(`${f.name} approved successfully`, 'success');
}

function rejectFarm(farmId) {
  const f = AppState.farms.find(x=>x.id===farmId);
  if (!f) return;
  const reason = prompt('Reason for rejection (optional):') || 'Does not meet requirements';
  f.status = 'rejected';
  AppState.activityLog.unshift({ id:Utils.generateId(), user:AppState.currentUser.name, action:`Rejected farm: ${f.name}. Reason: ${reason}`, type:'rejection', timestamp:new Date().toISOString() });
  AppState.save();
  loadSection('registrations');
  Toast.show(`Farm rejected`, 'info');
}

function viewFarmDetails(farmId) {
  const f = AppState.farms.find(x=>x.id===farmId);
  if (!f) return;
  alert(`Farm Details\n\nName: ${f.name}\nOwner: ${f.ownerName}\nLocation: ${f.barangay}, ${f.municipality}, ${f.province}\nType: ${f.type}\nTotal Animals: ${f.totalCount}\nStatus: ${f.status}\nRegistered: ${Utils.formatDate(f.registered)}\nLast Inspection: ${Utils.formatDate(f.lastInspection)||'N/A'}`);
}

/* ============================================================
   FARM INSPECTIONS (OFFICER)
============================================================ */
function renderInspections() {
  const approvedFarms = AppState.farms.filter(f=>f.status==='approved');
  return `
    <div class="page-header"><div><h1>Farm Inspections</h1><p>Verify and manage farm inspection records</p></div>
      <button class="btn btn-sm btn-secondary" onclick="Utils.exportToCSV(AppState.farms.filter(f=>f.status==='approved'),'inspections')">⬇ Export</button>
    </div>
    <div class="card">
      <div class="card-header"><h3>Farms for Inspection (${approvedFarms.length})</h3></div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Farm</th><th>Owner</th><th>Location</th><th>Animals</th><th>Last Inspection</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            ${approvedFarms.map(f => {
              const lastInsp = f.lastInspection ? Utils.formatDate(f.lastInspection) : '—';
              const needsInsp = !f.lastInspection || (Date.now() - new Date(f.lastInspection)) > 90*24*3600*1000;
              return `
              <tr>
                <td class="font-semibold">${f.name}</td>
                <td>${f.ownerName}</td>
                <td>${f.municipality}, ${f.province}</td>
                <td>${f.totalCount}</td>
                <td>${lastInsp}</td>
                <td><span class="badge badge-${needsInsp?'danger':'success'}">${needsInsp?'Needs Inspection':'Up to Date'}</span></td>
                <td><button class="btn btn-sm btn-primary" onclick="recordInspection('${f.id}')">✅ Mark Inspected</button></td>
              </tr>`;}).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function recordInspection(farmId) {
  const f = AppState.farms.find(x=>x.id===farmId);
  if (!f) return;
  f.lastInspection = new Date().toISOString();
  AppState.activityLog.unshift({ id:Utils.generateId(), user:AppState.currentUser.name, action:`Completed inspection: ${f.name}`, type:'approval', timestamp:new Date().toISOString() });
  AppState.save();
  loadSection('inspections');
  Toast.show(`Inspection recorded for ${f.name}`, 'success');
}

/* ============================================================
   INCIDENT MANAGEMENT
============================================================ */
function renderIncidents(role) {
  const userFilter = role === 'farmer' ? AppState.incidents.filter(i => AppState.farms.some(f=>f.id===i.farmId&&f.owner===AppState.currentUser.id)) : AppState.incidents;
  const open = userFilter.filter(i=>i.status==='open');
  const investigating = userFilter.filter(i=>i.status==='investigating');
  const resolved = userFilter.filter(i=>i.status==='resolved');

  return `
    <div class="page-header"><div><h1>Incident Management</h1><p>Track and respond to biosecurity incidents</p></div>
      <div class="actions">
        <button class="btn btn-sm btn-secondary" onclick="Utils.exportToCSV(AppState.incidents,'incidents')">⬇ Export</button>
        ${role==='farmer'?`<button class="btn btn-sm btn-danger" onclick="loadSection('report-incident')">🚨 Report New</button>`:''}
      </div>
    </div>
    <div class="stats-grid mb-4" style="grid-template-columns:repeat(3,1fr)">
      ${statWidget('🔴','Open',open.length,'Requires action','down','#F8D7DA')}
      ${statWidget('🟡','Investigating',investigating.length,'In progress','','#FFF3CD')}
      ${statWidget('🟢','Resolved',resolved.length,'Closed cases','up','#D4EDDA')}
    </div>
    <div id="incidents-list">
      ${userFilter.length ? userFilter.map(inc => `
        <div class="card mb-3">
          <div class="card-body">
            <div class="flex justify-between items-start gap-3 flex-wrap">
              <div style="flex:1;min-width:200px">
                <div class="flex items-center gap-2 mb-1">
                  <span class="badge badge-${Utils.statusColor(inc.priority)}">${inc.priority}</span>
                  <span class="badge badge-${Utils.statusColor(inc.status)}">${inc.status}</span>
                  <span class="badge badge-neutral">${inc.type}</span>
                </div>
                <div style="font-size:16px;font-weight:700;margin:6px 0">${inc.title}</div>
                <div class="text-sm text-muted">${inc.farmName||'Public Report'} · Reported by ${inc.reporter} · ${Utils.formatDate(inc.date,'time')}</div>
                <div class="text-sm mt-2" style="color:var(--text-secondary)">${inc.description.substring(0,120)}${inc.description.length>120?'...':''}</div>
              </div>
              <div class="flex flex-col gap-2" style="flex-shrink:0">
                ${inc.status !== 'resolved' && role !== 'farmer' ? `
                  <button class="btn btn-sm btn-primary" onclick="updateIncident('${inc.id}','investigating')">🔍 Investigate</button>
                  <button class="btn btn-sm btn-secondary" onclick="updateIncident('${inc.id}','resolved')">✅ Resolve</button>
                ` : ''}
                ${inc.status !== 'resolved' && role === 'farmer' ? '<div class="text-xs text-muted">Awaiting DA response</div>' : ''}
                ${inc.status === 'resolved' ? '<span class="badge badge-success">✅ Resolved</span>' : ''}
              </div>
            </div>
          </div>
        </div>`).join('') : '<div class="empty-state"><div class="empty-icon">✅</div><h3>No Incidents</h3><p>No incidents recorded in this system.</p></div>'}
    </div>`;
}

function updateIncident(incId, newStatus) {
  const inc = AppState.incidents.find(x=>x.id===incId);
  if (!inc) return;
  inc.status = newStatus;
  if (newStatus === 'investigating') inc.assignedTo = AppState.currentUser.name;
  AppState.activityLog.unshift({ id:Utils.generateId(), user:AppState.currentUser.name, action:`Updated incident "${inc.title}" to ${newStatus}`, type:'approval', timestamp:new Date().toISOString() });
  AppState.save();
  loadSection('incidents', AppState.currentPanel);
  Toast.show(`Incident marked as ${newStatus}`, 'success');
}

/* ============================================================
   PUBLIC REPORTS (OFFICER)
============================================================ */
function renderPublicReports() {
  const pubReports = AppState.incidents.filter(i=>i.reporterRole==='public');
  return `
    <div class="page-header"><div><h1>Public Reports</h1><p>Community-submitted biosecurity concerns</p></div>
      <button class="btn btn-sm btn-secondary" onclick="Utils.exportToCSV(pubReports,'public_reports')">⬇ Export</button>
    </div>
    <div class="alert alert-warning mb-4">⚠️ ${pubReports.filter(r=>r.status==='open').length} unresolved public reports require review.</div>
    ${pubReports.length ? pubReports.map(r => `
      <div class="card mb-3">
        <div class="card-body">
          <div class="flex justify-between items-start gap-3">
            <div>
              <div class="flex gap-2 mb-2">
                <span class="badge badge-danger">Public Report</span>
                <span class="badge badge-${Utils.statusColor(r.status)}">${r.status}</span>
                <span class="badge badge-${Utils.statusColor(r.priority)}">${r.priority}</span>
              </div>
              <div style="font-size:15px;font-weight:700;margin-bottom:4px">${r.title}</div>
              <div class="text-sm text-muted mb-2">Reported by: ${r.reporter} · ${Utils.formatDate(r.date,'time')}</div>
              <div class="text-sm">${r.description}</div>
            </div>
            <div class="flex flex-col gap-2" style="flex-shrink:0">
              ${r.status!=='resolved'?`<button class="btn btn-sm btn-primary" onclick="updateIncident('${r.id}','investigating')">🔍 Investigate</button>
              <button class="btn btn-sm btn-secondary" onclick="updateIncident('${r.id}','resolved')">✅ Resolve</button>`:'<span class="badge badge-success">✅ Resolved</span>'}
            </div>
          </div>
        </div>
      </div>`).join('') : '<div class="empty-state"><div class="empty-icon">📢</div><h3>No Public Reports</h3><p>No public reports received yet.</p></div>'}`;
}

/* ============================================================
   MY FARMS (FARMER)
============================================================ */
function renderMyFarms() {
  const user = AppState.currentUser;
  const myFarms = AppState.farms.filter(f=>f.owner===user.id);
  return `
    <div class="page-header"><div><h1>My Farms</h1><p>Manage your registered livestock farms</p></div>
      <button class="btn btn-primary btn-sm" onclick="loadSection('register-farm')">➕ Register New Farm</button>
    </div>
    ${myFarms.length ? myFarms.map(f => `
      <div class="card mb-4">
        <div class="card-body">
          <div class="flex justify-between items-start gap-3 flex-wrap">
            <div>
              <div class="flex gap-2 mb-2">
                <span class="badge badge-${Utils.statusColor(f.status)}">${f.status}</span>
                <span class="badge" style="background:${Utils.getDensityColor(f.totalCount)}22;color:${Utils.getDensityColor(f.totalCount)}">${Utils.getDensityLabel(f.totalCount)}</span>
              </div>
              <div style="font-size:18px;font-weight:700;margin-bottom:4px">${f.name}</div>
              <div class="text-sm text-muted">📍 ${f.barangay}, ${f.municipality}, ${f.province}</div>
              <div class="text-sm text-muted mt-1">🐾 ${f.type} · 📅 Registered: ${Utils.formatDate(f.registered)}</div>
            </div>
            <button class="btn btn-sm btn-secondary" onclick="loadSection('report-incident')">🚨 Report Incident</button>
          </div>
          <div class="grid-3 mt-4">
            ${[['🐷','Pigs',f.animals.pigs],['🐔','Chickens',f.animals.chickens],['🐄','Cattle',f.animals.cattle],['🐐','Goats',f.animals.goats]].map(([icon,label,val])=>`
            <div style="background:var(--bg-secondary);border-radius:10px;padding:14px;text-align:center">
              <div style="font-size:26px">${icon}</div>
              <div style="font-size:22px;font-weight:700;margin:4px 0">${val}</div>
              <div class="text-xs text-muted">${label}</div>
            </div>`).join('')}
          </div>
          ${f.status === 'pending' ? '<div class="alert alert-warning mt-3">⏳ Your farm registration is under review by a DA Officer.</div>' : ''}
          ${f.status === 'rejected' ? '<div class="alert alert-danger mt-3">❌ Registration was rejected. Please contact your regional DA Office for details.</div>' : ''}
        </div>
      </div>`).join('') : `
      <div class="empty-state">
        <div class="empty-icon">🏡</div>
        <h3>No Farms Registered</h3>
        <p>You haven't registered any farms yet. Start by registering your first livestock farm.</p>
        <button class="btn btn-primary" onclick="loadSection('register-farm')">➕ Register Your First Farm</button>
      </div>`}`;
}

/* ============================================================
   REGISTER FARM (FARMER)
============================================================ */
function renderRegisterFarm() {
  return `
    <div class="page-header"><div><h1>Register New Farm</h1><p>Submit your livestock farm for DA registration</p></div></div>
    <div class="card">
      <div class="card-body">
        <div class="alert alert-info mb-6">ℹ️ After submission, a DA Officer will review and verify your farm. You'll be notified once approved.</div>
        <h3 style="font-size:16px;margin-bottom:20px">Farm Information</h3>
        <div class="grid-2">
          <div class="form-group"><label class="form-label">Farm Name *</label><input class="form-control" id="rf-name" placeholder="e.g. Dela Cruz Livestock Farm"></div>
          <div class="form-group"><label class="form-label">Farm Type *</label>
            <select class="form-control" id="rf-type">
              <option value="Hog/Poultry">🐷🐔 Hog / Poultry</option>
              <option value="Cattle">🐄 Cattle Ranch</option>
              <option value="Poultry">🐔 Poultry Farm</option>
              <option value="Goat/Sheep">🐐 Goat / Sheep Farm</option>
              <option value="Mixed">🌾 Mixed Livestock</option>
            </select>
          </div>
        </div>
        <h3 style="font-size:16px;margin:20px 0 16px">Location</h3>
        <div class="grid-3">
          <div class="form-group"><label class="form-label">Barangay *</label><input class="form-control" id="rf-barangay" placeholder="Barangay name"></div>
          <div class="form-group"><label class="form-label">Municipality/City *</label><input class="form-control" id="rf-municipality" placeholder="Municipality"></div>
          <div class="form-group"><label class="form-label">Province *</label><input class="form-control" id="rf-province" placeholder="Province"></div>
        </div>
        <div class="grid-2">
          <div class="form-group"><label class="form-label">Latitude (GPS)</label><input class="form-control" id="rf-lat" placeholder="e.g. 14.2145" type="number" step="0.0001">
            <div class="form-hint">Auto-filled from camera photo metadata or device GPS</div>
          </div>
          <div class="form-group"><label class="form-label">Longitude (GPS)</label><input class="form-control" id="rf-lng" placeholder="e.g. 121.1678" type="number" step="0.0001"></div>
        </div>
        <h3 style="font-size:16px;margin:20px 0 16px">Location Capture</h3>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">📷 Farm Photo (for geo-tagging)</label>
            <input class="form-control" id="rf-photo" type="file" accept="image/*" capture="environment" onchange="handleFarmPhotoCapture(event)">
            <div class="form-hint">Use mobile camera or upload a photo with GPS metadata (EXIF)</div>
          </div>
          <div class="form-group">
            <label class="form-label">Use Current Device Location</label>
            <button class="btn btn-secondary btn-full" type="button" onclick="useCurrentDeviceLocation()">📍 Get Current GPS</button>
            <div class="form-hint">Requests browser location permission</div>
          </div>
        </div>
        <div id="rf-location-meta" class="alert alert-info mb-4" style="display:none"></div>
        <input type="hidden" id="rf-captured-at">
        <input type="hidden" id="rf-location-source">
        <h3 style="font-size:16px;margin:20px 0 16px">Animal Inventory</h3>
        <div class="grid-3">
          <div class="form-group"><label class="form-label">🐷 Pigs</label><input class="form-control" id="rf-pigs" type="number" min="0" value="0" onchange="updateTotalCount()"></div>
          <div class="form-group"><label class="form-label">🐔 Chickens</label><input class="form-control" id="rf-chickens" type="number" min="0" value="0" onchange="updateTotalCount()"></div>
          <div class="form-group"><label class="form-label">🐄 Cattle</label><input class="form-control" id="rf-cattle" type="number" min="0" value="0" onchange="updateTotalCount()"></div>
          <div class="form-group"><label class="form-label">🐐 Goats</label><input class="form-control" id="rf-goats" type="number" min="0" value="0" onchange="updateTotalCount()"></div>
          <div class="form-group"><label class="form-label">🐑 Sheep</label><input class="form-control" id="rf-sheep" type="number" min="0" value="0" onchange="updateTotalCount()"></div>
          <div class="form-group"><label class="form-label">📊 Total Animals</label>
            <div class="form-control" id="rf-total" style="background:var(--bg-secondary);font-weight:700;cursor:default">0</div>
          </div>
        </div>
        <div id="rf-error" class="form-error"></div>
        <div class="flex gap-3 mt-4">
          <button class="btn btn-primary" onclick="submitFarmRegistration()">📋 Submit for Review</button>
          <button class="btn btn-secondary" onclick="loadSection('my-farms')">Cancel</button>
        </div>
      </div>
    </div>`;
}

function updateTotalCount() {
  const total = ['rf-pigs','rf-chickens','rf-cattle','rf-goats','rf-sheep'].reduce((s,id)=>s+parseInt(document.getElementById(id)?.value||0),0);
  const el = document.getElementById('rf-total');
  if (el) el.textContent = total.toLocaleString();
}

function showFarmLocationMeta(message, level = 'info') {
  const el = document.getElementById('rf-location-meta');
  if (!el) return;
  el.className = `alert alert-${level} mb-4`;
  el.textContent = message;
  el.style.display = 'block';
}

function setFarmCoordinates(lat, lng, sourceLabel) {
  const latEl = document.getElementById('rf-lat');
  const lngEl = document.getElementById('rf-lng');
  const srcEl = document.getElementById('rf-location-source');
  if (latEl) latEl.value = Number(lat).toFixed(6);
  if (lngEl) lngEl.value = Number(lng).toFixed(6);
  if (srcEl) srcEl.value = sourceLabel;
}

function setFarmCaptureTimestamp(dateLike) {
  if (!dateLike) return;
  const tsEl = document.getElementById('rf-captured-at');
  if (!tsEl) return;
  const d = new Date(dateLike);
  if (!isNaN(d)) tsEl.value = d.toISOString();
}

async function handleFarmPhotoCapture(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;

  if (!window.exifr || typeof window.exifr.parse !== 'function') {
    showFarmLocationMeta('Photo parser not available. Use "Get Current GPS" or enter coordinates manually.', 'warning');
    return;
  }

  try {
    const meta = await window.exifr.parse(file, { gps: true, exif: true, tiff: true });
    const lat = meta?.latitude;
    const lng = meta?.longitude;
    const ts = meta?.DateTimeOriginal || meta?.CreateDate || null;

    if (typeof lat === 'number' && typeof lng === 'number') {
      setFarmCoordinates(lat, lng, 'photo-exif');
      setFarmCaptureTimestamp(ts || new Date());
      showFarmLocationMeta(`Location auto-filled from photo metadata (${lat.toFixed(5)}, ${lng.toFixed(5)}).`, 'success');
      return;
    }

    showFarmLocationMeta('No GPS metadata found in photo. Trying current device location...', 'warning');
    useCurrentDeviceLocation(true);
  } catch (err) {
    showFarmLocationMeta('Could not read photo metadata. Trying current device location...', 'warning');
    useCurrentDeviceLocation(true);
  }
}

function useCurrentDeviceLocation(isFallback = false) {
  if (!navigator.geolocation) {
    showFarmLocationMeta('Geolocation is not supported by this browser. Enter coordinates manually.', 'danger');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setFarmCoordinates(lat, lng, 'device-gps');
      setFarmCaptureTimestamp(new Date());
      const prefix = isFallback ? 'Photo metadata has no GPS. ' : '';
      showFarmLocationMeta(`${prefix}Location auto-filled from current device GPS (${lat.toFixed(5)}, ${lng.toFixed(5)}).`, 'success');
    },
    () => {
      showFarmLocationMeta('Unable to get device location. Please allow permission or enter coordinates manually.', 'danger');
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
  );
}

function submitFarmRegistration() {
  const name         = document.getElementById('rf-name')?.value.trim();
  const type         = document.getElementById('rf-type')?.value;
  const barangay     = document.getElementById('rf-barangay')?.value.trim();
  const municipality = document.getElementById('rf-municipality')?.value.trim();
  const province     = document.getElementById('rf-province')?.value.trim();
  const lat          = parseFloat(document.getElementById('rf-lat')?.value);
  const lng          = parseFloat(document.getElementById('rf-lng')?.value);
  const capturedAt   = document.getElementById('rf-captured-at')?.value || null;
  const locationSource = document.getElementById('rf-location-source')?.value || 'manual';
  const pigs         = parseInt(document.getElementById('rf-pigs')?.value)||0;
  const chickens     = parseInt(document.getElementById('rf-chickens')?.value)||0;
  const cattle       = parseInt(document.getElementById('rf-cattle')?.value)||0;
  const goats        = parseInt(document.getElementById('rf-goats')?.value)||0;
  const errEl        = document.getElementById('rf-error');
  if (!name || !barangay || !municipality || !province) {
    errEl.textContent = 'Please fill all required fields'; errEl.style.display = 'block'; return;
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    errEl.textContent = 'Please provide valid GPS coordinates (camera metadata, current location, or manual entry).';
    errEl.style.display = 'block';
    return;
  }
  const total = pigs + chickens + cattle + goats;
  const farm = {
    id: Utils.generateId(), name, owner: AppState.currentUser.id, ownerName: AppState.currentUser.name,
    lat, lng, municipality, province, barangay, type, animals:{pigs,chickens,cattle,goats},
    totalCount: total, status:'pending', registered: new Date().toISOString(), lastInspection: null,
    capturedAt, locationSource
  };
  AppState.farms.push(farm);
  AppState.notifications.unshift({ id:Utils.generateId(), title:'Farm Submitted', message:`${name} registration submitted for DA review`, type:'info', read:false, time:'just now', icon:'🏡' });
  AppState.activityLog.unshift({ id:Utils.generateId(), user:AppState.currentUser.name, action:`Submitted farm registration: ${name}`, type:'registration', timestamp:new Date().toISOString() });
  AppState.save();
  Toast.show(`Farm "${name}" submitted for review! A DA Officer will review it soon.`, 'success');
  loadSection('my-farms');
}

/* ============================================================
   REPORT INCIDENT (FARMER)
============================================================ */
function renderReportIncident() {
  const myFarms = AppState.farms.filter(f=>f.owner===AppState.currentUser.id&&f.status==='approved');
  return `
    <div class="page-header"><div><h1>Report Incident</h1><p>Report disease outbreaks or biosecurity concerns</p></div></div>
    <div class="card">
      <div class="card-body">
        <div class="alert alert-danger mb-6">🚨 For emergencies, call the DA hotline: (02) 8920-4062</div>
        <div class="form-group">
          <label class="form-label">Related Farm *</label>
          <select class="form-control" id="ri-farm">
            <option value="">Select farm (or leave blank if off-farm)</option>
            ${myFarms.map(f=>`<option value="${f.id}">${f.name}</option>`).join('')}
          </select>
        </div>
        <div class="grid-2">
          <div class="form-group"><label class="form-label">Incident Type *</label>
            <select class="form-control" id="ri-type">
              <option value="disease">🦠 Disease / Illness</option>
              <option value="death">💀 Unexplained Deaths</option>
              <option value="biosecurity">🛡️ Biosecurity Breach</option>
              <option value="other">📋 Other Concern</option>
            </select>
          </div>
          <div class="form-group"><label class="form-label">Priority *</label>
            <select class="form-control" id="ri-priority">
              <option value="critical">🔴 Critical — Immediate action needed</option>
              <option value="high">🟠 High</option>
              <option value="medium" selected>🟡 Medium</option>
              <option value="low">🟢 Low</option>
            </select>
          </div>
        </div>
        <div class="form-group"><label class="form-label">Incident Title *</label><input class="form-control" id="ri-title" placeholder="Brief summary of the incident"></div>
        <div class="form-group"><label class="form-label">Detailed Description *</label><textarea class="form-control" id="ri-desc" rows="5" placeholder="Describe the symptoms, number of affected animals, timeline, and any other relevant details..."></textarea></div>
        <div id="ri-error" class="form-error"></div>
        <div class="flex gap-3 mt-4">
          <button class="btn btn-danger" onclick="submitIncidentReport()">🚨 Submit Report</button>
          <button class="btn btn-secondary" onclick="loadSection('dashboard')">Cancel</button>
        </div>
      </div>
    </div>`;
}

function submitIncidentReport() {
  const farmId   = document.getElementById('ri-farm')?.value;
  const type     = document.getElementById('ri-type')?.value;
  const priority = document.getElementById('ri-priority')?.value;
  const title    = document.getElementById('ri-title')?.value.trim();
  const desc     = document.getElementById('ri-desc')?.value.trim();
  const errEl    = document.getElementById('ri-error');
  if (!title || !desc) { errEl.textContent = 'Please fill in title and description'; errEl.style.display='block'; return; }
  const farm = farmId ? AppState.farms.find(f=>f.id===farmId) : null;
  const inc = {
    id: Utils.generateId(), type, title, farmId: farm?.id||null, farmName: farm?.name||null,
    reporter: AppState.currentUser.name, reporterRole: 'farmer',
    description: desc, status: 'open', priority,
    date: new Date().toISOString(), assignedTo: null,
    lat: farm?.lat||null, lng: farm?.lng||null
  };
  AppState.incidents.push(inc);
  AppState.notifications.unshift({ id:Utils.generateId(), title:'Incident Reported', message:`"${title}" submitted to DA Officers`, type:'alert', read:false, time:'just now', icon:'🚨' });
  AppState.activityLog.unshift({ id:Utils.generateId(), user:AppState.currentUser.name, action:`Reported incident: ${title}`, type:'incident', timestamp:new Date().toISOString() });
  AppState.save();
  Toast.show('Incident reported! DA Officers have been notified.', 'success');
  loadSection('incidents', 'farmer');
}

/* ============================================================
   HEALTH MONITOR (FARMER / ARDUINO IoT)
============================================================ */
function renderHealthMonitor() {
  const myFarms = AppState.farms.filter(f=>f.owner===AppState.currentUser.id&&f.status==='approved');
  const activeFarm = myFarms[0];
  return `
    <div class="page-header"><div><h1>💊 Health Monitor (IoT)</h1><p>Real-time Arduino sensor data for your livestock</p></div>
      <div class="flex items-center gap-2"><div style="width:9px;height:9px;border-radius:50%;background:#4A7C59;animation:pulse 1.5s infinite"></div><span class="text-sm" style="color:var(--meadow)">Live</span></div>
    </div>
    ${!activeFarm ? `<div class="empty-state"><div class="empty-icon">💊</div><h3>No Approved Farms</h3><p>Get a farm approved to access IoT health monitoring.</p></div>` : `
    <div class="alert alert-info mb-4">🔬 Simulating Arduino sensor data for <strong>${activeFarm.name}</strong>. Data refreshes every 3 seconds.</div>
    <div class="sensor-grid" id="sensor-grid">
      ${buildSensorCards(SensorSim.init(activeFarm.id))}
    </div>
    <div class="card mt-4">
      <div class="card-header"><h3>📈 Sensor History (Last 10 readings)</h3></div>
      <div class="card-body">
        <div id="sensor-log" style="font-family:'DM Mono',monospace;font-size:12px;max-height:200px;overflow-y:auto;color:var(--text-secondary)">
          <div style="color:var(--text-muted)">[${new Date().toLocaleTimeString()}] System: IoT connection established for ${activeFarm.name}</div>
        </div>
      </div>
    </div>
    <style>@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}</style>`}`;
}

function buildSensorCards(data) {
  const sensors = [
    { key:'temperature',  icon:'🌡️', label:'Temperature', unit:'°C',   min:37,  max:39.5 },
    { key:'humidity',     icon:'💧', label:'Humidity',    unit:'%',    min:50,  max:80   },
    { key:'feedLevel',    icon:'🌾', label:'Feed Level',  unit:'%',    min:30,  max:100  },
    { key:'waterLevel',   icon:'💧', label:'Water Level', unit:'%',    min:30,  max:100  },
    { key:'ammoniaLevel', icon:'☣️', label:'Ammonia',     unit:'ppm',  min:0,   max:20   },
    { key:'co2Level',     icon:'💨', label:'CO₂',         unit:'ppm',  min:300, max:600  },
    { key:'heartRate',    icon:'❤️', label:'Heart Rate',  unit:'bpm',  min:60,  max:100  },
    { key:'motion',       icon:'🏃', label:'Motion',      unit:'',     min:null,max:null  },
  ];
  return sensors.map(s => {
    const val  = s.key === 'motion' ? (data[s.key] ? 'Active' : 'Still') : data[s.key];
    const stat = s.key === 'motion' ? 'normal' : SensorSim.getStatus(s.key, data[s.key]);
    return `
      <div class="sensor-card" id="sensor-${s.key}">
        <div class="sensor-icon">${s.icon}</div>
        <div class="sensor-value" id="sv-${s.key}">${val}${s.unit}</div>
        <div class="sensor-label">${s.label}</div>
        <div class="sensor-status ${stat}" id="ss-${s.key}">${stat}</div>
      </div>`;
  }).join('');
}

function initHealthMonitor() {
  const myFarms = AppState.farms.filter(f=>f.owner===AppState.currentUser?.id&&f.status==='approved');
  if (!myFarms.length) return;
  const farm = myFarms[0];
  SensorSim.init(farm.id);
  if (sensorInterval) clearInterval(sensorInterval);
  sensorInterval = setInterval(() => {
    const data = SensorSim.update(farm.id);
    const keys = ['temperature','humidity','feedLevel','waterLevel','ammoniaLevel','co2Level','heartRate'];
    const units = {temperature:'°C',humidity:'%',feedLevel:'%',waterLevel:'%',ammoniaLevel:'ppm',co2Level:'ppm',heartRate:'bpm'};
    keys.forEach(k => {
      const valEl  = document.getElementById('sv-' + k);
      const statEl = document.getElementById('ss-' + k);
      if (valEl) valEl.textContent = data[k] + (units[k]||'');
      if (statEl) {
        const status = SensorSim.getStatus(k, data[k]);
        statEl.textContent = status;
        statEl.className = 'sensor-status ' + status;
      }
    });
    const motionEl = document.getElementById('sv-motion');
    if (motionEl) motionEl.textContent = data.motion ? 'Active' : 'Still';
    // Log
    const log = document.getElementById('sensor-log');
    if (log) {
      const alerts = keys.filter(k => SensorSim.getStatus(k,data[k]) !== 'normal');
      const logLine = document.createElement('div');
      logLine.style.borderTop = '1px solid var(--border-light)';
      logLine.style.paddingTop = '4px';
      logLine.style.marginTop  = '4px';
      logLine.innerHTML = `<span style="color:var(--text-muted)">[${new Date().toLocaleTimeString()}]</span> T:${data.temperature}°C H:${data.humidity}% NH3:${data.ammoniaLevel}ppm CO2:${data.co2Level}ppm HR:${data.heartRate}bpm${alerts.length?` <span style="color:#C0392B">⚠ ${alerts.join(',')}</span>`:''}`;
      log.prepend(logLine);
      if (log.children.length > 15) log.lastChild.remove();
    }
  }, 3000);
}

/* ============================================================
   NOTIFICATIONS (FARMER)
============================================================ */
function renderNotifications() {
  const notifs = AppState.notifications;
  return `
    <div class="page-header"><div><h1>Notifications</h1><p>Alerts and updates from DA and admin</p></div>
      <button class="btn btn-sm btn-secondary" onclick="markAllNotifRead();loadSection('notifications')">✓ Mark all read</button>
    </div>
    ${notifs.length ? notifs.map(n => `
      <div class="card mb-3 ${!n.read?'border-${Utils.statusColor(n.type)}':''}" style="${!n.read?'border-left:3px solid '+(n.type==='alert'?'#C0392B':n.type==='warning'?'#D4A843':n.type==='success'?'#4A7C59':'#2980B9'):''}">
        <div class="card-body flex gap-3">
          <div style="font-size:24px">${n.icon}</div>
          <div style="flex:1">
            <div class="flex justify-between items-center gap-2 flex-wrap">
              <div class="font-bold">${n.title} ${!n.read?'<span class="badge badge-danger" style="font-size:9px">New</span>':''}</div>
              <div class="text-xs text-muted">${n.time}</div>
            </div>
            <div class="text-sm mt-1">${n.message}</div>
          </div>
        </div>
      </div>`).join('') : '<div class="empty-state"><div class="empty-icon">🔔</div><h3>No Notifications</h3><p>You are all caught up!</p></div>'}`;
}

/* ============================================================
   PROFILE MODAL
============================================================ */
function openProfileModal() {
  const user = AppState.currentUser;
  if (!user) return;
  const content = document.getElementById('profile-modal-content');
  if (!content) return;
  const avatarHtml = user.avatar
    ? `<img src="${user.avatar}" alt="${user.name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
    : `<span>${Utils.initials(user.name)}</span>`;

  content.innerHTML = `
    <div class="profile-avatar-section">
      <div class="profile-avatar-wrap">
        <div class="profile-avatar-img" id="profile-avatar-display">${avatarHtml}</div>
        <div class="profile-avatar-edit" onclick="document.getElementById('avatar-file').click()" title="Change photo">📷</div>
      </div>
      <input type="file" id="avatar-file" accept="image/*" style="display:none" onchange="updateAvatar(event)">
      <div style="font-size:12px;color:var(--text-muted);margin-top:8px">Click camera to change photo</div>
    </div>
    <div class="tabs" style="margin-bottom:20px">
      <div class="tab active" id="ptab-profile" onclick="switchProfileTab('profile')">👤 Profile</div>
      <div class="tab" id="ptab-password" onclick="switchProfileTab('password')">🔑 Password</div>
    </div>
    <div id="profile-tab-content">
      ${profileTabContent(user)}
    </div>`;
  Modal.open('modal-profile');
}

function profileTabContent(user) {
  return `
    <div class="form-group"><label class="form-label">Full Name</label><input class="form-control" id="p-name" value="${user.name}"></div>
    <div class="form-group"><label class="form-label">Email</label><input class="form-control" type="email" id="p-email" value="${user.email}"></div>
    <div class="form-group"><label class="form-label">Phone</label><input class="form-control" id="p-phone" value="${user.phone||''}"></div>
    <div class="form-group"><label class="form-label">Role</label>
      <div class="form-control" style="background:var(--bg-secondary);cursor:default;text-transform:capitalize">${user.role}</div>
    </div>
    <div id="profile-save-error" class="form-error"></div>
    <button class="btn btn-primary btn-full mt-2" onclick="saveProfile()">💾 Save Changes</button>`;
}

function passwordTabContent() {
  return `
    <div class="form-group"><label class="form-label">Current Password</label><input class="form-control" type="password" id="p-old-pass" placeholder="Enter current password"></div>
    <div class="form-group"><label class="form-label">New Password</label><input class="form-control" type="password" id="p-new-pass" placeholder="Min 6 characters"></div>
    <div class="form-group"><label class="form-label">Confirm New Password</label><input class="form-control" type="password" id="p-confirm-pass" placeholder="Repeat new password"></div>
    <div id="pass-change-error" class="form-error"></div>
    <button class="btn btn-primary btn-full mt-2" onclick="changePassword()">🔑 Update Password</button>`;
}

function switchProfileTab(tab) {
  document.querySelectorAll('.tab[id^="ptab"]').forEach(t => t.classList.remove('active'));
  const el = document.getElementById('ptab-' + tab);
  if (el) el.classList.add('active');
  const content = document.getElementById('profile-tab-content');
  if (!content) return;
  if (tab === 'profile') content.innerHTML = profileTabContent(AppState.currentUser);
  if (tab === 'password') content.innerHTML = passwordTabContent();
}

function saveProfile() {
  const name  = document.getElementById('p-name')?.value.trim();
  const email = document.getElementById('p-email')?.value.trim();
  const phone = document.getElementById('p-phone')?.value.trim();
  const errEl = document.getElementById('profile-save-error');
  if (!name || !email) { errEl.textContent='Name and email are required'; errEl.style.display='block'; return; }
  const r = Auth.updateProfile(AppState.currentUser.id, { name, email, phone });
  if (r.success) {
    Modal.close('modal-profile');
    updateTopbarAvatar();
    loadSection(AppState.currentPanel === 'admin' ? 'dashboard' : 'dashboard');
    Toast.show('Profile updated successfully', 'success');
  } else { errEl.textContent=r.error; errEl.style.display='block'; }
}

function changePassword() {
  const oldPass  = document.getElementById('p-old-pass')?.value;
  const newPass  = document.getElementById('p-new-pass')?.value;
  const confirm  = document.getElementById('p-confirm-pass')?.value;
  const errEl    = document.getElementById('pass-change-error');
  if (!oldPass || !newPass) { errEl.textContent='Please fill all fields'; errEl.style.display='block'; return; }
  if (newPass !== confirm) { errEl.textContent='New passwords do not match'; errEl.style.display='block'; return; }
  if (newPass.length < 6) { errEl.textContent='Password must be at least 6 characters'; errEl.style.display='block'; return; }
  const r = Auth.changePassword(AppState.currentUser.id, oldPass, newPass);
  if (r.success) { Modal.close('modal-profile'); Toast.show('Password changed successfully', 'success'); }
  else { errEl.textContent=r.error; errEl.style.display='block'; }
}

function updateAvatar(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 2*1024*1024) { Toast.show('Image must be under 2MB', 'error'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    const dataUrl = e.target.result;
    Auth.updateProfile(AppState.currentUser.id, { avatar: dataUrl });
    const display = document.getElementById('profile-avatar-display');
    if (display) display.innerHTML = `<img src="${dataUrl}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    updateTopbarAvatar();
    // Update sidebar avatar too
    renderPanel(AppState.currentPanel);
    Modal.open('modal-profile');
    Toast.show('Profile photo updated', 'success');
  };
  reader.readAsDataURL(file);
}

/* ============================================================
   HELPER RENDERERS
============================================================ */
function statWidget(icon, label, value, change, dir, bg) {
  return `
    <div class="stat-widget">
      <div class="stat-icon" style="background:${bg}">${icon}</div>
      <div class="stat-label">${label}</div>
      <div class="stat-value">${value}</div>
      ${change ? `<div class="stat-change ${dir}">${dir==='up'?'↑':dir==='down'?'↓':''} ${change}</div>` : ''}
    </div>`;
}

function mapLegend() {
  return `
    <div class="map-legend">
      <h4>Density Legend</h4>
      <div class="legend-item"><div class="legend-dot" style="background:#4A7C59"></div>Low (10–20)</div>
      <div class="legend-item"><div class="legend-dot" style="background:#D4A843"></div>Medium (21–30)</div>
      <div class="legend-item"><div class="legend-dot" style="background:#C0392B"></div>High (&gt;30)</div>
      <div class="legend-item"><div class="legend-dot" style="background:#2980B9"></div>Incident Alert</div>
    </div>`;
}

function renderIncidentRow(inc) {
  const priorityColors = { critical:'#F8D7DA', high:'#FFF3CD', medium:'#D1ECF1', low:'#D4EDDA' };
  return `
    <div style="padding:10px 16px;border-bottom:1px solid var(--border-light);display:flex;align-items:center;gap:10px">
      <div style="width:7px;height:7px;border-radius:50%;background:${Utils.getDensityColor(inc.priority==='critical'?40:inc.priority==='high'?25:15)};flex-shrink:0"></div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${inc.title}</div>
        <div style="font-size:11px;color:var(--text-muted)">${inc.farmName||'Public'} · ${Utils.formatDate(inc.date,'time')}</div>
      </div>
      <span class="badge badge-${Utils.statusColor(inc.status)}">${inc.status}</span>
    </div>`;
}

function farmStatusBar(farms) {
  const total    = farms.length || 1;
  const approved = farms.filter(f=>f.status==='approved').length;
  const pending  = farms.filter(f=>f.status==='pending').length;
  const rejected = farms.filter(f=>f.status==='rejected').length;
  return `
    <div style="height:12px;border-radius:100px;overflow:hidden;display:flex;gap:2px">
      <div style="width:${approved/total*100}%;background:#4A7C59;min-width:${approved?4:0}px"></div>
      <div style="width:${pending/total*100}%;background:#D4A843;min-width:${pending?4:0}px"></div>
      <div style="width:${rejected/total*100}%;background:#C0392B;min-width:${rejected?4:0}px"></div>
    </div>
    <div class="flex gap-4 mt-2 text-xs text-muted">
      <span>🟢 ${approved} Approved</span>
      <span>🟡 ${pending} Pending</span>
      <span>🔴 ${rejected} Rejected</span>
    </div>`;
}

function emptyState(msg) {
  return `<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:13px">${msg}</div>`;
}
