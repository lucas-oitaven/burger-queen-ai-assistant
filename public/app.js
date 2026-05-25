const STORAGE_KEY = "bq_web_session";

/** @type {{ userId: string; loginName: string; displayName: string } | null} */
let session = null;

const loginInput = document.getElementById("login-input");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const loginBar = document.getElementById("login-bar");
const userMenu = document.getElementById("user-menu");
const userMenuBtn = document.getElementById("user-menu-btn");
const userMenuDropdown = document.getElementById("user-menu-dropdown");
const switchUserBtn = document.getElementById("switch-user-btn");
const sessionDisplayName = document.getElementById("session-display-name");
const debugToggle = document.getElementById("debug-toggle");
const chatThread = document.getElementById("chat-thread");
const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const factsList = document.getElementById("facts-list");
const debugPanel = document.getElementById("debug-panel");
const debugContent = document.getElementById("debug-content");
const statusLine = document.getElementById("status-line");
const typingIndicator = document.getElementById("typing-indicator");
const chatSessionTitle = document.getElementById("chat-session-title");
const chatSessionSubtitle = document.getElementById("chat-session-subtitle");
const sessionDot = document.getElementById("session-dot");

const LOGGED_OUT_HTML =
  'Faça login e envie uma mensagem. Experimente <em>“O que você me recomenda hoje?”</em> com Ana e Bruno.';

const FACT_STYLE = {
  preference: { label: "Preferência", icon: "favorite", mod: "preference" },
  restriction: { label: "Restrição", icon: "warning", mod: "restriction" },
  allergy: { label: "Alergia", icon: "warning", mod: "restriction" },
  negative_preference: { label: "Evita", icon: "block", mod: "negative_preference" },
  default: { label: "Fato", icon: "info", mod: "" },
};

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMessageHtml(text) {
  return escapeHtml(text).replace(
    /\*\*(.+?)\*\*/g,
    "<strong>$1</strong>",
  );
}

function formatTime() {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function appendLog(tagClass, tag, message, indent = false) {
  const line = document.createElement("div");
  line.className = indent ? "log-line log-indent" : "log-line";
  line.innerHTML = `
    <span class="log-tag log-tag--${tagClass}">${tag}</span>
    <span class="log-detail">${escapeHtml(message)}</span>
  `;
  debugContent.appendChild(line);
}

function setStatus(text, kind = "") {
  statusLine.textContent = text;
  statusLine.classList.remove("is-error", "is-busy");
  if (kind === "error") statusLine.classList.add("is-error");
  if (kind === "busy") statusLine.classList.add("is-busy");
}

function setTyping(visible) {
  typingIndicator.classList.toggle("is-visible", visible);
  typingIndicator.classList.toggle("is-hidden", !visible);
}

function updateDebugPanelVisibility() {
  const on = debugToggle.checked;
  debugPanel.classList.toggle("is-visible", on);
  debugPanel.hidden = !on;
  const logsSlot = debugPanel.closest(".logs-slot");
  if (logsSlot) {
    logsSlot.setAttribute("aria-hidden", on ? "false" : "true");
  }
  renderDebugLogs(null);
}

function closeUserMenu() {
  userMenu.classList.remove("is-open");
  userMenuBtn.setAttribute("aria-expanded", "false");
  userMenuDropdown.classList.add("is-hidden");
}

function openUserMenu() {
  userMenu.classList.add("is-open");
  userMenuBtn.setAttribute("aria-expanded", "true");
  userMenuDropdown.classList.remove("is-hidden");
}

function loadSessionFromStorage() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.userId) return parsed;
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
  }
  return null;
}

