// Content Script - roda diretamente na pagina
// Captura audio do video via captureStream() e usa Web Speech API

let recognition = null;
let audioCtx = null;
let gainNode = null;
let muteTimeout = null;
let count = 0;
let tics = ['né', 'né?', 'então', 'pessoal', 'ok'];
let eThreshold = true;
let active = false;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'START') {
    tics = msg.tics || tics;
    start();
    sendResponse({ ok: true });
  }
  if (msg.type === 'STOP') {
    stop();
    sendResponse({ ok: true });
  }
  if (msg.type === 'GET_STATE') {
    sendResponse({ active, count });
  }
});

function findVideo() {
  // Busca no frame atual (all_frames:true garante injecao em iframes tambem)
  return document.querySelector('video');
}

function start() {
  if (active) return;
  active = true;
  count = 0;

  const video = findVideo();
  if (!video) {
    console.warn('[AudioCleaner] Nenhum video encontrado na pagina');
    startRecognitionOnly();
    return;
  }

  try {
    // Captura stream do video
    const stream = video.captureStream();
    audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    gainNode = audioCtx.createGain();
    gainNode.gain.value = 1;
    source.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    // Usa o mesmo stream para reconhecimento de fala
    startRecognition(stream);
    console.log('[AudioCleaner] Iniciado com captureStream');
  } catch(e) {
    console.warn('[AudioCleaner] captureStream falhou, usando microfone:', e);
    startRecognitionOnly();
  }
}

function startRecognitionOnly() {
  // Fallback: usa Web Speech API padrao (microfone do sistema)
  startRecognition(null);
}

function startRecognition(stream) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { console.error('[AudioCleaner] Web Speech API nao disponivel'); return; }

  recognition = new SR();
  recognition.lang = 'pt-BR';
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript.trim().toLowerCase();

      // Verifica cada palavra
      const words = transcript.split(/\s+/);
      for (const word of words) {
        const clean = word.replace(/[.,!?;:-]/g, '');
        const simples = tics.filter(t => !['é','e'].includes(t)).map(t => t.toLowerCase());
        if (simples.includes(clean)) {
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
    if (e.error !== 'no-speech') console.warn('[AudioCleaner] Erro:', e.error);
  };
  recognition.onend = () => { if (active) recognition.start(); };
  recognition.start();
}

function mutar(durationMs) {
  const video = findVideo();

  // Muta via gainNode se disponivel
  if (gainNode && audioCtx) {
    gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.02);
    clearTimeout(muteTimeout);
    muteTimeout = setTimeout(() => {
      if (gainNode && audioCtx) {
        gainNode.gain.linearRampToValueAtTime(1, audioCtx.currentTime + 0.05);
      }
    }, durationMs);
  }

  // Fallback: muta o video diretamente
  if (video) {
    video.muted = true;
    clearTimeout(muteTimeout);
    muteTimeout = setTimeout(() => { if (video) video.muted = false; }, durationMs);
  }
}

function notificar() {
  count++;
  chrome.runtime.sendMessage({ type: 'COUNT_UPDATE', count });
}

function stop() {
  if (recognition) { recognition.stop(); recognition = null; }
  if (audioCtx) { audioCtx.close(); audioCtx = null; }
  gainNode = null;
  active = false;
  // Desmuta video se estava mutado
  const video = findVideo();
  if (video) video.muted = false;
}
