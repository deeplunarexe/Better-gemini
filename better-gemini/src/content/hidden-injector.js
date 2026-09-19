// BGS Hidden Injector - Безопасная вставка и маскировка без зацикливаний и зависаний
window.BGS = window.BGS || {};

window.BGS.Injector = (function () {
  let lastCleanUserPrompt = '';
  let isMaskingActive = false;

  function setLastCleanPrompt(text) {
    lastCleanUserPrompt = text;
  }

  function getLastCleanPrompt() {
    return lastCleanUserPrompt;
  }

  function getInputField() {
    return (
      document.querySelector('rich-textarea div[contenteditable="true"]') ||
      document.querySelector('div[contenteditable="true"][role="textbox"]') ||
      document.querySelector('.ql-editor') ||
      document.querySelector('div[contenteditable="true"]')
    );
  }

  function getInputText() {
    const input = getInputField();
    if (!input) return '';
    return input.innerText.trim();
  }

  /**
   * Запись текста в поле ввода Gemini
   */
  function setInputText(text) {
    const input = getInputField();
    if (!input) return false;

    isMaskingActive = true;

    try {
      input.focus();

      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(input);
      selection.removeAllRanges();
      selection.addRange(range);

      // Вставляем текст через execCommand
      const success = document.execCommand('insertText', false, text);

      // Фолбэк, если execCommand не сработал
      if (!success || input.innerText.trim().length === 0) {
        input.innerText = text;
      }

      // Диспатч событий для Angular/ProseMirror
      input.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: text }));
      input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    } catch (err) {
      console.warn('[BGS] Error setting input text:', err);
    } finally {
      setTimeout(() => {
        isMaskingActive = false;
      }, 100);
    }

    return true;
  }

  function getSendButton() {
    return (
      document.querySelector('button.send-button') ||
      document.querySelector('button[aria-label*="Send" i]') ||
      document.querySelector('button[aria-label*="Отправить" i]') ||
      document.querySelector('button[aria-label*="Submit" i]') ||
      document.querySelector('button[mat-icon-button][aria-label*="send" i]') ||
      document.querySelector('.send-button-container button') ||
      document.querySelector('rich-textarea ~ button') ||
      document.querySelector('.input-area button:last-child')
    );
  }

  function triggerSend() {
    // Делаем несколько попыток с небольшим интервалом, чтобы дождаться снятия блокировки с кнопки в Angular
    let tries = 0;
    const interval = setInterval(() => {
      tries++;
      const sendBtn = getSendButton();
      const isBtnReady = sendBtn && !sendBtn.disabled && sendBtn.getAttribute('aria-disabled') !== 'true';

      if (isBtnReady) {
        clearInterval(interval);
        sendBtn.click();
        return;
      }

      const input = getInputField();
      if (input) {
        input.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        }));
      }

      if (tries >= 5) {
        clearInterval(interval);
        if (sendBtn) sendBtn.click();
      }
    }, 60);

    return true;
  }

  /**
   * Безопасная маскировка в чате: удаляет блок памяти только из пузыря сообщения пользователя
   */
  function maskContextInChatBubble(element) {
    if (!element || element.dataset.bgsMasked === 'true' || isMaskingActive) return;

    // Защита от обработки поля ввода
    if (element.closest('rich-textarea, .input-area, form, .ql-editor, div[contenteditable="true"]')) {
      return;
    }

    const text = element.textContent || '';
    if (!text.includes('BGS Память') && !text.includes('BGS_CONTEXT_START')) {
      return;
    }

    isMaskingActive = true;
    try {
      element.dataset.bgsMasked = 'true';

      let userClean = lastCleanUserPrompt;
      if (!userClean) {
        if (text.includes('### Запрос пользователя:')) {
          userClean = text.split('### Запрос пользователя:').pop().trim();
        } else if (text.includes('<!--BGS_CONTEXT_END-->')) {
          userClean = text.split('<!--BGS_CONTEXT_END-->').pop().trim();
        }
      }

      const display = userClean || text;
      element.textContent = display;
    } catch (err) {
      console.warn('[BGS] Error masking bubble:', err);
    } finally {
      setTimeout(() => {
        isMaskingActive = false;
      }, 50);
    }
  }

  /**
   * Наблюдатель, строго таргетирующий ТОЛЬКО контейнеры сообщений пользователя в чате
   */
  function startChatMaskingObserver() {
    const observer = new MutationObserver((mutations) => {
      if (isMaskingActive) return;

      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;

          // ИГНОРИРУЕМ ВСЁ, что связано с полем ввода или элементами BGS
          if (node.closest && node.closest('rich-textarea, .input-area, form, #bgs-settings-panel, #bgs-approval-modal')) {
            continue;
          }

          // Ищем только user-query
          const uq = (node.matches && node.matches('user-query, [data-test-id="user-query"], .user-query-container'))
            ? node
            : (node.querySelector ? node.querySelector('user-query, [data-test-id="user-query"], .user-query-container') : null);

          if (uq) {
            maskContextInChatBubble(uq);
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  return {
    getInputField,
    getInputText,
    setInputText,
    getSendButton,
    triggerSend,
    setLastCleanPrompt,
    getLastCleanPrompt,
    maskContextInChatBubble,
    startChatMaskingObserver
  };
})();
