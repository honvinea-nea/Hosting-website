/**
 * Simple live-chat demo for Bloom & Blossom
 * Customer messages stored in localStorage (bb_chat)
 * Admin can read/reply from the same store (demo only)
 */
(function () {
  const CHAT_KEY = 'bb_chat';
  const ADMIN_REPLIES = [
    "Thank you for reaching out! How can we help with your order today?",
    "Our florists are happy to help. What arrangement are you looking for?",
    "We offer same-day delivery in select areas. Would you like details?",
    "Of course! You can add a gift message at checkout.",
    "We recommend our Classic Red Rose Bouquet for special occasions.",
    "Thank you! Is there anything else we can assist with?"
  ];

  function getMessages() {
    try {
      return JSON.parse(localStorage.getItem(CHAT_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function saveMessages(msgs) {
    localStorage.setItem(CHAT_KEY, JSON.stringify(msgs.slice(-100)));
  }

  function formatTime(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function renderMessages() {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    const msgs = getMessages();
    if (!msgs.length) {
      container.innerHTML = `
        <div class="chat-msg admin">
          <div>Hi there! Welcome to Bloom & Blossom. How can we help you today?</div>
          <div class="time">${formatTime(new Date().toISOString())}</div>
        </div>`;
      return;
    }

    container.innerHTML = msgs.map(m => `
      <div class="chat-msg ${m.from}">
        <div>${escapeHtml(m.text)}</div>
        <div class="time">${formatTime(m.at)}</div>
      </div>
    `).join('');

    container.scrollTop = container.scrollHeight;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function sendMessage(text) {
    if (!text.trim()) return;
    const msgs = getMessages();
    msgs.push({
      from: 'user',
      text: text.trim(),
      at: new Date().toISOString()
    });
    saveMessages(msgs);
    renderMessages();

    // Simulated admin reply after a short delay
    setTimeout(() => {
      const reply = ADMIN_REPLIES[Math.floor(Math.random() * ADMIN_REPLIES.length)];
      const updated = getMessages();
      updated.push({
        from: 'admin',
        text: reply,
        at: new Date().toISOString()
      });
      saveMessages(updated);
      renderMessages();
      updateBadge(0);
    }, 900 + Math.random() * 1200);
  }

  function updateBadge(count) {
    const badge = document.getElementById('chat-badge');
    if (badge) {
      if (count > 0) {
        badge.style.display = 'flex';
        badge.textContent = count > 9 ? '9+' : count;
      } else {
        badge.style.display = 'none';
      }
    }
  }

  function initChat() {
    const panel = document.getElementById('chat-panel');
    const toggle = document.getElementById('chat-toggle');
    const closeBtn = document.getElementById('chat-close');
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send');

    if (!panel) return;

    // Create toggle if missing
    if (!toggle) {
      const widget = document.querySelector('.chat-widget');
      if (widget) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'chat-toggle';
        btn.id = 'chat-toggle';
        btn.setAttribute('aria-label', 'Open chat');
        btn.innerHTML = `
          <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
          </svg>
          <span id="chat-badge"></span>`;
        widget.appendChild(btn);
      }
    }

    const openToggle = document.getElementById('chat-toggle');

    function openPanel() {
      panel.classList.add('open');
      renderMessages();
      if (input) input.focus();
      updateBadge(0);
    }

    function closePanel() {
      panel.classList.remove('open');
    }

    if (openToggle) {
      openToggle.addEventListener('click', () => {
        if (panel.classList.contains('open')) closePanel();
        else openPanel();
      });
    }

    if (closeBtn) closeBtn.addEventListener('click', closePanel);

    function handleSend() {
      if (!input) return;
      const text = input.value;
      input.value = '';
      sendMessage(text);
    }

    if (sendBtn) sendBtn.addEventListener('click', handleSend);
    if (input) {
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSend();
        }
      });
    }

    // Initial render if panel already open
    if (panel.classList.contains('open')) renderMessages();
  }

  document.addEventListener('DOMContentLoaded', initChat);
})();
