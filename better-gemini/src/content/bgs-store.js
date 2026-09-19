// BGS Store - Управление состоянием и раздельными счетчиками для No Context Overflow
window.BGS = window.BGS || {};

window.BGS.Store = (function () {
  const DEFAULT_SETTINGS = {
    noContextOverflow: true,
    intervalTurns: 15,
    requireApproval: true,
    memoryMode: 'smart' // 'smart' (Умная выжимка), 'window' (последние 6 сообщений), 'full' (полный лог)
  };

  let currentSettings = { ...DEFAULT_SETTINGS };
  let chatTurnCounts = {}; // { [chatId]: count }
  let activeChatId = 'new_chat';

  function getCurrentChatId() {
    const match = location.pathname.match(/\/app\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : 'new_chat';
  }

  async function load() {
    try {
      activeChatId = getCurrentChatId();
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const data = await chrome.storage.local.get(['bgs_settings', 'bgs_chat_counts']);
        if (data.bgs_settings) {
          currentSettings = { ...DEFAULT_SETTINGS, ...data.bgs_settings };
        }
        if (data.bgs_chat_counts && typeof data.bgs_chat_counts === 'object') {
          chatTurnCounts = data.bgs_chat_counts;
        }
      }
    } catch (err) {
      console.warn('[BGS] Error loading storage:', err);
    }
  }

  async function saveSettings(newSettings) {
    currentSettings = { ...currentSettings, ...newSettings };
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ bgs_settings: currentSettings });
      }
    } catch (err) {}
    dispatchUpdate();
  }

  function getSettings() {
    return { ...currentSettings };
  }

  /**
   * Возвращает число сообщений для текущего чата
   */
  function getTurnCount() {
    activeChatId = getCurrentChatId();
    if (activeChatId === 'new_chat') {
      return 0;
    }

    if (window.BGS.Parser) {
      const history = window.BGS.Parser.extractConversationHistory();
      if (history.length === 0) {
        chatTurnCounts[activeChatId] = 0;
        return 0;
      }
    }

    return chatTurnCounts[activeChatId] || 0;
  }

  function incrementTurnCount() {
    activeChatId = getCurrentChatId();
    const current = getTurnCount();
    chatTurnCounts[activeChatId] = current + 1;

    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ bgs_chat_counts: chatTurnCounts });
      }
    } catch (e) {}

    dispatchUpdate();
    return chatTurnCounts[activeChatId];
  }

  function resetTurnCount() {
    activeChatId = getCurrentChatId();
    chatTurnCounts[activeChatId] = 0;

    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ bgs_chat_counts: chatTurnCounts });
      }
    } catch (e) {}

    dispatchUpdate();
  }

  function onChatSwitched(newChatId) {
    activeChatId = newChatId || getCurrentChatId();
    if (activeChatId === 'new_chat') {
      chatTurnCounts['new_chat'] = 0;
    }
    dispatchUpdate();
  }

  const listeners = [];
  function onChange(fn) {
    listeners.push(fn);
  }

  function dispatchUpdate() {
    const currentCount = getTurnCount();
    listeners.forEach(fn => {
      try {
        fn({ settings: currentSettings, turnCount: currentCount });
      } catch (e) {
        console.error('[BGS] Listener error:', e);
      }
    });
  }

  return {
    load,
    getSettings,
    saveSettings,
    getTurnCount,
    incrementTurnCount,
    resetTurnCount,
    getCurrentChatId,
    onChatSwitched,
    onChange
  };
})();
