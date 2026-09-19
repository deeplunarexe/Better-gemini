// BGS Content Script Orchestrator
(async function initBetterGemini() {
  console.log('%c[BGS] Better Gemini: No Context Overflow Initializing...', 'color: #8b5cf6; font-weight: bold; font-size: 13px;');

  try {
    // 1. Загрузка хранилища и настроек
    await window.BGS.Store.load();

    // 2. Инициализация перехвата контекста и защиты от потери памяти
    window.BGS.ContextKeeper.init();

    // 3. Запуск маскировки внедренного контекста в чате (скрытие шума из DOM)
    window.BGS.Injector.startChatMaskingObserver();

    // 4. Инициализация UI интерфейса (кнопка BGS и панель)
    window.BGS.UI.init();

    // 5. Отслеживание смены чатов и кнопки "Новый чат" для сброса счетчика
    setupChatSwitchTracking();

    console.log('%c[BGS] Better Gemini: No Context Overflow Active! 🚀', 'color: #10b981; font-weight: bold;');
  } catch (err) {
    console.error('[BGS] Initialization error:', err);
  }

  function setupChatSwitchTracking() {
    let lastPath = location.pathname;

    setInterval(() => {
      if (location.pathname !== lastPath) {
        lastPath = location.pathname;
        const newChatId = window.BGS.Store.getCurrentChatId();
        window.BGS.Store.onChatSwitched(newChatId);
      }
    }, 400);

    document.addEventListener('click', (e) => {
      const target = e.target;
      const newChatBtn = target.closest(
        'button[aria-label*="New chat"], button[aria-label*="Новый чат"], a[href="/app"], [data-test-id="new-chat-button"], .new-chat-button, [aria-label*="чат" i]:has(svg)'
      );

      if (newChatBtn) {
        setTimeout(() => {
          window.BGS.Store.onChatSwitched('new_chat');
        }, 50);
      }
    }, true);

    window.addEventListener('popstate', () => {
      const newChatId = window.BGS.Store.getCurrentChatId();
      window.BGS.Store.onChatSwitched(newChatId);
    });
  }
})();