function saveSession(data) {
  session = data;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function clearSession() {
  session = null;
  sessionStorage.removeItem(STORAGE_KEY);
}

function clearChat() {
  chatThread.innerHTML = "";
}

function showPlaceholder() {
  clearChat();
  const p = document.createElement("p");
  p.className = "chat-placeholder";
  p.innerHTML = LOGGED_OUT_HTML;
  chatThread.appendChild(p);
}

function appendMessage(role, text, label) {
  const isUser = role === "user";
  const wrap = document.createElement("div");
  wrap.className = isUser ? "msg-row msg-row--user" : "msg-row msg-row--assistant";

  const meta = document.createElement("span");
  meta.className = "msg-meta";
  meta.textContent = label;

  const bubble = document.createElement("div");
  bubble.className = isUser ? "msg-bubble msg-bubble--user" : "msg-bubble msg-bubble--assistant";
  bubble.innerHTML = formatMessageHtml(text);

  wrap.append(meta, bubble);
  chatThread.appendChild(wrap);
}

function scrollChatToBottom() {
  chatThread.scrollTop = chatThread.scrollHeight;
}

function buildFactCard(fact) {
  const style =
    FACT_STYLE[fact.category] ?? {
      ...FACT_STYLE.default,
      label: fact.category ?? FACT_STYLE.default.label,
    };
  const modClass = style.mod ? ` fact-card--${style.mod}` : "";

  const li = document.createElement("li");
  li.className = `fact-card${modClass}`;

  li.innerHTML = `
    <div class="fact-card-head">
      <span class="material-symbols-outlined">${style.icon}</span>
      <span class="fact-card-label">${escapeHtml(style.label)}</span>
    </div>
    <p class="fact-card-text">${escapeHtml(fact.fact)}</p>
  `;
  return li;
}

function renderFacts(facts) {
  factsList.innerHTML = "";
  if (!facts?.length) {
    const empty = document.createElement("li");
    empty.className = "facts-empty";
    empty.textContent = session
      ? "Nenhum fato ativo ainda."
      : "Entre com um usuário para ver fatos.";
    factsList.appendChild(empty);
    return;
  }
  for (const fact of facts) {
    factsList.appendChild(buildFactCard(fact));
  }
}

function renderDebugLogs(debug) {
  debugContent.innerHTML = "";

  if (!debugToggle.checked) {
    return;
  }

  if (!debug) {
    debugContent.innerHTML =
      "<p>Debug ligado — envie uma mensagem para ver o turno.</p>";
    return;
  }

  appendLog("info", "INFO", `Turn for user '${debug.userLogin ?? "—"}'`);
  appendLog("info", "INTENT", debug.intent ?? "—");
  appendLog("stage", "STAGE", debug.conversationStage ?? "—");

  if (debug.usedRag) {
    appendLog("rag", "RAG", "Querying knowledge base (ChromaDB)");
    for (const doc of debug.retrievedDocs ?? []) {
      appendLog("rag", "RAG", doc, true);
    }
  } else {
    appendLog("rag", "RAG", "Skipped for this turn");
  }

  if (debug.usedLongTermMemory) {
    appendLog("mem", "MEM", "Retrieving user long-term facts");
  }

  for (const fact of debug.savedFacts ?? []) {
    appendLog("mem", "MEM", fact, true);
  }

  for (const item of debug.draftOrder ?? []) {
    const qty = item.quantity > 1 ? ` x${item.quantity}` : "";
    appendLog("stage", "ORDER", `${item.name}${qty}`, true);
  }

  for (const tool of debug.toolsInvoked ?? []) {
    const suffix = tool.invoked
      ? "invoked"
      : `skipped${tool.reason ? ` — ${tool.reason}` : ""}`;
    appendLog("tool", "TOOL", `${tool.tool} (${suffix})`, true);
  }

  if (debug.riskLevel === "high") {
    appendLog("warn", "WARN", "High risk — safe mode");
  }

  appendLog("info", "INFO", "--- End of turn ---");
  debugContent.scrollTop = debugContent.scrollHeight;
}

function updateSessionHeader() {
  if (!session) {
    chatSessionTitle.textContent = "Sessão";
    chatSessionSubtitle.textContent = "Faça login para iniciar";
    sessionDisplayName.textContent = "—";
    sessionDot.classList.remove("is-active");
    return;
  }
  chatSessionTitle.textContent = "Sessão Ativa";
  chatSessionSubtitle.textContent = `Interagindo com ${session.displayName} • ${formatTime()}`;
  sessionDisplayName.textContent = session.displayName;
  sessionDot.classList.add("is-active");
}

function setLoggedInUi() {
  if (!session) {
    loginBar.classList.remove("is-hidden");
    loginInput.classList.remove("is-hidden");
    loginBtn.classList.remove("is-hidden");
    logoutBtn.classList.add("is-hidden");
    userMenu.classList.add("is-hidden");
    closeUserMenu();
    messageInput.disabled = true;
    sendBtn.disabled = true;
    loginInput.disabled = false;
    updateSessionHeader();
    renderFacts([]);
    return;
  }
  loginInput.classList.add("is-hidden");
  loginBtn.classList.add("is-hidden");
  logoutBtn.classList.remove("is-hidden");
  userMenu.classList.remove("is-hidden");
  messageInput.disabled = false;
  sendBtn.disabled = false;
  loginInput.disabled = true;
  updateSessionHeader();
  messageInput.focus();
}

async function apiPost(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.details === "string"
        ? data.details
        : data.error ?? res.statusText,
    );
  }
  return data;
}

async function apiGet(path) {
  const res = await fetch(path);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data;
}

