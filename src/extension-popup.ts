/**
 * Give Me Doc — Extension Popup Script
 *
 * Uses webextension-polyfill for cross-browser (Chrome/Firefox) compatibility.
 */
import browser from 'webextension-polyfill';

const btn = document.getElementById('toggleBtn') as HTMLButtonElement;
const desc = document.querySelector('.desc') as HTMLElement;

btn.addEventListener('click', async () => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    try {
      await browser.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL' });
      window.close();
    } catch {
      desc.textContent = '请先打开 chat.deepseek.com 页面，然后重试。';
    }
  }
});
