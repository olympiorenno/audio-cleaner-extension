// Background Service Worker (MV3) - simplificado
// Apenas coordena mensagens entre popup e content script

let state = { active: false, count: 0, tabId: null };

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_STATE') {
    sendResponse({ active: state.active, count: state.count });
    return true;
  }

  if (msg.type === 'START') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) { sendResponse({ ok: false }); return; }
      state.tabId = tabs[0].id;
      chrome.tabs.sendMessage(state.tabId, { type: 'START', tics: msg.tics }, (resp) => {
        state.active = true;
        state.count  = 0;
        sendResponse({ ok: true });
      });
    });
    return true;
  }

  if (msg.type === 'STOP') {
    if (state.tabId) {
      chrome.tabs.sendMessage(state.tabId, { type: 'STOP' });
    }
    state.active = false;
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'COUNT_UPDATE') {
    state.count = msg.count;
    // Repassa para o popup
    chrome.runtime.sendMessage({ type: 'COUNT_UPDATE', count: state.count }).catch(() => {});
  }
});
