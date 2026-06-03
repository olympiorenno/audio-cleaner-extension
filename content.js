// Audio Cleaner - Content Script v0.5.0
// Usa Web Speech API (microfone capta audio dos speakers)

let recognition = null;
let active  = false;
let count   = 0;
let tics    = ['né', 'né?', 'então', 'pessoal', 'ok'];
let muteTimeout = null;

// Roda apenas no frame principal para evitar conflito de microfone
const IS_TOP_FRAME = window === window.top;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'START') {
    if (!IS_TOP_FRAME) { sendResponse({ ok: false }); return; }
    tics = msg.tics || tics;
    const ok = start();
    sendResponse({ ok });
  }
  if (msg.type === 'STOP') {
    if (!IS_TOP_FRAME) { sendResponse({ ok: false }); return; }
    stop();
    sendResponse({ ok: true });
  }
  if (msg.type === 'GET_STATE') {
    sendResponse({ active, count });
  }
});

function start() {
  if (active) return true;

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    console.error('[AudioCleaner] Web Speech API nao disponivel');
    return false;
  }

  recognition = new SR();
  recognition.lang = 'pt-BR';
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    console.log('[AudioCleaner] Ativo! Escutando vicios...');
    active = true;
  };

  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript.trim().toLowerCase();
      const words = transcript.split(/\s+/);

      for (const word of words) {
        const clean = word.replace(/[.,!?;:-]/g, '');

        // Vicios simples
        const simples = tics.filter(t => !['é','e'].includes(t.toLowerCase()));
        if (simples.map(t => t.toLowerCase()).includes(clean)) {
          console.log(`[AudioCleaner] Vicio: "${clean}"`);
          mutar(500);
          notificar();
          break;
        }
      }

      // E longo isolado
      const limpo = transcript.replace(/[.,!?;:-]/g, '').trim();
      if (['e','é','ee','éé','eee'].includes(limpo)) {
        console.log(`[AudioCleaner] E longo: "${limpo}"`);
        mutar(700);
        notificar();
      }
    }
  };

  recognition.onerror = (e) => {
    if (e.error === 'not-allowed') {
      console.error('[AudioCleaner] Permissao de microfone negada!');
      active = false;
    } else if (e.error !== 'no-speech') {
      console.warn('[AudioCleaner] Erro:', e.error);
    }
  };

  recognition.onend = () => {
    if (active) recognition.start();
  };

  recognition.start();
  return true;
}

function mutar(durationMs) {
  // Muta videos no frame atual
  const videos = document.querySelectorAll('video');
  if (videos.length > 0) {
    videos.forEach(v => { v.muted = true; });
    clearTimeout(muteTimeout);
    muteTimeout = setTimeout(() => {
      videos.forEach(v => { v.muted = false; });
    }, durationMs);
  }

  // Pede ao background para mutar em todos os frames (incluindo iframes)
  try {
    chrome.runtime.sendMessage({ type: 'MUTE_ALL', duration: durationMs });
  } catch(e) {}
}

// Recebe mute do background (quando rodando em iframe)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'MUTE_VIDEO') {
    const videos = document.querySelectorAll('video');
    videos.forEach(v => { v.muted = true; });
    setTimeout(() => {
      videos.forEach(v => { v.muted = false; });
    }, msg.duration);
  }
});

function notificar() {
  count++;
  try {
    chrome.runtime.sendMessage({ type: 'COUNT_UPDATE', count });
  } catch(e) {
    // Service worker dormiu — normal no MV3, mute continua funcionando
  }
}

function stop() {
  if (recognition) { recognition.stop(); recognition = null; }
  active = false;
  document.querySelectorAll('video').forEach(v => { v.muted = false; });
  console.log('[AudioCleaner] Parado');
}
