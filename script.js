// ============================================================
// DevClaude Pro – Full JavaScript
// Fully responsive, with demo fallback and API key support.
// ============================================================

// DOM references
const DOM = {
  messages: document.getElementById('messages'),
  userInput: document.getElementById('userInput'),
  sendBtn: document.getElementById('sendBtn'),
  voiceBtn: document.getElementById('voiceBtn'),
  themeToggle: document.getElementById('themeToggle'),
  clearBtn: document.getElementById('clearBtn'),
  settingsToggle: document.getElementById('settingsToggle'),
  settingsOverlay: document.getElementById('settingsOverlay'),
  projectNameInput: document.getElementById('projectNameInput'),
  systemPromptInput: document.getElementById('systemPromptInput'),
  apiKeyInput: document.getElementById('apiKeyInput'),
  saveSettings: document.getElementById('saveSettings'),
  closeSettings: document.getElementById('closeSettings'),
  exportBtn: document.getElementById('exportBtn'),
  previewIframe: document.getElementById('previewIframe'),
  codeEditor: document.getElementById('codeEditor'),
  projectDisplay: document.getElementById('projectDisplay'),
  tabButtons: document.querySelectorAll('[data-tab]'),
};

let conversation = [];
let currentCode = '';
let projectName = 'Untitled';
let systemPrompt = DOM.systemPromptInput.value;
let apiKey = '';
let isRecording = false;
let recognition = null;

