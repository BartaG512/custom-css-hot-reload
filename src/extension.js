/* eslint-disable max-len */
/* eslint-disable no-undef */
/* eslint-disable no-param-reassign */
const vscode = require('vscode');
const path = require('path');
const msg = require('./messages').messages;
const uuid = require('uuid');
const getInjectionJs = require('./get-injection-code');
const fetch = require('node-fetch');
const Url = require('url');
const { debounce } = require('throttle-debounce');
const os = require('os');
const fs = require('fs');

class CustomCSSHotReload {
	BackupPostFix = 'bak-custom-css-hot-reload';

	constructor(context) {
		this.context = context;
		this.appDir = require.main ? path.dirname(require.main.filename) : globalThis._VSCODE_FILE_ROOT;
		this.base = path.join(this.appDir, 'vs', 'code');
		this.htmlFile = this.getHtmlFilePath();
		this.debouncedUpdateFiles = debounce(100, this.updateFiles.bind(this), { atBegin: false });
		this.config = vscode.workspace.getConfiguration('custom_css_hot_reload');
	}

	init() {
		if (!this.appDir) {
			vscode.window.showInformationMessage(msg.unableToLocateVsCodeInstallationPath);
		}

		this.setupStatusBar();
		this.setupEventListeners();
		this.debouncedUpdateFiles();
		this.registerCommands();
	}
	getHtmlFilePath() {
		// List of possible folders to check for backward compatibility
		const folders = ['electron-sandbox', 'electron-browser'];
		// List of possible HTML files to check
		const fileNames = ['workbench-dev.html', 'workbench.html', 'workbench-apc-extension.html', 'workbench.esm.html'];
		
		let htmlFile = null;
		
		// Try each folder and file combination until we find an existing one
		for (const folder of folders) {
			for (const fileName of fileNames) {
				const filePath = path.join(this.base, folder, 'workbench', fileName);
				if (fs.existsSync(filePath)) {
					htmlFile = filePath;
					break;
				}
			}
			if (htmlFile) break;
		}
		
		if (!htmlFile) {
			vscode.window.showInformationMessage(msg.unableToLocateVsCodeInstallationPath);
		}
		return htmlFile;
	}
	
	getBackupFilePath(uuid) {
		// Determine the folder by checking which exists (electron-sandbox or electron-browser)
		const htmlFileDir = path.dirname(this.htmlFile);
		const folderName = path.basename(path.dirname(htmlFileDir));
		
		return path.join(this.base, folderName, 'workbench', `workbench.${uuid}.${this.BackupPostFix}`);
	}

	async install(options) {
		const uuidSession = uuid.v4();

		if (options.createBackup) {
			await this.createBackup(uuidSession);
		}
		await this.performPatch(uuidSession, options);
	}

	async cmdUpdate(options) {
		await this.cmdUninstall();
		await this.install(options);
	}

	async cmdUninstall() {
		this.disposeStylesWithoutRestart();
		const backupUuid = await this.getBackupUuid(this.htmlFile);

		if (!backupUuid) {
			return;
		}
		const backupPath = this.getBackupFilePath(backupUuid);
		await this.restoreBackup(backupPath);

		await this.deleteBackupFiles();
	}

	async getBackupUuid(htmlFilePath) {
		try {
			const htmlContent = await fs.promises.readFile(htmlFilePath, 'utf-8');
			const m = htmlContent.match(/<!-- !! CUSTOM-CSS-HOT-RELOAD-SESSION-ID ([0-9a-fA-F-]+) !! -->/);

			if (!m) {
				return null;
			}
			return m[1];
		} catch (e) {
			vscode.window.showInformationMessage(msg.somethingWrong + e);
			throw e;
		}
	}

	async restoreBackup(backupFilePath) {
		try {
			if (fs.existsSync(backupFilePath)) {
				await fs.promises.unlink(this.htmlFile);
				await fs.promises.copyFile(backupFilePath, this.htmlFile);
			}
		} catch (e) {
			console.log('e:', e);
			vscode.window.showInformationMessage(msg.admin);
			throw e;
		}
	}

	async createBackup(uuidSession) {
		try {
			let html = await fs.promises.readFile(this.htmlFile, 'utf-8');
			html = this.clearExistingPatches(html);
			await fs.promises.writeFile(this.getBackupFilePath(uuidSession), html, 'utf-8');
		} catch (e) {
			vscode.window.showInformationMessage(msg.admin);
			throw e;
		}
	}

	async deleteBackupFiles() {
		const htmlDir = path.dirname(this.htmlFile);
		const htmlDirItems = await fs.promises.readdir(htmlDir);
		for (const item of htmlDirItems) {
			if (item.endsWith(`.${this.BackupPostFix}`)) {
				await fs.promises.unlink(path.join(htmlDir, item));
			}
		}
	}

