const STORAGE_KEY = "bq_web_session";

/** @type {{ userId: string; loginName: string; displayName: string } | null} */
let session = null;

const loginInput = document.getElementById("login-input");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const debugToggle = document.getElementById("debug-toggle");
const sessionInfo = document.getElementById("session-info");
const chatThread = document.getElementById("chat-thread");
const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const factsList = document.getElementById("facts-list");
const debugPanel = document.getElementById("debug-panel");
const debugContent = document.getElementById("debug-content");
const statusLine = document.getElementById("status-line");
const mainEl = document.getElementById("main");

function setStatus(text, kind = "") {
  statusLine.textContent = text;
  statusLine.className = `status-line${kind ? ` ${kind}` : ""}`;
}

function loadSessionFromStorage() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.userId === "string") {
      return parsed;
    }
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

const LOGGED_OUT_PLACEHOLDER_HTML =
  'Faça login e envie uma mensagem. Experimente <em>“O que você me recomenda hoje?”</em> com Ana e Bruno.';

function showLoggedOutPlaceholder() {
  clearChatThread();
  const placeholder = document.createElement("p");
  placeholder.className = "chat-placeholder";
  placeholder.innerHTML = LOGGED_OUT_PLACEHOLDER_HTML;
  chatThread.appendChild(placeholder);
}

function clearChatThread() {
  chatThread.innerHTML = "";
}

async function loadChatHistory() {
  if (!session?.userId) {
    clearChatThread();
    return;
  }

  clearChatThread();

  try {
    const data = await apiGet(
      `/api/messages?userId=${encodeURIComponent(session.userId)}`,
    );
    const messages = data.messages ?? [];

    if (messages.length === 0) {
      appendMessage(
        "assistant",
        `Olá, ${session.displayName}! Envie uma mensagem para começar.`,
        "Sistema",
      );
      return;
    }

    for (const msg of messages) {
      const label =
        msg.role === "user" ? session.displayName : "Assistente";
      appendMessage(msg.role, msg.content, label);
    }
  } catch (error) {
    appendMessage(
      "assistant",
      `Olá, ${session.displayName}! Não foi possível carregar o histórico — você pode continuar a conversa.`,
      "Sistema",
    );
    setStatus(error instanceof Error ? error.message : String(error), "error");
  }
}

function appendMessage(role, text, label) {
  const bubble = document.createElement("div");
  bubble.className = `message message-${role}`;

  const meta = document.createElement("span");
  meta.className = "message-meta";
  meta.textContent = label;

  const body = document.createElement("div");
  body.textContent = text;

  bubble.append(meta, body);
  chatThread.appendChild(bubble);
  chatThread.scrollTop = chatThread.scrollHeight;
}

function renderFacts(facts) {
  factsList.innerHTML = "";

  if (!facts || facts.length === 0) {
    const empty = document.createElement("li");
    empty.className = "facts-empty";
    empty.textContent = "Nenhum fato ativo ainda.";
    factsList.appendChild(empty);
    return;
  }

  for (const fact of facts) {
    const item = document.createElement("li");
    item.className = "fact-item";

    if (fact.category) {
      const cat = document.createElement("span");
      cat.className = "fact-category";
      cat.textContent = fact.category;
      item.appendChild(cat);
    }

    const text = document.createElement("div");
    text.textContent = fact.fact;
    item.appendChild(text);
    factsList.appendChild(item);
  }
}

function formatDebugSnapshot(debug) {
  if (!debug) {
    return "—";
  }

  const lines = [
    `User: ${debug.userLogin ?? "—"}`,
    `Intent: ${debug.intent}`,
    `Stage: ${debug.conversationStage ?? "—"}`,
    `Completed orders: ${debug.completedOrdersCount ?? 0}`,
    `Used short-term memory: ${debug.usedShortTermMemory}`,
    `Used long-term memory: ${debug.usedLongTermMemory}`,
    `Used RAG: ${debug.usedRag}`,
    `Risk level: ${debug.riskLevel}`,
  ];

  if (debug.draftOrder?.length) {
    lines.push("Draft order:");
    for (const item of debug.draftOrder) {
      const qty = item.quantity > 1 ? ` x${item.quantity}` : "";
      lines.push(`  - ${item.name}${qty}`);
    }
  }

  if (debug.retrievedDocs?.length) {
    lines.push("Retrieved docs:");
    for (const doc of debug.retrievedDocs) {
      lines.push(`  - ${doc}`);
    }
  }

  if (debug.savedFacts?.length) {
    lines.push("Saved facts (turn):");
    for (const fact of debug.savedFacts) {
      lines.push(`  - ${fact}`);
    }
  }

  if (debug.toolsInvoked?.length) {
    lines.push("Tools:");
    for (const tool of debug.toolsInvoked) {
      const suffix = tool.invoked
        ? "(invoked)"
        : `(skipped${tool.reason ? ` — ${tool.reason}` : ""})`;
      lines.push(`  - ${tool.tool} ${suffix}`);
    }
  }

  return lines.join("\n");
}

