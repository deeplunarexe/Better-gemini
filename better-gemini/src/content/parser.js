// BGS Parser - Высокопроизводительное извлечение истории с сохранением Markdown
window.BGS = window.BGS || {};

window.BGS.Parser = (function () {
  /**
   * Быстрое и безопасное извлечение Markdown без зависаний и глубоких рекурсий
   */
  function extractMarkdownFromElement(container) {
    if (!container) return '';

    try {
      const clone = container.cloneNode(true);

      // 1. Удаляем все служебные элементы Gemini (кнопки копирования, озвучки, меню, SVG)
      clone.querySelectorAll('button, svg, mat-icon, .response-footer, .button-container, .bgs-injected').forEach(el => el.remove());

      // 2. Сохраняем блоки кода с указанием языка
      clone.querySelectorAll('pre').forEach(pre => {
        const codeEl = pre.querySelector('code') || pre;
        const langMatch = (codeEl.className || '').match(/language-([a-z0-9_-]+)/i);
        const lang = langMatch ? langMatch[1] : '';
        const codeText = codeEl.textContent || '';
        pre.textContent = `\n\`\`\`${lang}\n${codeText.trim()}\n\`\`\`\n`;
      });

      // 3. Сохраняем инлайн-код
      clone.querySelectorAll('code').forEach(code => {
        if (!code.closest('pre')) {
          code.textContent = ` \`${code.textContent.trim()}\` `;
        }
      });

      // 4. Сохраняем жирный шрифт
      clone.querySelectorAll('strong, b').forEach(b => {
        b.textContent = ` **${b.textContent.trim()}** `;
      });

      // 5. Сохраняем списки
      clone.querySelectorAll('li').forEach(li => {
        li.textContent = `\n- ${li.textContent.trim()}`;
      });

      const raw = clone.innerText || clone.textContent || '';
      return cleanMessageText(raw);
    } catch (e) {
      console.warn('[BGS] Error parsing markdown:', e);
      return cleanMessageText(container.innerText || container.textContent || '');
    }
  }

  /**
   * Очищает текст от служебных меток BGS
   */
  function cleanMessageText(text) {
    if (!text) return '';
    let cleaned = text;
    cleaned = cleaned.replace(/<!--BGS_CONTEXT_START-->[\s\S]*?<!--BGS_CONTEXT_END-->/gi, '');
    cleaned = cleaned.replace(/>\s*###\s*🧠[\s\S]*?### Запрос пользователя:/gi, '');
    cleaned = cleaned.replace(/\[СИСТЕМНЫЙ КОНТЕКСТ ДИАЛОГА[\s\S]*?---/gi, '');
    cleaned = cleaned.replace(/\[BGS MEMORY STATE[\s\S]*?<!--BGS_CONTEXT_END-->/gi, '');
    cleaned = cleaned.replace(/### Запрос пользователя:\s*/gi, '');
    return cleaned.replace(/\n{3,}/g, '\n\n').trim();
  }

  /**
   * Извлекает историю переписки
   */
  function extractConversationHistory() {
    const turns = [];

    const userEls = Array.from(document.querySelectorAll('user-query, [data-test-id="user-query"], .user-query-container'));
    const modelEls = Array.from(document.querySelectorAll('model-response, [data-test-id="model-response"]'));

    // Собираем все сообщения в правильном порядке DOM
    const all = [...userEls.map(el => ({ el, isUser: true })), ...modelEls.map(el => ({ el, isUser: false }))];

    all.sort((a, b) => {
      const pos = a.el.compareDocumentPosition(b.el);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });

    for (const item of all) {
      // Для ответов модели берем основной блок текста, если есть
      const target = item.isUser 
        ? item.el 
        : (item.el.querySelector('.model-response-text, message-content, .response-container-content') || item.el);

      const text = extractMarkdownFromElement(target);
      if (text && text.length > 0) {
        turns.push({
          role: item.isUser ? 'User' : 'Gemini',
          text: text
        });
      }
    }

    return turns;
  }

  /**
   * Умная сжатая выжимка памяти
   */
  function distillMemory(turns) {
    if (!turns || turns.length === 0) return '';

    // 1. Исходная цель (первое сообщение пользователя)
    const firstUser = turns.find(t => t.role === 'User');
    let mainTopic = 'Обсуждение и разработка проекта';
    if (firstUser && firstUser.text) {
      const lines = firstUser.text.split('\n').filter(l => l.trim().length > 0);
      mainTopic = lines[0].trim();
      if (mainTopic.length > 200) {
        mainTopic = mainTopic.substring(0, 195) + '...';
      }
    }

    // 2. Ключевые требования и факты из диалога
    const keyFacts = [];
    turns.slice(0, -2).forEach(turn => {
      const lines = turn.text.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (
          (trimmed.startsWith('- ') || trimmed.startsWith('* ') || /^\d+\.\s/.test(trimmed)) &&
          trimmed.length > 15 && trimmed.length < 200
        ) {
          const cleanFact = trimmed.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '');
          if (!keyFacts.includes(cleanFact) && keyFacts.length < 6) {
            keyFacts.push(cleanFact);
          }
        }
      }
    });

    // 3. Последние 2 реплики для поддержания контекста
    const recentTurns = turns.slice(-2);
    const recentFormatted = recentTurns.map(t => {
      const shortText = t.text.length > 300 ? t.text.substring(0, 295) + '...' : t.text;
      return `> - **${t.role}**: ${shortText.replace(/\n+/g, ' ')}`;
    }).join('\n');

    let factsBlock = '';
    if (keyFacts.length > 0) {
      factsBlock = `> \n> **Ключевые зафиксированные факты и договоренности:**\n` +
        keyFacts.map(f => `> - ${f}`).join('\n') + `\n`;
    }

    return `<!--BGS_CONTEXT_START-->
> ### 🧠 [BGS Память диалога]
> **Тема и исходная цель:** ${mainTopic}
${factsBlock}> 
> **Недавний контекст:**
${recentFormatted}
<!--BGS_CONTEXT_END-->

`;
  }

  function formatContextPrompt(turns, mode = 'smart') {
    if (!turns || turns.length === 0) return '';

    if (mode === 'smart') {
      return distillMemory(turns);
    }

    if (mode === 'window') {
      const windowTurns = turns.slice(-4);
      const lines = windowTurns.map(t => `> **${t.role}**: ${t.text.replace(/\n+/g, '\n> ')}`).join('\n>\n');
      return `<!--BGS_CONTEXT_START-->
> ### 🧠 [BGS Контекстное окно]
>
${lines}
<!--BGS_CONTEXT_END-->

`;
    }

    const lines = turns.slice(-10).map(t => `> **${t.role}**: ${t.text.replace(/\n+/g, '\n> ')}`).join('\n>\n');
    return `<!--BGS_CONTEXT_START-->
> ### 🧠 [BGS Хронология]
>
${lines}
<!--BGS_CONTEXT_END-->

`;
  }

  return {
    extractConversationHistory,
    distillMemory,
    formatContextPrompt,
    cleanMessageText
  };
})();
