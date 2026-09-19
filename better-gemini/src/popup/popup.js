// BGS Popup Controller
document.addEventListener('DOMContentLoaded', async () => {
  const popTurns = document.getElementById('pop-turns');
  const popNoOverflow = document.getElementById('pop-no-overflow');
  const popRequireApproval = document.getElementById('pop-require-approval');
  const popOpenGemini = document.getElementById('pop-open-gemini');
  const popResetTurns = document.getElementById('pop-reset-turns');

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    const data = await chrome.storage.local.get(['bgs_settings', 'bgs_chat_counts']);
    const settings = data.bgs_settings || {
      noContextOverflow: true,
      intervalTurns: 15,
      requireApproval: true
    };

    popNoOverflow.checked = settings.noContextOverflow !== false;
    popRequireApproval.checked = settings.requireApproval !== false;
    popTurns.textContent = `0 / ${settings.intervalTurns || 15}`;

    popNoOverflow.addEventListener('change', async () => {
      settings.noContextOverflow = popNoOverflow.checked;
      await chrome.storage.local.set({ bgs_settings: settings });
    });

    popRequireApproval.addEventListener('change', async () => {
      settings.requireApproval = popRequireApproval.checked;
      await chrome.storage.local.set({ bgs_settings: settings });
    });

    popResetTurns.addEventListener('click', async () => {
      await chrome.storage.local.set({ bgs_chat_counts: {} });
      popTurns.textContent = `0 / ${settings.intervalTurns || 15}`;
    });
  }

  popOpenGemini.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url: 'https://gemini.google.com/app' });
    } else {
      window.open('https://gemini.google.com/app', '_blank');
    }
  });
});
