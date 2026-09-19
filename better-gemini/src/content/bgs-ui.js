// BGS UI - Кнопка BGS и панель управления No Context Overflow
window.BGS = window.BGS || {};

window.BGS.UI = (function () {
  function init() {
    startUiObserver();
    injectHeaderButton();

    window.BGS.Store.onChange(() => {
      updateButtonState();
      updatePanelState();
    });
  }

  function startUiObserver() {
    const observer = new MutationObserver(() => {
      injectHeaderButton();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Кнопка BGS в верхней панели (счетчик сообщений + перетаскивание)
   */
  function injectHeaderButton() {
    if (document.getElementById('bgs-header-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'bgs-header-btn';
    btn.type = 'button';
    btn.className = 'bgs-header-btn bgs-injected';
    btn.setAttribute('title', 'Better Gemini: No Context Overflow (Кликните для настроек)');

    const count = window.BGS.Store.getTurnCount();
    const settings = window.BGS.Store.getSettings();

    btn.innerHTML = `
      <span class="bgs-logo-glow">⚡</span>
      <span class="bgs-logo-title">BGS</span>
      <span class="bgs-pill-divider"></span>
      <span class="bgs-pill-count" id="bgs-pill-count-text">🧠 ${count}/${settings.intervalTurns}</span>
    `;

    document.body.appendChild(btn);

    // Восстановление позиции
    const savedPos = localStorage.getItem('bgs_btn_pos');
    if (savedPos) {
      try {
        const { top, right, left } = JSON.parse(savedPos);
        if (top !== undefined) btn.style.top = top;
        if (right !== undefined) btn.style.right = right;
        if (left !== undefined) btn.style.left = left;
      } catch (e) {}
    }

    makeDraggable(btn, (pos) => {
      localStorage.setItem('bgs_btn_pos', JSON.stringify(pos));
    });

    btn.addEventListener('click', (e) => {
      if (btn.dataset.isDragging === 'true') return;
      toggleSettingsPanel();
    });

    updateButtonState();
  }

  function updateButtonState() {
    const countText = document.getElementById('bgs-pill-count-text');
    if (!countText) return;

    const count = window.BGS.Store.getTurnCount();
    const settings = window.BGS.Store.getSettings();
    countText.textContent = `🧠 ${count}/${settings.intervalTurns}`;

    const btn = document.getElementById('bgs-header-btn');
    if (btn) {
      if (count >= settings.intervalTurns) {
        btn.classList.add('bgs-btn-alert');
      } else {
        btn.classList.remove('bgs-btn-alert');
      }
    }
  }

  function updatePanelState() {
    const countEl = document.getElementById('bgs-panel-turn-display');
    const progEl = document.getElementById('bgs-panel-turn-progress');
    if (!countEl || !progEl) return;

    const count = window.BGS.Store.getTurnCount();
    const settings = window.BGS.Store.getSettings();
    countEl.textContent = `${count} / ${settings.intervalTurns}`;

    const pct = Math.min(100, Math.round((count / settings.intervalTurns) * 100));
    progEl.style.width = `${pct}%`;
  }

  function makeDraggable(el, onSave) {
    let startX, startY, origX, origY;
    let hasMoved = false;

    el.addEventListener('mousedown', (e) => {
      startX = e.clientX;
      startY = e.clientY;
      const rect = el.getBoundingClientRect();
      origX = rect.left;
      origY = rect.top;
      hasMoved = false;
      el.dataset.isDragging = 'false';

      function onMouseMove(moveEvent) {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;

        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          hasMoved = true;
          el.dataset.isDragging = 'true';
        }

        if (hasMoved) {
          el.style.left = `${origX + dx}px`;
          el.style.top = `${origY + dy}px`;
          el.style.right = 'auto';
        }
      }

      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        if (hasMoved && onSave) {
          onSave({ top: el.style.top, left: el.style.left, right: 'auto' });
          setTimeout(() => {
            el.dataset.isDragging = 'false';
          }, 50);
        }
      }

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  /**
   * Боковая панель настроек No Context Overflow
   */
  function toggleSettingsPanel() {
    let panel = document.getElementById('bgs-settings-panel');
    if (panel) {
      panel.classList.toggle('bgs-panel-open');
      return;
    }

    const settings = window.BGS.Store.getSettings();
    const count = window.BGS.Store.getTurnCount();
    const pct = Math.min(100, Math.round((count / settings.intervalTurns) * 100));

    panel = document.createElement('div');
    panel.id = 'bgs-settings-panel';
    panel.className = 'bgs-side-panel bgs-injected';
    panel.innerHTML = `
      <div class="bgs-panel-header">
        <div class="bgs-panel-title-wrap">
          <span class="bgs-panel-glow">⚡</span>
          <h3>Better Gemini: No Context Overflow</h3>
        </div>
        <button class="bgs-panel-close-btn" type="button" title="Закрыть">✕</button>
      </div>

      <div class="bgs-panel-content">
        <div class="bgs-setting-section bgs-highlight-card">
          <div class="bgs-card-top">
            <div class="bgs-section-title">🧠 Память диалога</div>
            <span class="bgs-status-badge ${settings.noContextOverflow ? 'badge-on' : 'badge-off'}">
              ${settings.noContextOverflow ? 'Активно' : 'Выкл'}
            </span>
          </div>

          <div class="bgs-counter-dashboard">
            <div class="bgs-dash-labels">
              <span>Сообщений в текущем чате:</span>
              <strong id="bgs-panel-turn-display">${count} / ${settings.intervalTurns}</strong>
            </div>
            <div class="bgs-progress-track">
              <div class="bgs-progress-fill" id="bgs-panel-turn-progress" style="width: ${pct}%;"></div>
            </div>
          </div>

          <div class="bgs-actions-row">
            <button class="bgs-btn bgs-btn-primary bgs-btn-block" id="bgs-panel-force-context">
              🔄 Встроить контекст прямо сейчас
            </button>
          </div>

          <div class="bgs-divider"></div>

          <label class="bgs-switch-label">
            <span>Включить защиту памяти</span>
            <input type="checkbox" id="bgs-set-no-overflow" ${settings.noContextOverflow ? 'checked' : ''}>
          </label>

          <div class="bgs-field-row">
            <span>Частота обновления (сообщений):</span>
            <select id="bgs-set-interval">
              <option value="5" ${settings.intervalTurns === 5 ? 'selected' : ''}>Каждые 5 сообщений</option>
              <option value="10" ${settings.intervalTurns === 10 ? 'selected' : ''}>Каждые 10 сообщений</option>
              <option value="15" ${settings.intervalTurns === 15 ? 'selected' : ''}>Каждые 15 сообщений (Рекомендуется)</option>
              <option value="20" ${settings.intervalTurns === 20 ? 'selected' : ''}>Каждые 20 сообщений</option>
              <option value="30" ${settings.intervalTurns === 30 ? 'selected' : ''}>Каждые 30 сообщений</option>
            </select>
          </div>

          <label class="bgs-switch-label">
            <span>Запрашивать подтверждение (Approve)</span>
            <input type="checkbox" id="bgs-set-approval" ${settings.requireApproval ? 'checked' : ''}>
          </label>

          <div class="bgs-field-row">
            <span>Формат передачи памяти:</span>
            <select id="bgs-set-memory-mode">
              <option value="smart" ${(settings.memoryMode || 'smart') === 'smart' ? 'selected' : ''}>🌟 Умная выжимка (Markdown: Цель + Факты)</option>
              <option value="window" ${settings.memoryMode === 'window' ? 'selected' : ''}>🪟 Скользящее окно (последние 6 сообщений)</option>
              <option value="full" ${settings.memoryMode === 'full' ? 'selected' : ''}>📜 Полный лог переписки</option>
            </select>
          </div>

          <button class="bgs-btn bgs-btn-sm bgs-btn-secondary" id="bgs-reset-turns-btn" style="margin-top: 8px;">
            Сбросить счетчик текущего чата в 0
          </button>
        </div>

        <div class="bgs-panel-footer">
          <span>Better Gemini • No Context Overflow v1.4.0 • Stealth Mode Active</span>
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    setTimeout(() => panel.classList.add('bgs-panel-open'), 10);

    panel.querySelector('.bgs-panel-close-btn').addEventListener('click', () => {
      panel.classList.remove('bgs-panel-open');
    });

    panel.querySelector('#bgs-panel-force-context').addEventListener('click', () => {
      panel.classList.remove('bgs-panel-open');
      window.BGS.ContextKeeper.triggerContextFlow(false);
    });

    panel.querySelector('#bgs-set-no-overflow').addEventListener('change', (e) => {
      window.BGS.Store.saveSettings({ noContextOverflow: e.target.checked });
      const badge = panel.querySelector('.bgs-status-badge');
      if (badge) {
        badge.className = `bgs-status-badge ${e.target.checked ? 'badge-on' : 'badge-off'}`;
        badge.textContent = e.target.checked ? 'Активно' : 'Выкл';
      }
    });

    panel.querySelector('#bgs-set-interval').addEventListener('change', (e) => {
      window.BGS.Store.saveSettings({ intervalTurns: parseInt(e.target.value, 10) });
      updateButtonState();
      updatePanelState();
    });

    panel.querySelector('#bgs-set-approval').addEventListener('change', (e) => {
      window.BGS.Store.saveSettings({ requireApproval: e.target.checked });
    });

    panel.querySelector('#bgs-set-memory-mode').addEventListener('change', (e) => {
      window.BGS.Store.saveSettings({ memoryMode: e.target.value });
    });

    panel.querySelector('#bgs-reset-turns-btn').addEventListener('click', () => {
      window.BGS.Store.resetTurnCount();
      updateButtonState();
      updatePanelState();
      window.BGS.ContextKeeper.showToast('Счетчик сообщений сброшен в 0');
    });
  }

  return {
    init,
    toggleSettingsPanel
  };
})();
