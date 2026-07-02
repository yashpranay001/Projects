// ── State ──
const state = {
  messages: [],
  sessions: [],
  currentSessionId: null,
  isStreaming: false,
};

// ── DOM refs ──
const welcomeScreen = document.getElementById("welcomeScreen");
const messagesContainer = document.getElementById("messagesContainer");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const newChatBtn = document.getElementById("newChatBtn");
const chatHistory = document.getElementById("chatHistory");
const micBtn = document.getElementById("micBtn");

// ── Voice Input ──
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;
let isListening = false;

if (micBtn && SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.continuous = false;

  recognition.onstart = () => {
  isListening = true;
  micBtn.classList.add("listening");
  micBtn.title = "Listening...";

  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;

    userInput.value = transcript;
    autoResize();
    updateSendBtn();
    userInput.focus();
  };

  recognition.onerror = (event) => {
    console.error("Speech recognition error:", event.error);
    isListening = false;
    micBtn.classList.remove("listening");
    micBtn.setAttribute("aria-label", "Start voice input");
    micBtn.title = "Start voice input";
    if (event.error === "not-allowed") {
      alert("Microphone permission denied. Please allow microphone access and try again.");
    } else {
      alert("Voice input error: " + event.error);
    }
  };

  recognition.onend = () => {
    isListening = false;
    micBtn.classList.remove("listening");
    micBtn.setAttribute("aria-label", "Start voice input");
    micBtn.title = "Start voice input";
  };

  micBtn.addEventListener("click", () => {
    console.log("Mic button clicked");
    if (state.isStreaming) return;

    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  });
} else if (micBtn) {
  micBtn.disabled = true;
  micBtn.setAttribute("aria-label", "Voice input is not supported");
  micBtn.title = "Voice input is not supported in this browser";
  micBtn.addEventListener("click", () => {
    alert("Voice input is not supported in your browser. Please use Chrome or Edge.");
  });
}

