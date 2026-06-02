const toggleBtn   = document.getElementById('toggle-btn');
const dot         = document.getElementById('dot');
const statusText  = document.getElementById('status-text');
const countEl     = document.getElementById('count');
const ticsArea    = document.getElementById('tics');
const saveBtn     = document.getElementById('save-btn');

let active = false;

// Carrega configuracoes salvas
chrome.storage.local.get(['tics', 'count'], (data) => {
  if (data.tics) ticsArea.value = data.tics;
  if (data.count) countEl.textContent = data.count;
});

// Verifica estado atual
chrome.runtime.sendMessage({ type: 'GET_STATE' }, (resp) => {
  if (resp && resp.active) setActive(true);
});

// Atualiza contador em tempo real
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'COUNT_UPDATE') {
    countEl.textContent = msg.count;
    chrome.storage.local.set({ count: msg.count });
  }
});

toggleBtn.addEventListener('click', () => {
  if (!active) {
    const tics = ticsArea.value.split('\n').map(t => t.trim()).filter(Boolean);
    chrome.runtime.sendMessage({ type: 'START', tics }, (resp) => {
      if (resp && resp.ok) setActive(true);
    });
  } else {
    chrome.runtime.sendMessage({ type: 'STOP' }, () => setActive(false));
  }
});

saveBtn.addEventListener('click', () => {
  chrome.storage.local.set({ tics: ticsArea.value });
  saveBtn.textContent = '✅ Salvo!';
  setTimeout(() => saveBtn.textContent = '💾 Salvar', 1500);
});

function setActive(on) {
  active = on;
  dot.classList.toggle('active', on);
  statusText.textContent = on ? 'Ativo — removendo vícios' : 'Inativo';
  toggleBtn.textContent  = on ? '⏹ Desativar' : '▶ Ativar';
  toggleBtn.className    = 'btn ' + (on ? 'btn-off' : 'btn-on');
}
