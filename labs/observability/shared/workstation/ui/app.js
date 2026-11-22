// Lab web UI: builds the machine list from /lab.json, shows live status from /status.json,
// and opens browser terminals (ttyd behind /tty/) as tabs. Nothing here is specific to one technology.
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let lab, tabs = [], active = null, seq = 0;

async function load() {
  lab = await (await fetch('lab.json')).json();
  document.title = lab.name;
  $('lab-name').textContent = $('welcome-title').textContent = lab.name;
  $('lab-desc').textContent = $('welcome-desc').textContent = lab.description;
  // Instructions are plain text; `backticks` become inline code.
  $('instructions').innerHTML = esc(lab.instructions).replace(/`([^`]+)`/g, '<code>$1</code>');

  const groups = {};
  lab.machines.forEach(m => (groups[m.group] ||= []).push(m));
  $('machines').innerHTML = Object.entries(groups).map(([g, ms]) => `<div class="group"><h2>${esc(g)}</h2>${ms.map(m => `
    <button class="machine" data-name="${esc(m.name)}" ${m.terminal ? '' : 'disabled'} title="${m.terminal ? 'Open a terminal' : 'No terminal for this machine'}">
      <i class="dot" id="dot-${esc(m.name)}"></i>
      <span><b>${esc(m.name)}</b><small>${esc(m.description)}</small>${m.service ? `<em class="badge" id="svc-${esc(m.name)}">${esc(m.service.label || 'service')}</em>` : ''}</span>
    </button>`).join('')}</div>`).join('');
  $('links').innerHTML = (lab.links || []).map(l => `<a href="${esc(l.url)}" target="_blank" rel="noreferrer">${esc(l.name)} ↗</a>`).join('');
  document.querySelectorAll('.machine:not([disabled])').forEach(b => b.addEventListener('click', e => open(b.dataset.name, e.shiftKey)));
  poll();
}

async function poll() {
  try {
    const { machines } = await (await fetch('status.json', { cache: 'no-store' })).json();
    let up = 0;
    for (const m of lab.machines) {
      const s = machines[m.name]; if (!s) continue;
      const svcOk = s.service !== false;
      if (s.reachable) up++;
      $(`dot-${m.name}`).className = `dot ${s.reachable ? (svcOk ? 'up' : 'partial') : 'down'}`;
      const badge = $(`svc-${m.name}`);
      if (badge) { badge.className = `badge ${s.service ? 'on' : 'off'}`; badge.textContent = `${m.service.label || 'service'} ${s.service ? 'up' : 'down'}`; }
    }
    $('summary').textContent = `${up}/${lab.machines.length} machines reachable`;
  } catch { $('summary').textContent = 'status unavailable'; }
  setTimeout(poll, 3000);
}

// One tab per click; clicking a machine that already has a tab focuses it unless Shift is held.
function open(name, another) {
  const existing = tabs.find(t => t.name === name);
  if (existing && !another) return focus(existing.id);
  const id = `t${++seq}`, n = tabs.filter(t => t.name === name).length + 1;
  const frame = document.createElement('iframe');
  frame.className = 'pane'; frame.id = `pane-${id}`; frame.title = `Terminal: ${name}`;
  frame.src = `tty/?arg=${encodeURIComponent(name)}`;
  $('panes').appendChild(frame);
  tabs.push({ id, name, label: n > 1 ? `${name} (${n})` : name });
  focus(id);
  $('side').classList.remove('open');
}

function focus(id) {
  active = id;
  $('welcome').style.display = tabs.length ? 'none' : '';
  tabs.forEach(t => $(`pane-${t.id}`).classList.toggle('active', t.id === id));
  renderTabs();
  const t = tabs.find(t => t.id === id);
  document.querySelectorAll('.machine').forEach(b => b.classList.toggle('active', b.dataset.name === t?.name));
  $(`pane-${id}`)?.contentWindow?.focus();
}

function close(id) {
  $(`pane-${id}`).remove();
  const i = tabs.findIndex(t => t.id === id);
  tabs.splice(i, 1);
  if (active === id) { const next = tabs[i] || tabs[i - 1]; if (next) return focus(next.id); active = null; }
  focus(active);
}

function renderTabs() {
  $('tabs').innerHTML = tabs.map(t => `<div class="tab ${t.id === active ? 'active' : ''}" role="tab" aria-selected="${t.id === active}" data-id="${t.id}">
    <span>${esc(t.label)}</span><button class="x" data-close="${t.id}" aria-label="Close ${esc(t.label)}">×</button></div>`).join('');
  $('tabs').querySelectorAll('.tab').forEach(el => el.addEventListener('click', e => {
    if (e.target.dataset.close) close(e.target.dataset.close); else focus(el.dataset.id);
  }));
}

$('menu').addEventListener('click', () => {
  const o = $('side').classList.toggle('open');
  $('menu').setAttribute('aria-expanded', o);
});
load();
