// =====================================================
// 1) App State (data we keep in memory while chat runs)
// =====================================================
let localUserName = "";
let localUserRole = ""; // "host" or "guest"
let remoteUserName = "";

let localPeer = null; // PeerJS instance for this browser tab
let activeConnection = null; // Active chat connection to the other user

// =====================================================
// 2) DOM References (all HTML elements we interact with)
// =====================================================
const startModal = document.getElementById("modal");
const nameInput = document.getElementById("userName");
const nameRequiredMessage = document.getElementById("nameRequiredMessage");
const hostRoleButton = document.getElementById("hostBtn");
const guestRoleButton = document.getElementById("guestBtn");

const greetingText = document.getElementById("greetingTitle");
const onlineNameTop = document.getElementById("onlineName1");
const onlineNameBottom = document.getElementById("onlineName2");
const onlineDotTop = document.getElementById("onlineDot1");
const onlineDotBottom = document.getElementById("onlineDot2");

const hostJoinCodeSection = document.getElementById("hostSection");
const guestJoinCodeSection = document.getElementById("guestSection");

const joinCodeText = document.getElementById("peerId");
const copyJoinCodeButton = document.getElementById("copyPeerId");
const joinCodeInput = document.getElementById("peerInput");
const joinChatButton = document.getElementById("joinBtn");

const chatMessagesContainer = document.getElementById("chatBox");
const messageTextInput = document.getElementById("messageInput");
const sendMessageButton = document.getElementById("sendBtn");

// Sound that the receiver hears when a new message arrives
const incomingMessageSound = new Audio("./assets/pop-sound.wav");
incomingMessageSound.preload = "auto";

// =====================================================
// 3) Small Utility Helpers
// =====================================================

// Create a short random 8-character code (host join code)
function createShortJoinCode() {
  return Math.random().toString(36).substr(2, 8);
}

