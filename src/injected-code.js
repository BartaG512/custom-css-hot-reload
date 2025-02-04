/* eslint-disable no-undef */
/* eslint-disable max-len */

document.addEventListener('DOMContentLoaded', () => {
  let previousConfigString = '';

  function updateConfig() {
    const statusBar = document.getElementById('bartag.custom-css-hot-reload');

    if (!statusBar) {
      return;
    }
    const ariaLabel = statusBar.getAttribute('aria-label');
    const label = ariaLabel?.split(', ');
    const [, ...restCommandString] = label;
    const commandString = restCommandString.join(', ');

    if (!commandString) {
      return;
    }

    if (commandString !== previousConfigString) {
      try {
        handleCommand(commandString);
      } catch (error) {
        console.log('[Custom CSS Hot Reload] Cannot', error);
      }
    }
  }

  function handleCommand(configString) {
    const { command, payload } = JSON.parse(configString);

    if (command === 'updateContents') {
      patchCss(payload.contents);
    } else if (command === 'dispose') {
      const elements = document.querySelectorAll('[data-extension="custom-css-hot-reload"]');
      elements.forEach((element) => {
        // Remove the element from its parent
        console.log(`🧹 Removing custom CSS hot-reload extension element: ${element.id}`);
        element.parentNode.removeChild(element);
      });
    }
    previousConfigString = configString;
    console.log('[Custom CSS Hot Reload] 📄 Updated config for custom.');
  }

  function patchCss(cssContent) {
    for (const id in cssContent) {
      const content = cssContent[id];
      // Determine if it's a CSS or JS file
      const isCSS = id.endsWith('css');
      const isJS = id.endsWith('js');

      if (isJS) {
        continue;
      }

      if (!isCSS && !isJS) {
        console.log(`[Hot Reload] ⚠️ Ignored: ${id} (Not CSS or JS)`);
        continue; // Skip non-CSS and non-JS files
      }
      const oldTag = document.getElementById(id);

      if (!oldTag) {
        console.warn(`[Hot Reload] ⚠️ Tag not found for: ${id}`);
        continue;
      }
      const parent = oldTag.parentElement;
      const { nextSibling } = oldTag;

      // Create a new tag of the correct type
      const newTag = document.createElement(isCSS ? 'style' : 'script');
      newTag.id = id;

      // Copy all attributes from old tag
      for (let i = 0; i < oldTag.attributes.length; i++) {
        const attr = oldTag.attributes[i];
        newTag.setAttribute(attr.name, attr.value);
      }

      // Set content appropriately
      newTag.textContent = content;

      // Remove old tag and insert the new one
      parent.removeChild(oldTag);

      if (nextSibling) {
        parent.insertBefore(newTag, nextSibling);
      } else {
        parent.appendChild(newTag);
      }
      console.log(`[Custom CSS Hot Reload] ✅ ${oldTag.tagName} switched ${id}`);
    }
  }

  updateConfig();

  const observer = new MutationObserver(() => {
    updateConfig();
  });

  const bodyObserver = new MutationObserver((mutations, obs) => {
    const statusBarElement = document.getElementsByClassName('statusbar')[0];

    if (statusBarElement) {
      console.log('found status bar element');
      observer.observe(statusBarElement, {
        childList: true,
        subtree: true,
        attributeFilter: ['aria-label'], // Only listen for aria-label changes
      });
      console.log('[Custom CSS Hot Reload] 👀 MutationObserver initialized to track changes in the status bar.');
      obs.disconnect(); // Stop observing once the status bar is found
    }
  });

  bodyObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
});
