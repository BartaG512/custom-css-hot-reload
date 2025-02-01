/* eslint-disable no-undef */
/* eslint-disable no-param-reassign */
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const msg = require('./messages').messages;
const uuid = require('uuid');
const getInjectionJs = require('./get-injection-code');
const fetch = require('node-fetch');
const Url = require('url');
const { isContext } = require('vm');

function activate(context) {
  const appDir = require.main
    ? path.dirname(require.main.filename)
    : globalThis._VSCODE_FILE_ROOT;

  if (!appDir) {
    vscode.window.showInformationMessage(msg.unableToLocateVsCodeInstallationPath);
  }

  const base = path.join(appDir, 'vs', 'code');
  let htmlFile = path.join(base, 'electron-sandbox', 'workbench', 'workbench.html');

  if (!fs.existsSync(htmlFile)) {
    htmlFile = path.join(base, 'electron-sandbox', 'workbench', 'workbench-apc-extension.html');
  }

  if (!fs.existsSync(htmlFile)) {
    htmlFile = path.join(base, 'electron-sandbox', 'workbench', 'workbench.esm.html');
  }

  if (!fs.existsSync(htmlFile)) {
    vscode.window.showInformationMessage(msg.unableToLocateVsCodeInstallationPath);
  }

  const BackupFilePath = (uuid) => {
    return path.join(base, 'electron-sandbox', 'workbench', `workbench.${uuid}.bak-background-perp`);
  };

  async function cmdInstall(options) {
    const uuidSession = uuid.v4();
    await createBackup(uuidSession);
    await performPatch(uuidSession, options);
  }

  async function cmdReinstall(options) {
    await uninstallImpl();
    await cmdInstall(options);
  }

  async function cmdUninstall() {
    await uninstallImpl();
    reloadWindow();
  }

  async function uninstallImpl() {
    const backupUuid = await getBackupUuid(htmlFile);

    if (!backupUuid) {
      return;
    }
    const backupPath = BackupFilePath(backupUuid);
    await restoreBackup(backupPath);
    await deleteBackupFiles();
  }

  async function getBackupUuid(htmlFilePath) {
    try {
      const htmlContent = await fs.promises.readFile(htmlFilePath, 'utf-8');
      const m = htmlContent.match(
        /<!-- !! BACKGROUND-BY-PROJECT-ID ([0-9a-fA-F-]+) !! -->/,
      );

      if (!m) {
        return null;
      }
      return m[1];
    } catch (e) {
      vscode.window.showInformationMessage(msg.somethingWrong + e);
      throw e;
    }
  }

  async function restoreBackup(backupFilePath) {
    try {
      if (fs.existsSync(backupFilePath)) {
        await fs.promises.unlink(htmlFile);
        await fs.promises.copyFile(backupFilePath, htmlFile);
      }
    } catch (e) {
      vscode.window.showInformationMessage(msg.admin);
      throw e;
    }
  }

  async function createBackup(uuidSession) {
    try {
      let html = await fs.promises.readFile(htmlFile, 'utf-8');
      html = clearExistingPatches(html);
      await fs.promises.writeFile(BackupFilePath(uuidSession), html, 'utf-8');
    } catch (e) {
      vscode.window.showInformationMessage(msg.admin);
      throw e;
    }
  }

  async function deleteBackupFiles() {
    const htmlDir = path.dirname(htmlFile);
    const htmlDirItems = await fs.promises.readdir(htmlDir);
    for (const item of htmlDirItems) {
      if (item.endsWith('.bak-background-perp')) {
        await fs.promises.unlink(path.join(htmlDir, item));
      }
    }
  }

  async function performPatch(uuidSession, options) {
    const config = vscode.workspace.getConfiguration('better_custom_css');
    console.log('config:', config);
    let html = await fs.promises.readFile(htmlFile, 'utf-8');
    html = clearExistingPatches(html);
    console.log('html:', html);

    const indicatorJS = await patchHtml(config);
    html = html.replace(/<meta\s+http-equiv="Content-Security-Policy"[\s\S]*?\/>/, '');

    html = html.replace(
      /(<\/html>)/,
      `<!-- !! BACKGROUND-BY-PROJECT-ID ${uuidSession} !! -->\n` +
			`<!-- !! BACKGROUND-BY-PROJECT-START !! -->\n${indicatorJS}<!-- !! BACKGROUND-BY-PROJECT-END !! -->\n</html>`,
    );
    try {
      console.log('htmlFile:', htmlFile);
      await fs.promises.writeFile(htmlFile, html, 'utf-8');
    } catch (e) {
      vscode.window.showInformationMessage(msg.admin);
      disabledRestart();
      return;
    }

    if (options?.reload) {
      reloadWindow();
    }
  }

  function clearExistingPatches(html) {
    html = html.replace(
      /<!-- !! BACKGROUND-BY-PROJECT-START !! -->[\s\S]*?<!-- !! BACKGROUND-BY-PROJECT-END !! -->\n*/,
      '',
    );
    html = html.replace(/<!-- !! BACKGROUND-BY-PROJECT-ID [\w-]+ !! -->\n*/g, '');
    return html;
  }

  async function patchHtml(config) {
    console.log('config:', config);
    let res = '';

    res += `<script>${getInjectionJs()}</script>`;
    for (const item of config.imports) {
      const imp = await patchHtmlForItem(item);

      if (imp) {
        res += imp;
      }
    }
    return res;
  }

  function resolveVariable(key) {
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

  function parsedUrl(url) {
    if (/^file:/.test(url)) {
      // regex matches any "${<RESOLVE>}" and replaces with resolveVariable(<RESOLVE>)
      // eg:  "HELLO ${userHome} WORLD" -> "HELLO /home/username WORLD"
      return url.replaceAll(
        /\$\{([^\{\}]+)\}/g,
        (substr, key) => {
          return resolveVariable(key) ?? substr;
        },
      );
    }
    return url;
  }

  async function getContent(url) {
    if (/^file:/.test(url.toString())) {
      const fp = Url.fileURLToPath(url);
      return await fs.promises.readFile(fp);
    }
    const response = await fetch(url);
    return response.buffer();
  }

  const normalizePath = (path) => {
    return path
      .replace(/^file:\/\//i, '') // Remove "file://" prefix if present
      .replace(/\\/g, '/') // Normalize backslashes to forward slashes
      .replace(/^\//, '') // Remove leading slash if present
      .toLowerCase(); // Convert to lowercase for case-insensitive comparison (Windows-specific)
  };

  async function patchHtmlForItem(url) {
    if (!url) {
      return '';
    }

    if (typeof url !== 'string') {
      return '';
    }

    // Copy the resource to a staging directory inside the extension dir
    let parsed = new Url.URL(url);
    const ext = path.extname(parsed.pathname);

    try {
      parsed = parsedUrl(url);
      console.log('url:', url);
      console.log('safeId:', url);
      const fetched = await getContent(parsed);
      const id = normalizePath(url);

      if (ext === '.css') {
        return `<style id="${id}">${fetched}</style>`;
      } else if (ext === '.js') {
        return `<script id="${id}">${fetched}</script>`;
      }
      throw new Error(`Unsupported extension type: ${ext}`);
    } catch (e) {
      console.error(e);
      vscode.window.showWarningMessage(msg.cannotLoad(parsed.toString()));
      return '';
    }
  }

  function reloadWindow() {
    // reload vscode-window
    vscode.commands.executeCommand('workbench.action.reloadWindow');
  }

  function disabledRestart() {
    vscode.window.showInformationMessage(msg.disabled, msg.restartIde).then((btn) => {
      if (btn === msg.restartIde) {
        reloadWindow();
      }
    });
  }

  const installCustomCSS = vscode.commands.registerCommand(
    'extension.installBetterCSS',
    () => {
      cmdInstall({ reload: true });
    },
  );
  const uninstallCustomCSS = vscode.commands.registerCommand(
    'extension.uninstallBetterCSS',
    cmdUninstall,
  );
  const updateCustomCSS = vscode.commands.registerCommand(
    'extension.updateBetterCSS',
    () => {
      return cmdReinstall({ reload: true });
    },
  );

  context.subscriptions.push(installCustomCSS);
  context.subscriptions.push(uninstallCustomCSS);
  context.subscriptions.push(updateCustomCSS);

  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = '$(paintcan) Better Custom Css';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  async function getMatchingFileContents(parsedUrls) {
    console.log('parsedUrls:', parsedUrls);
    const openEditors = vscode.window.visibleTextEditors;
    const fileContents = {};

    for (const editor of openEditors) {
      const filePath = editor.document.uri.fsPath;
      console.log('editor uri filePath:', filePath);

      if (parsedUrls.some((monitoredPath) => {
        return compareFilePaths(monitoredPath, filePath);
      })) {
        const id = normalizePath(filePath);

        fileContents[id] = editor.document.getText();
      }
    }

    return fileContents;
  }

  function compareFilePaths(path1, path2) {
    return normalizePath(path1) === normalizePath(path2);
  }

  const updateFiles = async() => {
    const config = vscode.workspace.getConfiguration('better_custom_css');
    console.log('config:', config);
    const parsedUrls = config.imports.map((url) => {
      parsed = parsedUrl(url);
      console.log('parsed:', parsed);
      return parsed;
    });
    const contents = await getMatchingFileContents(parsedUrls);
    console.log('contents', contents);
    updateStatusBarTooltip(contents);
  };

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

  const throttledUpdateFiles = throttle(updateFiles, 200);

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(throttledUpdateFiles),
    vscode.workspace.onDidOpenTextDocument(throttledUpdateFiles),
    vscode.workspace.onDidCloseTextDocument(throttledUpdateFiles),
    vscode.workspace.onDidChangeTextDocument(throttledUpdateFiles),
  );

  function updateStatusBarTooltip(content) {
    statusBarItem.tooltip = JSON.stringify(content);
    statusBarItem.hide();
    statusBarItem.show();
  }

  vscode.workspace.onDidChangeConfiguration(async(ex) => {
    const hasChanged = ex.affectsConfiguration('better_custom_css.imports');

    if (!hasChanged) {
      return;
    }
    await cmdReinstall({ reload: false });
    // updateStatusBarTooltip();
    throttledUpdateFiles();
  });
  throttledUpdateFiles();

  // updateStatusBarTooltip();

  console.log('better-custom-css is active!');
  console.log('Application directory', appDir);
  console.log('Main HTML file', htmlFile);
}

exports.activate = activate;

function deactivate() {
  cmdUninstall();
}

exports.deactivate = deactivate;