// Return a UTC/GMT time label like "12:35 GMT"
function getCurrentGmtTimeLabel() {
  const now = new Date();
  const hours = String(now.getUTCHours()).padStart(2, "0");
  const minutes = String(now.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes} GMT`;
}

// Play "new message" sound for incoming messages
function playIncomingSound() {
  incomingMessageSound.currentTime = 0;
  incomingMessageSound.play().catch(() => {
    // Ignore autoplay errors silently
  });
}

// Return trimmed name only if user typed something
function getValidatedName() {
  const typedName = nameInput.value.trim();
  if (!typedName) {
    nameRequiredMessage.classList.add("visible");
    return null;
  }

  nameRequiredMessage.classList.remove("visible");
  return typedName;
}

// =====================================================
// 4) Header + Presence UI
// =====================================================

// Show/hide each online row and toggle the green dots
function setOnlineRows(topText, topActive, bottomText, bottomActive) {
  const topRow = onlineNameTop.parentElement;
  const bottomRow = onlineNameBottom.parentElement;

  onlineNameTop.textContent = topText || "";
  onlineNameBottom.textContent = bottomText || "";

  onlineDotTop.classList.toggle("active", Boolean(topActive && topText));
  onlineDotBottom.classList.toggle("active", Boolean(bottomActive && bottomText));

  topRow.style.display = topText ? "flex" : "none";
  bottomRow.style.display = bottomText ? "flex" : "none";
}

// Update online panel based on connection state
function refreshOnlinePanel(isConnected) {
  const localUserLine = `${localUserName} is online`;

  // If connected and we know remote name, show both users
  if (isConnected && remoteUserName) {
    setOnlineRows(`${remoteUserName} is online`, true, localUserLine, true);
    return;
  }

  // Otherwise show only the local user
  setOnlineRows(localUserLine, true, "", false);
}

// Update header greeting: "Hello, Pedro!"
function updateGreetingTitle() {
  greetingText.textContent = `Hello, ${localUserName}!`;
}

// =====================================================
// 5) Message Rendering
// =====================================================

// Render one chat message with metadata line above the bubble
function renderMessage(messageText, side, senderName) {
  const messageWrapper = document.createElement("div");
  messageWrapper.className = `message-item ${
    side === "me" ? "message-item-me" : "message-item-other"
  }`;

  const metaLine = document.createElement("div");
  metaLine.className = "message-meta";
  metaLine.textContent = `${senderName} | ${getCurrentGmtTimeLabel()}`;

  const bubble = document.createElement("div");
  bubble.className = `bubble ${side === "me" ? "me" : "other"}`;
  bubble.textContent = messageText;

  messageWrapper.appendChild(metaLine);
  messageWrapper.appendChild(bubble);
  chatMessagesContainer.appendChild(messageWrapper);

  // Keep latest message visible
  chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

// =====================================================
// 6) Connection Lifecycle (PeerJS)
// =====================================================

// Called when data connection is open
function onConnectionOpen() {
  refreshOnlinePanel(true);

  // Send our name so the other side can show presence + message labels
  activeConnection.send({ type: "name", name: localUserName });
}

// Handle any message received from peer
function handleIncomingData(payload) {
  // New format (objects)
  if (typeof payload === "object") {
    if (payload.type === "name") {
      remoteUserName = payload.name;
      refreshOnlinePanel(Boolean(activeConnection && activeConnection.open));
      return;
    }

    if (payload.type === "message") {
      renderMessage(payload.text, "them", payload.name || remoteUserName || "Peer");
      playIncomingSound();
    }

    return;
  }

  // Fallback for legacy string payloads
  renderMessage(String(payload), "them", remoteUserName || "Peer");
  playIncomingSound();
}

// Wire all connection events in one place
function registerConnectionEvents() {
  activeConnection.on("open", onConnectionOpen);
  activeConnection.on("data", handleIncomingData);

  activeConnection.on("close", () => {
    remoteUserName = "";
    refreshOnlinePanel(false);
  });
}

// Start PeerJS depending on selected role
function startPeerForSelectedRole() {
  if (localUserRole === "host") {
    const newJoinCode = createShortJoinCode();
    localPeer = new Peer(newJoinCode);

    localPeer.on("open", (readyCode) => {
      joinCodeText.textContent = readyCode;
    });

    // Host waits for guest connection
    localPeer.on("connection", (connection) => {
      activeConnection = connection;
      registerConnectionEvents();
    });

    return;
  }

  // Guest creates peer without fixed id and then connects using host code
  localPeer = new Peer();
}

// =====================================================
// 7) Send / Join / Copy Actions
// =====================================================

function sendTypedMessage() {
  const textToSend = messageTextInput.value.trim();
  if (!textToSend || !activeConnection || !activeConnection.open) {
    return;
  }

  renderMessage(textToSend, "me", localUserName);
  activeConnection.send({ type: "message", name: localUserName, text: textToSend });
  messageTextInput.value = "";
}

function connectGuestToHost() {
  const hostJoinCode = joinCodeInput.value.trim();
  if (!hostJoinCode || !localPeer) {
    return;
  }

  activeConnection = localPeer.connect(hostJoinCode);
  registerConnectionEvents();
}

function copyJoinCodeToClipboard() {
  const code = joinCodeText.textContent;
  if (!code || code === "---") {
    return;
  }

  navigator.clipboard
    .writeText(code)
    .then(() => {
      copyJoinCodeButton.innerHTML = '<i class="bi bi-check2"></i>';
      setTimeout(() => {
        copyJoinCodeButton.innerHTML = '<i class="bi bi-copy"></i>';
      }, 1200);
    })
    .catch(() => {
      // Do nothing on copy error (UI has no status text by design)
    });
}

// =====================================================
// 8) Role Selection (Host / Guest)
// =====================================================

function startAsHost() {
  const validName = getValidatedName();
  if (!validName) {
    return;
  }

  localUserName = validName;
  localUserRole = "host";

  startModal.style.display = "none";
  hostJoinCodeSection.style.display = "flex";
  guestJoinCodeSection.style.display = "none";

  updateGreetingTitle();
  refreshOnlinePanel(false);
  startPeerForSelectedRole();
}

function startAsGuest() {
  const validName = getValidatedName();
  if (!validName) {
    return;
  }

  localUserName = validName;
  localUserRole = "guest";

  startModal.style.display = "none";
  hostJoinCodeSection.style.display = "none";
  guestJoinCodeSection.style.display = "flex";

  updateGreetingTitle();
  refreshOnlinePanel(false);
  startPeerForSelectedRole();
}

// =====================================================
// 9) Event Listeners
// =====================================================

hostRoleButton.onclick = startAsHost;
guestRoleButton.onclick = startAsGuest;
joinChatButton.onclick = connectGuestToHost;
copyJoinCodeButton.onclick = copyJoinCodeToClipboard;
sendMessageButton.onclick = sendTypedMessage;

nameInput.addEventListener("input", () => {
  nameRequiredMessage.classList.remove("visible");
});

messageTextInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    sendTypedMessage();
  }
});
