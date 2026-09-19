// BGS Context Keeper - Логика "No Context Overflow", перехват отправки и модалка апрува
window.BGS = window.BGS || {};

window.BGS.ContextKeeper = (function () {
  let isSendingInjected = false;
  let isBypassing = false;

  function init() {
    setupInterception();
  }

  /**
   * Настройка перехвата отправки сообщений (клик на кнопку и нажатие Enter)
   */
  function setupInterception() {
    // Перехват клика по кнопке отправки в фазе capture
    document.addEventListener('click', handlePossibleSendClick, true);

    // Перехват клавиши Enter в поле ввода
    document.addEventListener('keydown', handlePossibleEnterKey, true);
  }

  function handlePossibleSendClick(e) {
    if (isSendingInjected || isBypassing) return;

    const target = e.target;
    const sendBtn = target.closest('button.send-button, button[aria-label*="Send"], button[aria-label*="Отправить"], button[mat-icon-button]');
    
    if (sendBtn && isSendButtonActive(sendBtn)) {
      const shouldIntercept = checkNeedsContextInjection();
      if (shouldIntercept) {
        e.preventDefault();
        e.stopImmediatePropagation();
        triggerContextFlow();
      } else {
        window.BGS.Store.incrementTurnCount();
      }
    }
  }

  function handlePossibleEnterKey(e) {
    if (isSendingInjected || isBypassing) return;

    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      const input = window.BGS.Injector.getInputField();
      if (input && (input === e.target || input.contains(e.target))) {
        const text = window.BGS.Injector.getInputText();
        if (text.length > 0) {
          const shouldIntercept = checkNeedsContextInjection();
          if (shouldIntercept) {
            e.preventDefault();
            e.stopImmediatePropagation();
            triggerContextFlow();
          } else {
            window.BGS.Store.incrementTurnCount();
          }
        }
      }
    }
  }

  function isSendButtonActive(btn) {
    if (btn.disabled) return false;
    const ariaDisabled = btn.getAttribute('aria-disabled');
    return ariaDisabled !== 'true';
  }

  /**
   * Проверяет, подошло ли время для обновления контекста
   */
  function checkNeedsContextInjection() {
    const settings = window.BGS.Store.getSettings();
    if (!settings.noContextOverflow) return false;

    const count = window.BGS.Store.getTurnCount();
    return count >= settings.intervalTurns;
  }

  /**
   * Запуск процесса обновления контекста (с модалкой апрува или авто)
   */
  function triggerContextFlow(forceManual = false) {
    const settings = window.BGS.Store.getSettings();
    const count = window.BGS.Store.getTurnCount();

    if (settings.requireApproval && !forceManual) {
      showApprovalModal(count, settings.intervalTurns);
    } else {
      executeInjectionAndSend();
    }
  }

  /**
   * Модальное окно подтверждения (Approve Modal)
   */
  function showApprovalModal(currentCount, interval) {
    const existing = document.getElementById('bgs-approval-modal');
    if (existing) existing.remove();

    const history = window.BGS.Parser.extractConversationHistory();
    const historyCount = history.length;

    const modal = document.createElement('div');
    modal.id = 'bgs-approval-modal';
    modal.className = 'bgs-modal-overlay bgs-injected';
    modal.innerHTML = `
      <div class="bgs-modal-card">
        <div class="bgs-modal-header">
          <div class="bgs-modal-title-group">
            <span class="bgs-modal-icon">🧠</span>
            <h3 class="bgs-modal-title">Обновить память диалога?</h3>
          </div>
          <span class="bgs-modal-badge">BGS No Context Overflow</span>
        </div>
        
        <div class="bgs-modal-body">
          <p class="bgs-modal-desc">
            В чате накопилось <strong>${currentCount}</strong> сообщений (порог: ${interval}). 
            Веб-интерфейс Gemini часто обрезает историю ранних сообщений.
          </p>
          <div class="bgs-modal-stats">
            <span>Обнаружено сообщений в DOM: <strong>${historyCount}</strong></span>
            <span>Режим вставки: <strong>Скрытый (чистый чат)</strong></span>
          </div>
          <p class="bgs-modal-note">
            BGS бесшовно упакует хронологию диалога в запрос. Сама встройка будет автоматически скрыта из вашего пузыря сообщений.
          </p>
          <label class="bgs-modal-checkbox">
            <input type="checkbox" id="bgs-auto-approve-chk">
            <span>Включать контекст автоматически в будущем (без лишних вопросов)</span>
          </label>
        </div>

        <div class="bgs-modal-actions">
          <button class="bgs-btn bgs-btn-secondary" id="bgs-modal-skip-btn" type="button">
            Отправить как есть
          </button>
          <button class="bgs-btn bgs-btn-primary" id="bgs-modal-approve-btn" type="button">
            🚀 Обновить контекст и отправить
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Слушатели событий модалки
    const approveBtn = modal.querySelector('#bgs-modal-approve-btn');
    const skipBtn = modal.querySelector('#bgs-modal-skip-btn');
    const autoChk = modal.querySelector('#bgs-auto-approve-chk');

    approveBtn.addEventListener('click', () => {
      if (autoChk.checked) {
        window.BGS.Store.saveSettings({ requireApproval: false });
      }
      modal.remove();
      executeInjectionAndSend();
    });

    skipBtn.addEventListener('click', () => {
      modal.remove();
      sendWithoutInjection();
    });
  }

  /**
   * Сбор контекста, упаковка и отправка
   */
  function executeInjectionAndSend() {
    try {
      const settings = window.BGS.Store.getSettings();
      const history = window.BGS.Parser.extractConversationHistory();
      const currentInputText = window.BGS.Injector.getInputText();
      const promptText = currentInputText || 'Продолжай диалог с учетом контекста выше.';
      window.BGS.Injector.setLastCleanPrompt(currentInputText || '🔄 [Обновление памяти диалога]');

    let fullPrompt = promptText;

    if (history.length > 0) {
      const mode = settings.memoryMode || 'smart';
      const contextBlock = window.BGS.Parser.formatContextPrompt(history, mode);
      fullPrompt = `${contextBlock}\n### Запрос пользователя:\n${promptText}`;
    }

    isSendingInjected = true;
    window.BGS.Injector.setInputText(fullPrompt);

    // Сбрасываем счетчик и обновляем UI
    window.BGS.Store.resetTurnCount();

    // Небольшой таймаут для полной синхронизации состояния
    setTimeout(() => {
      window.BGS.Injector.triggerSend();
      showToast('🧠 Контекст диалога успешно внедрен!');
      setTimeout(() => {
        isSendingInjected = false;
      }, 500);
    }, 150);
  } catch (err) {
    console.error('[BGS] Injection error:', err);
    isSendingInjected = false;
  }
}

  /**
   * Отправка сообщения без внедрения контекста
   */
  function sendWithoutInjection() {
    isBypassing = true;
    window.BGS.Store.incrementTurnCount();
    window.BGS.Injector.triggerSend();
    setTimeout(() => {
      isBypassing = false;
    }, 500);
  }

  /**
   * Всплывающее уведомление Toast
   */
  function showToast(message, type = 'success') {
    const existing = document.querySelector('.bgs-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `bgs-toast bgs-toast-${type} bgs-injected`;
    toast.innerHTML = `<span>${message}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('bgs-toast-show');
    }, 10);

    setTimeout(() => {
      toast.classList.remove('bgs-toast-show');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  return {
    init,
    triggerContextFlow,
    executeInjectionAndSend,
    showToast
  };
})();
