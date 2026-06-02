// Offscreen Document - tem acesso a AudioContext e Web Speech API
// Roda em background invisivel

let audioCtx = null;
let gainNode = null;
let recognition = null;
let stream = null;
let muteTimeout = null;
let count = 0;
let tics = [];

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'OFFSCREEN_START') {
    tics = msg.tics || [];
    startProcessing(msg.streamId);
    sendResponse({ ok: true });
  }
  if (msg.type === 'OFFSCREEN_STOP') {
    stopProcessing();
    sendResponse({ ok: true });
  }
});

async function startProcessing(streamId) {
  try {
    // Obtém stream da aba via streamId
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      },
      video: false
    });

    // Web Audio API para controlar volume
    audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    gainNode = audioCtx.createGain();
    gainNode.gain.value = 1;
    source.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    // Web Speech API para reconhecimento em tempo real
    startRecognition();

    console.log('[Offscreen] Iniciado. Tics:', tics);
  } catch (e) {
    console.error('[Offscreen] Erro:', e);
  }
}

function stopProcessing() {
  if (recognition) { recognition.stop(); recognition = null; }
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  if (audioCtx) { audioCtx.close(); audioCtx = null; }
  gainNode = null;
  console.log('[Offscreen] Parado');
}

function startRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.error('[Offscreen] Web Speech API nao disponivel');
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'pt-BR';
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript.trim().toLowerCase();
      console.log('[Offscreen] Transcript:', transcript);

      // Verifica cada palavra
      const words = transcript.split(/\s+/);
      for (const word of words) {
        const clean = word.replace(/[.,!?;:-]/g, '');

        // Vicios simples (sempre remove)
        const simples = tics.filter(t => t !== 'é' && t !== 'e').map(t => t.toLowerCase());
        if (simples.includes(clean)) {
          console.log('[Offscreen] Vicio:', clean);
          mutarAudio(500);
          notificar();
          break;
        }
      }

      // "é/e" longo: transcript contem APENAS a hesitacao
      const transcriptLimpo = transcript.replace(/[.,!?;:-]/g, '').trim();
      if ((tics.includes('é') || tics.includes('e')) &&
          ['e', 'é', 'ee', 'éé', 'eee'].includes(transcriptLimpo)) {
        console.log('[Offscreen] E longo:', transcriptLimpo);
        mutarAudio(700);
        notificar();
      }
    }
  };

  recognition.onerror = (e) => {
    if (e.error !== 'no-speech') console.warn('[Offscreen] Erro:', e.error);
  };

  recognition.onend = () => {
    if (stream) recognition.start(); // reinicia automaticamente
  };

  recognition.start();
}

function mutarAudio(durationMs) {
  if (!gainNode || !audioCtx) return;
  gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.02);
  clearTimeout(muteTimeout);
  muteTimeout = setTimeout(() => {
    if (gainNode && audioCtx) {
      gainNode.gain.linearRampToValueAtTime(1, audioCtx.currentTime + 0.05);
    }
  }, durationMs);
}

function notificar() {
  count++;
  chrome.runtime.sendMessage({ type: 'COUNT_UPDATE', count });
}