// ===== Load saved state from localStorage =====
function loadState() {
  const saved = localStorage.getItem('devclaude_conversation');
  if (saved) { try { conversation = JSON.parse(saved); renderMessages(); } catch(e) {} }
  const theme = localStorage.getItem('devclaude_theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);
  DOM.themeToggle.innerHTML = `<i class="fas fa-${theme==='dark'?'sun':'moon'}"></i> <span>Theme</span>`;
  const proj = localStorage.getItem('devclaude_project') || 'Untitled';
  projectName = proj;
  DOM.projectDisplay.textContent = proj;
  DOM.projectNameInput.value = proj;
  const sys = localStorage.getItem('devclaude_system') || DOM.systemPromptInput.value;
  DOM.systemPromptInput.value = sys;
  systemPrompt = sys;
  const key = localStorage.getItem('devclaude_api_key') || '';
  DOM.apiKeyInput.value = key;
  apiKey = key;
}
loadState();

// ===== Render messages with syntax highlighting =====
function renderMessages() {
  DOM.messages.innerHTML = '';
  conversation.forEach(msg => {
    const div = document.createElement('div');
    div.className = `message ${msg.role}`;
    let html = msg.content;
    // Replace code blocks with pre/code
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      const escaped = escapeHtml(code);
      return `<pre><code class="language-${lang || 'text'}">${escaped}</code></pre>`;
    });
    html = html.replace(/\n/g, '<br>');
    div.innerHTML = html + `<div class="timestamp">${new Date(msg.timestamp).toLocaleTimeString()}</div>`;
    DOM.messages.appendChild(div);
  });
  DOM.messages.scrollTop = DOM.messages.scrollHeight;
  // Apply Prism highlighting
  if (window.Prism) {
    Prism.highlightAllUnder(DOM.messages);
  }
}
function escapeHtml(text) {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

// ===== Add a message and save =====
function addMessage(role, content) {
  conversation.push({ role, content, timestamp: Date.now() });
  localStorage.setItem('devclaude_conversation', JSON.stringify(conversation));
  renderMessages();
  if (role === 'assistant') extractAndPreview(content);
}

// ===== Extract code from AI response and update preview =====
function extractAndPreview(text) {
  const codeBlockRegex = /```(html|css|javascript|js|ts|python|php|xml|svg)\n([\s\S]*?)```/gi;
  let matches = [...text.matchAll(codeBlockRegex)];
  if (matches.length === 0) return;
  let fullHtml = '';
  let hasHtml = false, hasCss = false, hasJs = false;
  let cssContent = '', jsContent = '';
  for (let m of matches) {
    const lang = m[1].toLowerCase();
    const code = m[2].trim();
    if (lang === 'html') { fullHtml = code; hasHtml = true; }
    else if (lang === 'css') { cssContent = code; hasCss = true; }
    else if (lang === 'javascript' || lang === 'js') { jsContent = code; hasJs = true; }
  }
  // If no HTML block but CSS/JS, wrap them
  if (!hasHtml && (hasCss || hasJs)) {
    fullHtml = `<!DOCTYPE html><html><head><style>${cssContent}</style></head><body><script>${jsContent}</script></body></html>`;
    hasHtml = true;
  }
  if (hasHtml) {
    let finalDoc = fullHtml;
    if (!hasCss && cssContent) {
      finalDoc = finalDoc.replace('</head>', `<style>${cssContent}</style></head>`);
    }
    if (!hasJs && jsContent) {
      finalDoc = finalDoc.replace('</body>', `<script>${jsContent}</script></body>`);
    }
    if (!finalDoc.includes('<html')) {
      finalDoc = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${projectName}</title>${cssContent?`<style>${cssContent}</style>`:''}</head><body>${finalDoc}${jsContent?`<script>${jsContent}</script>`:''}</body></html>`;
    }
    DOM.previewIframe.srcdoc = finalDoc;
    currentCode = finalDoc;
    DOM.codeEditor.textContent = currentCode;
  } else {
    const firstMatch = text.match(/```(\w+)\n([\s\S]*?)```/);
    if (firstMatch) {
      currentCode = firstMatch[2];
      DOM.codeEditor.textContent = currentCode;
    }
  }
}

// ===== Call Claude API (or demo fallback) =====
async function askClaude(userMessage) {
  // Show typing indicator
  const typingDiv = document.createElement('div');
  typingDiv.className = 'message ai typing';
  typingDiv.textContent = 'DevClaude is thinking...';
  DOM.messages.appendChild(typingDiv);
  DOM.messages.scrollTop = DOM.messages.scrollHeight;

  const sys = systemPrompt || DOM.systemPromptInput.value;
  const key = apiKey || DOM.apiKeyInput.value.trim();

  // If no API key, use demo fallback
  if (!key) {
    setTimeout(() => {
      DOM.messages.removeChild(typingDiv);
      const demoReply = `⚠️ **No API key provided.**\n\nI'll generate a demo website for you:\n\n\`\`\`html\n<!DOCTYPE html>\n<html>\n<head><title>${projectName}</title>\n<style>body{font-family:sans-serif;text-align:center;padding:50px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;}</style>\n</head>\n<body>\n<h1>🚀 ${projectName}</h1>\n<p>This is a demo because you haven't set your Anthropic API key.</p>\n<p>Add your key in Settings to get real AI responses.</p>\n</body>\n</html>\n\`\`\`\n\n**To get real AI code generation, go to Settings and paste your API key from [console.anthropic.com](https://console.anthropic.com/).**`;
      addMessage('assistant', demoReply);
    }, 800);
    return;
  }

  // Real API call
  const url = 'https://api.anthropic.com/v1/messages';
  const payload = {
    model: 'claude-3-5-sonnet-20241022',
    system: sys,
    messages: conversation.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content })),
    max_tokens: 4096,
    temperature: 0.5,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    DOM.messages.removeChild(typingDiv);
    if (response.ok && data.content && data.content[0]) {
      addMessage('assistant', data.content[0].text);
    } else {
      const errMsg = data.error?.message || 'Unknown error.';
      addMessage('assistant', `⚠️ API Error: ${errMsg}\nCheck your API key or try again later.`);
    }
  } catch (err) {
    DOM.messages.removeChild(typingDiv);
    addMessage('assistant', `❌ Network error: ${err.message}\nMake sure you're online and the API is reachable.`);
  }
}

// ===== Send user message =====
function sendMessage() {
  const text = DOM.userInput.value.trim();
  if (!text) return;
  DOM.userInput.value = '';
  DOM.userInput.style.height = 'auto';
  addMessage('user', text);
  askClaude(text);
}

// ===== Event listeners =====
DOM.sendBtn.addEventListener('click', sendMessage);
DOM.userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
DOM.userInput.addEventListener('input', () => {
  DOM.userInput.style.height = 'auto';
  DOM.userInput.style.height = DOM.userInput.scrollHeight + 'px';
});

