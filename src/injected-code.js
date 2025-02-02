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
				handleCommand(commandString)
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
			elements.forEach(element => {
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
			const style = cssContent[id];
			const styleTag = document.getElementById(id);

			if (!styleTag) {
				return;
			}
			const parent = styleTag.parentElement;
			const nextSibling = styleTag.nextSibling;
			parent.removeChild(styleTag)
			const newStyleTag = document.createElement('style');
			newStyleTag.id = styleTag.id;  // Az id a style tagnak, hogy egyedi legyen
			for (let i = 0; i < styleTag.attributes.length; i++) {
				var attr = styleTag.attributes[i];
				newStyleTag.setAttribute(attr.name, attr.value);
			}
			newStyleTag.innerHTML = style;
			// If there's a next sibling, insert before it; otherwise, append to the parent
			if (nextSibling) {
				parent.insertBefore(newStyleTag, nextSibling);
			} else {
				parent.appendChild(newStyleTag);
			}
			console.log(`[Custom CSS Hot Reload] ✅ CSS switched ${id}`);
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
				attributeFilter: ['aria-label']  // Only listen for aria-label changes
			});
			console.log('[Custom CSS Hot Reload] 👀 MutationObserver initialized to track changes in the status bar.');
			obs.disconnect();  // Stop observing once the status bar is found
		}
	});

	bodyObserver.observe(document.body, {
		childList: true,
		subtree: true
	});
});