	async performPatch(uuidSession, options) {
		const config = vscode.workspace.getConfiguration('custom_css_hot_reload');
		let html = await fs.promises.readFile(this.htmlFile, 'utf-8');
		html = this.clearExistingPatches(html);
		const injectedHtml = await this.patchHtml(config);
		html = html.replace(/<meta\s+http-equiv="Content-Security-Policy"[\s\S]*?\/>/, '');
		html = html.replace(
			/(<\/html>)/,
			`<!-- !! CUSTOM-CSS-HOT-RELOAD-SESSION-ID ${uuidSession} !! -->\n` +
			`<!-- !! CUSTOM-CSS-HOT-RELOAD-START !! -->\n${injectedHtml}<!-- !! CUSTOM-CSS-HOT-RELOAD-END !! -->\n</html>`,
		);
		try {
			await fs.promises.writeFile(this.htmlFile, html, 'utf-8');
		} catch (e) {
			vscode.window.showInformationMessage(msg.admin);
			this.disabledRestart();
			return;
		}

		// if (options?.reload) {
		// 	this.reloadWindow();
		// }
		if (options.reload) {
			this.enabledRestart();
		}
	}

	enabledRestart() {
		vscode.window.showInformationMessage(msg.enabled, msg.restartIde).then((btn) => {
			// if close button is clicked btn is undefined, so no reload window
			if (btn === msg.restartIde) {
				this.reloadWindow();
			}
		});
	}

	clearExistingPatches(html) {
		html = html.replace(
			/<!-- !! CUSTOM-CSS-HOT-RELOAD-START !! -->[\s\S]*?<!-- !! CUSTOM-CSS-HOT-RELOAD-END !! -->\n*/,
			'',
		);
		html = html.replace(/<!-- !! CUSTOM-CSS-HOT-RELOAD-SESSION-ID [\w-]+ !! -->\n*/g, '');
		return html;
	}

	async patchHtml(config) {
		let res = `<script data-extension="custom-css-hot-reload">${getInjectionJs()}</script>`;
		res += `<style data-extension="custom-css-hot-reload">
			div#bartag\\.custom-css-hot-reload { display: none!important; }
		</style>`;
		for (const item of config.imports) {
			const imp = await this.patchHtmlForItem(item);

			if (imp) {
				res += imp;
			}
		}
		return res;
	}

	resolveVariable(key) {
		const variables = {
			cwd: () => {
				return process.cwd();
			},
			userHome: () => {
				return os.homedir();
			},
			execPath: () => {
				return process.env.VSCODE_EXEC_PATH ?? process.execPath;
			},
			pathSeparator: () => {
				return path.sep;
			},
			'/': () => {
				return path.sep;
			},
		};

		if (key in variables) {
			return variables[key]();
		}

		if (key.startsWith('env:')) {
			const [_, envKey, optionalDefault] = key.split(':');
			return process.env[envKey] ?? optionalDefault ?? '';
		}
	}

	parseUrl(url) {
		if (/^file:/.test(url)) {
			return url.replaceAll(/\$\{([^\{\}]+)\}/g, (substr, key) => {
				return this.resolveVariable(key) ?? substr;
			});
		}
		return url;
	}

	async getContent(url) {
		if (/^file:/.test(url.toString())) {
			const fp = Url.fileURLToPath(url);
			return await fs.promises.readFile(fp);
		}
		const response = await fetch(url);
		return response.buffer();
	}

