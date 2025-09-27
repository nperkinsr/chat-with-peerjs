// ================================
// Variables to store user info
// ================================
let userName = ""; // The name the user chooses
let userRole = ""; // Either 'host' or 'guest'
let peerName = ""; // The name of the other person in the chat

// ================================
// DOM elements
// ================================
const modal = document.getElementById("modal"); // The modal at the start
const userNameInput = document.getElementById("userName"); // Input field for user name
const hostBtn = document.getElementById("hostBtn"); // Button to choose host
const guestBtn = document.getElementById("guestBtn"); // Button to choose guest

const hostSectionEl = document.getElementById("hostSection"); // Section that shows host UI
const guestSectionEl = document.getElementById("guestSection"); // Section that shows guest UI

const peerIdDisplay = document.getElementById("peerId"); // Element to show host Peer ID
const copyBtn = document.getElementById("copyPeerId"); // Button to copy host Peer ID
const connectionStatus = document.getElementById("connectionStatus"); // Element showing connection status in green

// ================================
// Utility function to generate a short 8-character ID for the host (as in tic tac toe)
// ================================
function generateShortId() {
  // Math.random().toString(36) gives random letters + numbers, substr(2, 8) takes 8 characters skipping '0.'
  // Had to learn about Base-36 | .toString(36) convert that number into base-36 (digits + letters)
  // Starting at index 2 means we skip "0." and grab the next 8 characters
  return Math.random().toString(36).substr(2, 8);
}

// ================================
// Modal buttons: when user chooses host or guest
// ================================
hostBtn.onclick = () => {
  userName = userNameInput.value.trim() || "Host"; // Use entered name or default "Host"
  userRole = "host"; // Set role
  modal.style.display = "none"; // Hides modal
  hostSectionEl.style.display = "block"; // Show host section
  initPeer(); // Start the peer connection
};

guestBtn.onclick = () => {
  userName = userNameInput.value.trim() || "Guest"; // Use entered name or default "Guest"
  userRole = "guest"; // Set role
  modal.style.display = "none"; // Hide modal
  guestSectionEl.style.display = "block"; // Show guest section
  initPeer(); // Start the peer connection
};

// ================================
// Initialize Peer (host or guest)
// ================================
function initPeer() {
  if (userRole === "host") {
    // ================================
    // Host creates a Peer with an ID
    // ================================
    const myPeerId = generateShortId();
    peer = new Peer(myPeerId); // Using PeerJS library

    // When peer is ready, show the ID
    peer.on("open", (id) => {
      peerIdDisplay.textContent = id; // Show the host ID so guest can connect
      copyBtn.style.display = "inline"; // Show copy button
    });

    // When a guest connects
    peer.on("connection", (connection) => {
      conn = connection; // Save the connection object
      conn.on("data", handleData); // Listen for messages from guest
      conn.on("open", () => {
        // When connection fully opens
        showConnectedStatus(); // Show "connected" status
      });
    });
  } else {
    // ================================
    // Guest creates a Peer without ID (host will assign)    ----------------------
    // ================================
    peer = new Peer();
    peer.on("open", () => {
      joinBtn.onclick = () => {
        // When guest clicks "Join"
        const hostId = peerInput.value.trim(); // Get host ID input
        if (!hostId) return alert("Enter host's Peer ID");

        conn = peer.connect(hostId); // Connect to host
        status.textContent = `Connecting to ${hostId}...`;

        conn.on("open", () => {
          showConnectedStatus(); // Show connected status
          status.textContent = `Connected to ${hostId}`;
          setupConnection(); // Optional setup function (your own code)
          conn.send({ type: "name", name: userName }); // Send guest name to host
        });

        conn.on("data", handleData); // Listen for messages from host
      };
    });
  }
}

// ================================
// Copy button: copies host ID to clipboard
// ================================
copyBtn.onclick = () => {
  const peerId = peerIdDisplay.textContent;
  navigator.clipboard
    .writeText(peerId) // Copy text to clipboard
    .then(() => {
      copyBtn.textContent = "Copied!"; // Temporary feedback
      setTimeout(() => {
        copyBtn.textContent = "Copy";
      }, 1500);
    })
    .catch(() => {
      alert("Failed to copy Peer ID."); // Error feedback
    });
};

// ================================
// Send message button
// ================================
sendBtn.onclick = () => {
  const message = messageInput.value.trim(); // Get typed message
  if (!message || !conn) return; // Stop if empty or no connection

  appendMessage(`${userName}: ${message}`, "me"); // Show message in chat
  conn.send({ type: "message", name: userName, text: message }); // Send message to peer
  messageInput.value = ""; // Clear input
};

// ================================
// Function to append a message to chat box
// ================================
function appendMessage(msg, sender) {
  const p = document.createElement("p"); // Create <p> element for message
  let cls = "";

  // Determine CSS class based on sender and role
  if (sender === "me") {
    cls = userRole === "host" ? "message-me-host" : "message-me-guest";
  } else {
    cls = userRole === "host" ? "message-them-host" : "message-them-guest";
  }

  p.className = cls;
  p.textContent = msg; // Add message text
  chatBox.appendChild(p); // Add message to chat box
  chatBox.scrollTop = chatBox.scrollHeight; // Scroll to bottom
}

// ================================
// Show connection status
// ================================
function showConnectedStatus() {
  connectionStatus.textContent = "You are connected!";
  connectionStatus.style.display = "block";
}

// ================================
// Handle incoming data from peer
// ================================
function handleData(data) {
  if (typeof data === "object") {
    // Modern structured messages
    if (data.type === "name") {
      peerName = data.name; // Save peer's name
    } else if (data.type === "message") {
      appendMessage(`${data.name}: ${data.text}`, "them"); // Show message
    }
  } else {
    // Fallback for older string-only messages
    appendMessage(`${peerName}: ${data}`, "them");
  }
}

// ================================
// Allow sending message by pressing Enter
// ================================
messageInput.addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    sendBtn.click(); // Trigger send button click
  }
});
