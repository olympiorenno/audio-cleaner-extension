// Content script - injeta no contexto da pagina
// Necessario para acessar elementos de audio/video diretamente

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'MUTE_VIDEO') {
    const videos = document.querySelectorAll('video, audio');
    videos.forEach(v => {
      v.muted = msg.muted;
    });
    sendResponse({ ok: true, count: videos.length });
  }
});