async function refreshFacts() {
  if (!session?.userId) {
    renderFacts([]);
    return;
  }
  const data = await apiGet(
    `/api/facts?userId=${encodeURIComponent(session.userId)}`,
  );
  renderFacts(data.facts ?? []);
}

async function loadChatHistory() {
  if (!session?.userId) return;

  clearChat();

  try {
    const data = await apiGet(
      `/api/messages?userId=${encodeURIComponent(session.userId)}`,
    );
    const messages = data.messages ?? [];

    if (!messages.length) {
      appendMessage(
        "assistant",
        `Olá, ${session.displayName}! Envie uma mensagem para começar.`,
        "Burger Queen AI",
      );
      scrollChatToBottom();
      return;
    }

    for (const msg of messages) {
      const role = msg.role === "user" ? "user" : "assistant";
      const label =
        role === "user" ? session.displayName : "Burger Queen AI";
      appendMessage(role, msg.content, label);
    }
    scrollChatToBottom();
  } catch (err) {
    appendMessage(
      "assistant",
      `Olá, ${session.displayName}! Não foi possível carregar o histórico.`,
      "Sistema",
    );
    setStatus(err instanceof Error ? err.message : String(err), "error");
    scrollChatToBottom();
  }
}

function handleLogout() {
  closeUserMenu();
  clearSession();
  loginInput.value = "";
  loginInput.disabled = false;
  showPlaceholder();
  renderFacts([]);
  renderDebugLogs(null);
  setLoggedInUi();
  setStatus("Desconectado.");
  setTyping(false);
  loginInput.focus();
}

function handleSwitchUser() {
  handleLogout();
  setStatus("Escolha outro usuário para entrar.");
}

async function handleLogin() {
  const loginName = loginInput.value.trim();
  if (!loginName) {
    setStatus("Informe um login.", "error");
    return;
  }
  setStatus("Entrando…", "busy");
  loginBtn.disabled = true;
  try {
    const data = await apiPost("/api/login", { loginName });
    saveSession({
      userId: data.userId,
      loginName: data.loginName,
      displayName: data.displayName,
    });
    setLoggedInUi();
    await loadChatHistory();
    await refreshFacts();
    renderDebugLogs(null);
    setStatus("Pronto.");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "error");
  } finally {
    loginBtn.disabled = false;
  }
}

async function handleSendMessage(event) {
  event.preventDefault();
  if (!session?.userId) {
    setStatus("Faça login antes de enviar.", "error");
    return;
  }
  const message = messageInput.value.trim();
  if (!message) return;

  appendMessage("user", message, session.displayName);
  scrollChatToBottom();
  messageInput.value = "";
  messageInput.disabled = true;
  sendBtn.disabled = true;
  setTyping(true);
  setStatus("Aguardando resposta…", "busy");

  try {
    const data = await apiPost("/api/chat", {
      userId: session.userId,
      message,
      debug: debugToggle.checked,
    });
    await loadChatHistory();
    renderDebugLogs(data.debug ?? null);
    await refreshFacts();
    updateSessionHeader();
    setStatus("Pronto.");
  } catch (err) {
    await loadChatHistory();
    appendMessage(
      "assistant",
      "Não foi possível processar sua mensagem. Verifique OPENAI_API_KEY e Chroma (`chroma run` + `npm run seed:kb`).",
      "Erro",
    );
    setStatus(err instanceof Error ? err.message : String(err), "error");
    scrollChatToBottom();
  } finally {
    setTyping(false);
    messageInput.disabled = false;
    sendBtn.disabled = false;
    messageInput.focus();
  }
}

function init() {
  debugToggle.addEventListener("change", updateDebugPanelVisibility);
  loginBtn.addEventListener("click", handleLogin);
  logoutBtn.addEventListener("click", handleLogout);
  switchUserBtn.addEventListener("click", handleSwitchUser);
  userMenuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (userMenuDropdown.classList.contains("is-hidden")) {
      openUserMenu();
    } else {
      closeUserMenu();
    }
  });
  document.addEventListener("click", (e) => {
    if (!userMenu.contains(e.target)) closeUserMenu();
  });
  loginInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleLogin();
    }
  });
  chatForm.addEventListener("submit", handleSendMessage);
  updateDebugPanelVisibility();

  const stored = loadSessionFromStorage();
  if (stored) {
    session = stored;
    loginInput.value = stored.loginName;
    setLoggedInUi();
    loadChatHistory().catch((e) =>
      setStatus(e instanceof Error ? e.message : String(e), "error"),
    );
    refreshFacts().catch((e) =>
      setStatus(e instanceof Error ? e.message : String(e), "error"),
    );
  } else {
    showPlaceholder();
    setLoggedInUi();
  }
}

init();