	normalizePath(path) {
		return path
			.replace(/^file:\/\//i, '')
			.replace(/\\/g, '/')
			.replace(/^\//, '')
			.toLowerCase();
	}

	async patchHtmlForItem(url) {
		if (!url || typeof url !== 'string') {
			return '';
		}
		let parsed = new Url.URL(url);
		const ext = path.extname(parsed.pathname);
		try {
			parsed = this.parseUrl(url);
			const fetched = await this.getContent(parsed);
			const id = this.normalizePath(url);

			if (ext === '.css') {
				return `<style id="${id}" data-extension="custom-css-hot-reload">${fetched}</style>`;
			} else if (ext === '.js') {
				return `<script id="${id}" data-extension="custom-css-hot-reload">${fetched}</script>`;
			}
			throw new Error(`Unsupported extension type: ${ext}`);
		} catch (e) {
			vscode.window.showWarningMessage(msg.cannotLoad(parsed.toString()));
			return '';
		}
	}

	reloadWindow() {
		vscode.commands.executeCommand('workbench.action.reloadWindow');
	}

	disabledRestart() {
		vscode.window.showInformationMessage(msg.disabled, msg.restartIde).then((btn) => {
			if (btn === msg.restartIde) {
				this.reloadWindow();
			}
		});
	}

	registerCommands() {
		this.context.subscriptions.push(
			vscode.commands.registerCommand('extension.installCustomCSSHotReload', async () => {
				await this.install({ reload: true, createBackup: true });
			}),
			vscode.commands.registerCommand('extension.uninstallCustomCSSHotReload', this.cmdUninstall.bind(this)),
			vscode.commands.registerCommand('extension.updateCustomCSSHotReload', () => {
				return this.cmdUpdate({ reload: true, createBackup: false });
			}),
			vscode.commands.registerCommand('extension.openImportedFiles', this.openImportedFiles.bind(this)),
		);
	}

	/**
	 * Opens the imported files specified in the configuration in separate editor tabs.
	 */
	async openImportedFiles() {
		const config = vscode.workspace.getConfiguration('custom_css_hot_reload');
		for (const url of config.imports) {
			const parsedUrl = this.parseUrl(url);
			if (/^file:/.test(parsedUrl)) {
				const filePath = Url.fileURLToPath(parsedUrl);
				const document = await vscode.workspace.openTextDocument(filePath);
				await vscode.window.showTextDocument(document, { preview: false });
			}
		}
	}

	setupStatusBar() {
		this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, Infinity);
		this.statusBarItem.text = '$(paintcan) Custom CSS Hot Reload';
		this.statusBarItem.show();
		this.context.subscriptions.push(this.statusBarItem);
	}

	async getMatchingFileContents(parsedUrls) {
		const openEditors = vscode.window.visibleTextEditors;
		const fileContents = {};
		for (const editor of openEditors) {
			const filePath = editor.document.uri.fsPath;

			if (parsedUrls.some((monitoredPath) => {
				return this.compareFilePaths(monitoredPath, filePath);
			})) {
				const id = this.normalizePath(filePath);
				fileContents[id] = editor.document.getText();
			}
		}
		return fileContents;
	}

	compareFilePaths(path1, path2) {
		return this.normalizePath(path1) === this.normalizePath(path2);
	}

	isMonitoredFile(filePath) {
		const parsedUrls = this.config.imports.map((url) => {
			return this.parseUrl(url);
		});
		const res = parsedUrls.some((monitoredPath) => {
			return this.compareFilePaths(monitoredPath, filePath);
		});
		return res;
	}

	async updateFiles() {
		const parsedUrls = this.config.imports.map((url) => {
			return this.parseUrl(url);
		});
		const contents = await this.getMatchingFileContents(parsedUrls);

		if (Object.keys(contents).length === 0) {
			return;
		}
		this.sendCommandToDom({ command: 'updateContents', payload: { contents } });
	}

	disposeStylesWithoutRestart() {
		this.sendCommandToDom({ command: 'dispose' });
	}

	setupEventListeners() {
		this.context.subscriptions.push(
			vscode.window.onDidChangeActiveTextEditor(async () => {
				if (this.config.hotReloadMode === 'onChange') {
					this.debouncedUpdateFiles();
				}
			}),
			vscode.workspace.onDidOpenTextDocument(async () => {
				if (this.config.hotReloadMode === 'onChange') {
					this.debouncedUpdateFiles();
				}
			}),
			vscode.workspace.onDidCloseTextDocument(async () => {
				if (this.config.hotReloadMode === 'onChange') {
					this.debouncedUpdateFiles();
				}
			}),
			vscode.workspace.onDidChangeTextDocument(async (event) => {
				const filePath = event.document.uri.fsPath;

				if (this.isMonitoredFile(filePath) && this.config.hotReloadMode === 'onChange') {
					this.debouncedUpdateFiles();
				}
			}),
			vscode.workspace.onDidSaveTextDocument(async (event) => {
				const filePath = event.uri.fsPath;

				if (this.isMonitoredFile(filePath)) {
					try {
						await this.install({ reload: false, createBackup: false });
					} catch (error) {
						vscode.window.showInformationMessage(msg.somethingWrong + error.message);
					}

					this.debouncedUpdateFiles();
				}
			}),
			vscode.workspace.onDidChangeConfiguration(async (ex) => {
				const hasChanged = ex.affectsConfiguration('custom_css_hot_reload.imports') || ex.affectsConfiguration('custom_css_hot_reload.hotReloadMode');

				if (hasChanged) {
					this.config = vscode.workspace.getConfiguration('custom_css_hot_reload');
					await this.cmdUpdate({ reload: false });
					this.debouncedUpdateFiles();
				}
			}),
		);
	}

	sendCommandToDom(command) {
		this.statusBarItem.tooltip = JSON.stringify(command);
	}

	async dispose() {
		this.statusBarItem.dispose();
		this.context.subscriptions.forEach((subscription) => {
			return subscription.dispose();
		});
	}

	async deactivate() {
		await this.cmdUninstall();
	}
}

let customCSSHotReloadInstance;

module.exports = {
	activate: (context) => {
		customCSSHotReloadInstance = new CustomCSSHotReload(context);
		customCSSHotReloadInstance.init();
	},
	deactivate: async () => {
		// const logFilePath = path.join(logDir, `test-to-run.log`);
		// fs.writeFileSync(logFilePath, `Test ${Boolean(customCSSHotReloadInstance)}`);
		if (customCSSHotReloadInstance) {
			// await customCSSHotReloadInstance.deactivate()
		}
	},
};

