// Audio Cleaner - Background Service Worker
// Captura audio da aba, detecta vicios via Web Speech API e muta em tempo real

let state = {
  active: false,
  tics: ['né', 'né?', 'então', 'pessoal', 'ok'],
  count: 0,
  recognition: null,
  stream: null,
  audioCtx: null,
  gainNode: null,
  muteTimeout: null,
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_STATE') {
    sendResponse({ active: state.active });
  }

  if (msg.type === 'START') {
    state.tics = msg.tics || state.tics;
    startCapture().then(() => sendResponse({ ok: true }));
    return true; // async
  }

  if (msg.type === 'STOP') {
    stopCapture();
    sendResponse({ ok: true });
  }

  if (msg.type === 'MUTE_TAB') {
    mutarTab(msg.tabId, msg.duration);
    sendResponse({ ok: true });
  }
});

async function startCapture() {
  try {
    // Captura audio da aba ativa
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const stream = await new Promise((resolve, reject) => {
      chrome.tabCapture.capture({ audio: true, video: false }, (s) => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(s);
      });
    });

    state.stream  = stream;
    state.active  = true;
    state.audioCtx = new AudioContext();

    const source   = state.audioCtx.createMediaStreamSource(stream);
    state.gainNode = state.audioCtx.createGain();
    const dest     = state.audioCtx.destination;

    source.connect(state.gainNode);
    state.gainNode.connect(dest);

    // Web Speech API para reconhecimento em tempo real
    startRecognition(tab.id);

    console.log('[AudioCleaner] Iniciado');
  } catch (e) {
    console.error('[AudioCleaner] Erro ao iniciar:', e);
  }
}

function stopCapture() {
  if (state.recognition) {
    state.recognition.stop();
    state.recognition = null;
  }
  if (state.stream) {
    state.stream.getTracks().forEach(t => t.stop());
    state.stream = null;
  }
  if (state.audioCtx) {
    state.audioCtx.close();
    state.audioCtx = null;
  }
  state.active = false;
  console.log('[AudioCleaner] Parado');
}

function startRecognition(tabId) {
  const recognition = new (self.SpeechRecognition || self.webkitSpeechRecognition)();
  recognition.lang = 'pt-BR';
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript.trim().toLowerCase();
      const words = transcript.split(/\s+/);

      for (const word of words) {
        const clean = word.replace(/[.,!?;:]/g, '');
        if (state.tics.map(t => t.toLowerCase()).includes(clean)) {
          console.log(`[AudioCleaner] Vicio detectado: "${clean}"`);
          mutarGain(400); // muta por 400ms
          state.count++;
          chrome.runtime.sendMessage({ type: 'COUNT_UPDATE', count: state.count });
          break;
        }
      }
    }
  };

  recognition.onerror = (e) => {
    if (e.error !== 'no-speech') console.warn('[AudioCleaner] Erro reconhecimento:', e.error);
  };

  recognition.onend = () => {
    // Reinicia automaticamente se ainda ativo
    if (state.active) recognition.start();
  };

  recognition.start();
  state.recognition = recognition;
}

function mutarGain(durationMs) {
  if (!state.gainNode) return;
  // Muta com fade suave
  state.gainNode.gain.linearRampToValueAtTime(0, state.audioCtx.currentTime + 0.02);
  // Desmuta apos duracao
  clearTimeout(state.muteTimeout);
  state.muteTimeout = setTimeout(() => {
    if (state.gainNode) {
      state.gainNode.gain.linearRampToValueAtTime(1, state.audioCtx.currentTime + 0.05);
    }
  }, durationMs);
}