function updateDebugPanel(debug) {
  const show = debugToggle.checked;
  debugPanel.classList.toggle("hidden", !show);
  mainEl?.classList.toggle("main--debug", show);
  if (show && debug) {
    debugContent.textContent = formatDebugSnapshot(debug);
  } else if (show) {
    debugContent.textContent = "Envie uma mensagem com debug ligado.";
  }
}

async function apiPost(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail =
      typeof data.details === "string"
        ? data.details
        : data.error ?? response.statusText;
    throw new Error(detail);
  }

  return data;
}

async function apiGet(path) {
  const response = await fetch(path);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error ?? response.statusText);
  }

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

function setLoggedInUi() {
  if (!session) {
    sessionInfo.textContent = "Não conectado";
    sessionInfo.classList.remove("session-info--active");
    messageInput.disabled = true;
    sendBtn.disabled = true;
    loginBtn.hidden = false;
    logoutBtn.hidden = true;
    loginInput.disabled = false;
    return;
  }

  sessionInfo.textContent = `${session.displayName} (${session.loginName})`;
  sessionInfo.classList.add("session-info--active");
  messageInput.disabled = false;
  sendBtn.disabled = false;
  loginBtn.hidden = true;
  logoutBtn.hidden = false;
  loginInput.disabled = true;
  messageInput.focus();
}

function handleLogout() {
  clearSession();
  loginInput.value = "";
  showLoggedOutPlaceholder();
  renderFacts([]);
  updateDebugPanel(null);
  setLoggedInUi();
  setStatus("Desconectado.");
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

    await loadChatHistory();
    await refreshFacts();
    setLoggedInUi();
    updateDebugPanel(null);
    setStatus("Conectado.");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
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
  if (!message) {
    return;
  }

  appendMessage("user", message, session.displayName);
  messageInput.value = "";
  messageInput.disabled = true;
  sendBtn.disabled = true;
  setStatus("Aguardando resposta…", "busy");

  try {
    const data = await apiPost("/api/chat", {
      userId: session.userId,
      message,
      debug: debugToggle.checked,
    });

    appendMessage("assistant", data.reply, "Assistente");
    updateDebugPanel(data.debug ?? null);
    await refreshFacts();
    setStatus("Pronto.");
  } catch (error) {
    appendMessage(
      "assistant",
      "Não foi possível processar sua mensagem. Verifique OPENAI_API_KEY, Chroma (`chroma run` + `npm run seed:kb`) e tente de novo.",
      "Erro",
    );
    setStatus(error instanceof Error ? error.message : String(error), "error");
  } finally {
    messageInput.disabled = false;
    sendBtn.disabled = false;
    messageInput.focus();
  }
}

function init() {
  debugToggle.addEventListener("change", () => {
    updateDebugPanel(null);
  });

  loginBtn.addEventListener("click", handleLogin);
  logoutBtn.addEventListener("click", handleLogout);
  loginInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleLogin();
    }
  });

  chatForm.addEventListener("submit", handleSendMessage);

  const stored = loadSessionFromStorage();
  if (stored) {
    session = stored;
    loginInput.value = stored.loginName;
    setLoggedInUi();
    loadChatHistory().catch((error) => {
      setStatus(error instanceof Error ? error.message : String(error), "error");
    });
    refreshFacts().catch((error) => {
      setStatus(error instanceof Error ? error.message : String(error), "error");
    });
  } else {
    showLoggedOutPlaceholder();
    setLoggedInUi();
  }

  updateDebugPanel(null);
}

init();
