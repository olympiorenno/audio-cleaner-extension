// Audio Cleaner Extension - Content Script
// Captura audio do video e envia para servidor Python via WebSocket

const WS_URL = "ws://127.0.0.1:8765";
const CHUNK_SECONDS  = 3;
const ADVANCE_SECONDS = 2;
const SAMPLE_RATE    = 16000;

let audioCtx    = null;
let gainNode    = null;
let ws          = null;
let active      = false;
let count       = 0;
let recording   = false;
let scriptProc  = null;
let audioBuffer = [];
let muteQueue   = [];

// ── Mensagens do popup/background ─────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'START') {
    start().then(ok => sendResponse({ ok }));
    return true;
  }
  if (msg.type === 'STOP') {
    stop();
    sendResponse({ ok: true });
  }
  if (msg.type === 'GET_STATE') {
    sendResponse({ active, count });
  }
});

// ── Inicio ────────────────────────────────────────────────────────────────────

async function start() {
  if (active) return true;

  const video = document.querySelector('video');
  if (!video) {
    console.warn('[AudioCleaner] Nenhum video neste frame');
    return false;
  }

  console.log('[AudioCleaner] Video encontrado! Iniciando...');

  try {
    // Conecta ao servidor Python
    ws = new WebSocket(WS_URL);
    await new Promise((resolve, reject) => {
      ws.onopen  = resolve;
      ws.onerror = reject;
      setTimeout(reject, 3000);
    });
    console.log('[AudioCleaner] Conectado ao servidor Python!');

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'result' && data.vicios.length > 0) {
        count += data.vicios.length;
        chrome.runtime.sendMessage({ type: 'COUNT_UPDATE', count });
        // Agenda mutes nos timestamps corretos (audio ainda no delay buffer)
        for (const v of data.vicios) {
          console.log(`[AudioCleaner] Agendando mute: "${v.word}" ${v.start}->${v.end}s`);
          const duracao = (v.end - v.start) * 1000;
          agendarMute(v.start, duracao);
        }
      }
    };

    // Captura audio do video
    const stream = video.captureStream();
    audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
    const source = audioCtx.createMediaStreamSource(stream);

    // DelayNode segura o audio enquanto servidor processa (~3s)
    const delayNode = audioCtx.createDelay(5.0);
    delayNode.delayTime.value = CHUNK_SECONDS; // atraso = tamanho do chunk

    gainNode = audioCtx.createGain();
    gainNode.gain.value = 1;

    // Fluxo: source → delay → gain → speakers
    source.connect(delayNode);
    delayNode.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    // Grava direto da source (sem delay) e envia para servidor
    iniciarGravacao(source);

    active = true;
    count  = 0;
    console.log('[AudioCleaner] Ativo!');
    return true;

  } catch(e) {
    console.error('[AudioCleaner] Erro ao conectar servidor Python:', e);
    console.error('Certifique-se que o server.bat esta rodando!');
    return false;
  }
}

function iniciarGravacao(source) {
  const chunkSize   = CHUNK_SECONDS   * SAMPLE_RATE;
  const advanceSize = ADVANCE_SECONDS * SAMPLE_RATE;

  scriptProc = audioCtx.createScriptProcessor(4096, 1, 1);
  audioBuffer = [];

  scriptProc.onaudioprocess = (e) => {
    if (!active) return;
    const samples = e.inputBuffer.getChannelData(0);
    audioBuffer.push(...samples);

    // Quando acumular chunk completo, envia para servidor
    if (audioBuffer.length >= chunkSize) {
      const chunk = new Float32Array(audioBuffer.slice(0, chunkSize));
      audioBuffer = audioBuffer.slice(advanceSize); // overlap

      // Envia como base64
      const encoded = btoa(String.fromCharCode(...new Uint8Array(chunk.buffer)));
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'audio', audio: encoded }));
      }
    }
  };

  source.connect(scriptProc);
  scriptProc.connect(audioCtx.destination);
}

let chunkStartTime = null; // quando o chunk atual comeou a ser capturado

function agendarMute(startSeg, durationMs) {
  if (!gainNode || !audioCtx || chunkStartTime === null) return;
  // O chunk foi capturado ha CHUNK_SECONDS atras
  // O audio correspondente toca agora (esta no delay buffer)
  // startSeg e relativo ao inicio do chunk
  const now = audioCtx.currentTime;
  const muteAt    = now + startSeg;           // quando muta
  const unmuteAt  = muteAt + durationMs/1000 + 0.1; // quando desmuta

  gainNode.gain.setValueAtTime(1,    muteAt - 0.02);
  gainNode.gain.linearRampToValueAtTime(0, muteAt);
  gainNode.gain.setValueAtTime(0,    unmuteAt - 0.05);
  gainNode.gain.linearRampToValueAtTime(1, unmuteAt);
}

function stop() {
  active = false;
  if (scriptProc) { scriptProc.disconnect(); scriptProc = null; }
  if (audioCtx)   { audioCtx.close(); audioCtx = null; }
  if (ws)         { ws.close(); ws = null; }
  gainNode   = null;
  audioBuffer = [];
  console.log('[AudioCleaner] Parado');
}
