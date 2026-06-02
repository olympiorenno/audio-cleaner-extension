// Background Service Worker (MV3)
// Coordena tabCapture e offscreen document

let state = { active: false, count: 0 };

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_STATE') {
    sendResponse({ active: state.active, count: state.count });
    return true;
  }

  if (msg.type === 'START') {
    startCapture(msg.tics).then(ok => sendResponse({ ok }));
    return true;
  }

  if (msg.type === 'STOP') {
    stopCapture().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg.type === 'COUNT_UPDATE') {
    state.count = msg.count;
    // Repassa para o popup
    chrome.runtime.sendMessage({ type: 'COUNT_UPDATE', count: state.count }).catch(() => {});
  }
});

async function startCapture(tics) {
  try {
    // Cria offscreen document para processar audio
    await ensureOffscreen();

    // Pega stream ID da aba atual
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const streamId = await new Promise((resolve, reject) => {
      chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, (id) => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(id);
      });
    });

    // Muta a aba original (offscreen vai reproduzir o audio processado)
    await chrome.tabs.update(tab.id, { muted: true });
    state.mutedTabId = tab.id;

    // Envia para offscreen processar
    await chrome.runtime.sendMessage({
      type: 'OFFSCREEN_START',
      streamId,
      tics: tics || ['né', 'né?', 'então', 'pessoal', 'ok', 'é', 'e']
    });

    state.active = true;
    state.count  = 0;
    return true;
  } catch (e) {
    console.error('[BG] Erro ao iniciar:', e);
    return false;
  }
}

async function stopCapture() {
  try {
    await chrome.runtime.sendMessage({ type: 'OFFSCREEN_STOP' });
    await chrome.offscreen.closeDocument();
    // Desmuta a aba original
    if (state.mutedTabId) {
      await chrome.tabs.update(state.mutedTabId, { muted: false });
      state.mutedTabId = null;
    }
  } catch (e) {}
  state.active = false;
}

async function ensureOffscreen() {
  const existing = await chrome.offscreen.hasDocument();
  if (!existing) {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['USER_MEDIA'],
      justification: 'Processar audio da aba para remover vicios de linguagem'
    });
  }
}
