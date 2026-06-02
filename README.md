# 🎙️ Audio Cleaner - Chrome Extension

Remove vícios de linguagem em tempo real durante aulas e reuniões online, diretamente no browser.

> Versão mais simples que o [app Python](https://github.com/olympiorenno/audio-cleaner) — sem VB-Cable, sem configuração.

---

## ✨ Vantagens sobre o app Python

| | App Python | Extensão Chrome |
|---|---|---|
| Instalação | Complexa | 1 clique |
| VB-Cable | Necessário | Não precisa |
| Latência | ~2s | ~300ms |
| Plataforma | Windows | Qualquer OS |
| Sincronização | Pode dessincronizar | Perfeita |

---

## 🚀 Instalação (modo desenvolvedor)

1. Baixe ou clone este repositório
2. Abra Chrome → `chrome://extensions`
3. Ative **"Modo do desenvolvedor"** (canto superior direito)
4. Clique em **"Carregar sem compactação"**
5. Selecione a pasta do projeto

---

## ▶️ Como usar

1. Clique no ícone da extensão na barra do Chrome
2. Clique em **▶ Ativar**
3. Assista a aula normalmente — os vícios serão silenciados automaticamente

---

## ⚙️ Configuração

No popup da extensão, edite a lista de vícios (um por linha):
```
né
né?
então
pessoal
ok
```

---

## 🔧 Como funciona

```
Áudio da aba → Web Speech API → detecta vício → muta via Web Audio API
```

- Usa a API de reconhecimento de fala nativa do Chrome (`pt-BR`)
- Latência de ~300ms (muito menor que o app Python)
- Processamento 100% local — sem servidores externos

---

## 📄 Licença

MIT
