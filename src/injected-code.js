/* eslint-disable no-undef */
/* eslint-disable max-len */

document.addEventListener('DOMContentLoaded', () => {
  let cssContent = [];
  let previousConfigString = '';

  function throttle(func, delay) {
    let lastCall = 0;
    let timeoutId;

    return function(...args) {
      const now = new Date().getTime();

      if (now - lastCall < delay) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          lastCall = now;
          func(...args);
        }, delay - (now - lastCall));
      } else {
        lastCall = now;
        func(...args);
      }
    };
  }

  function updateConfig() {
    const statusBar = document.getElementById('bartag.custom-css-hot-reload');

    if (!statusBar) {
      return;
    }
    const airaLabel = statusBar.getAttribute('aria-label');
    const label = airaLabel?.split(', ');
    const [, ...restConfigString] = label;
    const configString = restConfigString.join(', ');

    if (!configString) {
      return;
    }

    if (configString !== previousConfigString) {
      try {
        cssContent = JSON.parse(configString);
        quickPatchCss(cssContent);
        previousConfigString = configString;
        console.log('📄 Updated config for custom.');
      } catch (error) {
        console.log('error:', error);
      }
    }
  }

  const throttledUpdateConfig = throttle(updateConfig, 200);

  function quickPatchCss(cssContent) {
    for (const id in cssContent) {
      const style = cssContent[id];
      const styleTag = document.getElementById(id);

      if (!styleTag) {
        return;
      }
      styleTag.innerHTML = style;
      console.log('✅ Css switched');
    }
  }

  throttledUpdateConfig();

  const observer = new MutationObserver(() => {
    throttledUpdateConfig();
  });

  setTimeout(() => {
    const statusBarElement = document.getElementsByClassName('statusbar')[0];

    if (statusBarElement) {
      observer.observe(statusBarElement, { childList: true, subtree: true });
      console.log('👀 MutationObserver initialized to track changes in the status bar.');
    }
  }, 1000);
});