// ===== Voice input (Web Speech API) =====
if ('webkitSpeechRecognition' in window) {
  recognition = new webkitSpeechRecognition();
  recognition.lang = 'en-US';
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    DOM.userInput.value = transcript;
    DOM.userInput.dispatchEvent(new Event('input'));
    sendMessage();
  };
  recognition.onend = () => { DOM.voiceBtn.classList.remove('recording'); isRecording = false; };
  DOM.voiceBtn.addEventListener('click', () => {
    if (isRecording) { recognition.stop(); return; }
    recognition.start(); isRecording = true; DOM.voiceBtn.classList.add('recording');
  });
} else {
  DOM.voiceBtn.style.display = 'none';
}

// ===== Theme toggle =====
DOM.themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('devclaude_theme', next);
  DOM.themeToggle.innerHTML = `<i class="fas fa-${next==='dark'?'sun':'moon'}"></i> <span>Theme</span>`;
});

// ===== Clear chat =====
DOM.clearBtn.addEventListener('click', () => {
  if (confirm('Clear all messages?')) {
    conversation = [];
    localStorage.setItem('devclaude_conversation', JSON.stringify(conversation));
    renderMessages();
  }
});

// ===== Settings panel =====
DOM.settingsToggle.addEventListener('click', () => DOM.settingsOverlay.classList.add('open'));
DOM.closeSettings.addEventListener('click', () => DOM.settingsOverlay.classList.remove('open'));
DOM.saveSettings.addEventListener('click', () => {
  projectName = DOM.projectNameInput.value.trim() || 'Untitled';
  DOM.projectDisplay.textContent = projectName;
  localStorage.setItem('devclaude_project', projectName);
  systemPrompt = DOM.systemPromptInput.value;
  localStorage.setItem('devclaude_system', systemPrompt);
  apiKey = DOM.apiKeyInput.value.trim();
  localStorage.setItem('devclaude_api_key', apiKey);
  DOM.settingsOverlay.classList.remove('open');
  alert('Settings saved!');
});

// ===== Tab switching (Preview/Code) =====
DOM.tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    DOM.tabButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    if (tab === 'preview') {
      DOM.previewIframe.style.display = 'block';
      DOM.codeEditor.classList.remove('active');
    } else {
      DOM.previewIframe.style.display = 'none';
      DOM.codeEditor.classList.add('active');
    }
  });
});

// ===== Export as ZIP (using JSZip) =====
DOM.exportBtn.addEventListener('click', async () => {
  if (!currentCode) {
    const src = DOM.previewIframe.srcdoc;
    if (src && src !== '<html><body...') { currentCode = src; }
    else { alert('No code to export. Generate some code first.'); return; }
  }
  if (typeof JSZip === 'undefined') {
    alert('JSZip library not loaded. Please check your internet connection.');
    return;
  }
  const zip = new JSZip();
  let htmlContent = currentCode;
  // If content is not full HTML, wrap it
  if (!htmlContent.includes('<html')) {
    if (htmlContent.includes('<') && htmlContent.includes('>')) {
      htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${projectName}</title></head><body>${htmlContent}</body></html>`;
    } else {
      // Likely CSS or JS
      if (htmlContent.includes('{') || htmlContent.includes('@')) {
        zip.file('style.css', htmlContent);
        htmlContent = `<!DOCTYPE html><html><head><link rel="stylesheet" href="style.css"></head><body><h1>${projectName}</h1></body></html>`;
      } else {
        zip.file('script.js', htmlContent);
        htmlContent = `<!DOCTYPE html><html><head></head><body><script src="script.js"></script></body></html>`;
      }
    }
  }
  zip.file('index.html', htmlContent);
  // Extract and save CSS/JS if embedded
  const cssMatch = htmlContent.match(/<style>([\s\S]*?)<\/style>/);
  if (cssMatch) zip.file('style.css', cssMatch[1]);
  const jsMatch = htmlContent.match(/<script>([\s\S]*?)<\/script>/);
  if (jsMatch) zip.file('script.js', jsMatch[1]);

  try {
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.replace(/\s+/g, '_')}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert('Export failed: ' + err.message);
  }
});

// ===== Auto-resize textarea on load =====
DOM.userInput.style.height = 'auto';

console.log('DevClaude Pro – fully loaded. Ready to build.');