// ── Helpers ──
function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderMarkdown(text) {
  let html = escapeHtml(text);

  html = html.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) =>
    `<pre><code>${code.trim()}</code></pre>`
  );

  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/^## (.+)$/gm, "<strong>$1</strong>");
  html = html.replace(/^[-•] (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>");
  html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");

  html = html
    .split(/\n{2,}/)
    .map((p) => (p.trim() ? `<p>${p.replace(/\n/g, "<br/>")}</p>` : ""))
    .join("");

  return html;
}

function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ── Render ──
function showChat() {
  welcomeScreen.style.display = "none";
  messagesContainer.classList.add("visible");
}

function hideChat() {
  welcomeScreen.style.display = "";
  messagesContainer.classList.remove("visible");
  messagesContainer.innerHTML = "";
}

function appendMessage(role, content, streaming = false) {
  const row = document.createElement("div");
  row.className = `message-row ${role}`;

  const avatar = document.createElement("div");
  avatar.className = `avatar ${role === "assistant" ? "ai-avatar" : "user-avatar"}`;
  avatar.textContent = role === "assistant" ? "☀️" : "You";

  const bubble = document.createElement("div");
  bubble.className = `bubble ${role === "assistant" ? "ai-bubble" : "user-bubble"}`;

  if (streaming) {
    bubble.innerHTML = `<div class="typing-dots"><span></span><span></span><span></span></div>`;
  } else if (role === "assistant") {
    bubble.innerHTML = renderMarkdown(content);
  } else {
    bubble.innerHTML = `<p>${escapeHtml(content)}</p>`;
  }

  row.appendChild(avatar);
  row.appendChild(bubble);
  messagesContainer.appendChild(row);
  scrollToBottom();

  return bubble;
}

// ── Session Management ──
function saveSession() {
  if (!state.currentSessionId || state.messages.length === 0) return;

  const existing = state.sessions.find((s) => s.id === state.currentSessionId);
  const title =
    state.messages[0].content.slice(0, 40) +
    (state.messages[0].content.length > 40 ? "…" : "");

  if (existing) {
    existing.messages = [...state.messages];
    existing.title = title;
  } else {
    state.sessions.unshift({
      id: state.currentSessionId,
      title,
      messages: [...state.messages],
    });
  }

  renderSidebar();
}

function renderSidebar() {
  const label = chatHistory.querySelector(".history-label");
  chatHistory.innerHTML = "";

  if (label) chatHistory.appendChild(label);

  state.sessions.forEach((session) => {
    const item = document.createElement("div");
    item.className = `history-item${session.id === state.currentSessionId ? " active" : ""}`;
    item.textContent = session.title || "New Chat";
    item.onclick = () => loadSession(session.id);
    chatHistory.appendChild(item);
  });
}

function loadSession(id) {
  const session = state.sessions.find((s) => s.id === id);
  if (!session) return;

  state.currentSessionId = id;
  state.messages = [...session.messages];

  messagesContainer.innerHTML = "";

  if (state.messages.length > 0) {
    showChat();
    state.messages.forEach((m) => appendMessage(m.role, m.content));
  } else {
    hideChat();
  }

  renderSidebar();
}

function startNewSession() {
  saveSession();
  state.currentSessionId = uid();
  state.messages = [];
  hideChat();
  renderSidebar();
  userInput.focus();
}

// ── Send Message ──
async function sendMessage(text) {
  if (state.isStreaming || !text.trim()) return;

  const userText = text.trim();

  userInput.value = "";
  autoResize();
  updateSendBtn();

  if (!state.currentSessionId) state.currentSessionId = uid();

  showChat();

  state.messages.push({ role: "user", content: userText });
  appendMessage("user", userText);

  state.isStreaming = true;
  sendBtn.disabled = true;

  const aiBubble = appendMessage("assistant", "", true);

  let fullResponse = "";

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages: state.messages }),
    });

    if (!res.ok) throw new Error("Request failed");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    let buffer = "";
    let streamDone = false;

    while (!streamDone) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop();

      for (const event of events) {
        const lines = event.split(/\r?\n/);

        for (const line of lines) {
          const trimmed = line.trim();

          if (!trimmed.startsWith("data:")) continue;

          const chunk = trimmed.slice(5).trim();

          if (chunk === "[DONE]") {
            streamDone = true;
            break;
          }

          let parsed = chunk;

          try {
            parsed = JSON.parse(chunk);
          } catch (e) {
            parsed = chunk;
          }

          const text = parsed?.text ?? parsed;

          fullResponse += text;
          aiBubble.innerHTML = renderMarkdown(fullResponse) || "...";
          scrollToBottom();
        }

        if (streamDone) break;
      }
    }

    state.messages.push({
      role: "assistant",
      content: fullResponse,
    });

    aiBubble.innerHTML = renderMarkdown(fullResponse);
    saveSession();
  } catch (err) {
    aiBubble.innerHTML = `<p style="color:#c0392b;">Something went wrong. Please try again.</p>`;
    state.messages.pop();
  } finally {
    state.isStreaming = false;
    updateSendBtn();
    scrollToBottom();
  }
}

// ── UI helpers ──
function autoResize() {
  userInput.style.height = "auto";
  userInput.style.height = Math.min(userInput.scrollHeight, 180) + "px";
}

function updateSendBtn() {
  sendBtn.disabled = !userInput.value.trim() || state.isStreaming;
}

// ── Events ──
userInput.addEventListener("input", () => {
  autoResize();
  updateSendBtn();
});

userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();

    if (!sendBtn.disabled) {
      sendMessage(userInput.value);
    }
  }
});

sendBtn.addEventListener("click", () => {
  sendMessage(userInput.value);
});

newChatBtn.addEventListener("click", startNewSession);

document.querySelectorAll(".suggestion-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const prompt = chip.dataset.prompt;
    sendMessage(prompt);
  });
});

// ── Init ──
startNewSession();
