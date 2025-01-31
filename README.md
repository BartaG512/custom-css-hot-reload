# Editor Background By Path

### **SPECIAL NOTE: If Visual Studio Code complains about that it is corrupted, simply click “Don't show again”.**
### **NOTE: Every time after Visual Studio Code is updated, please re-enable Editor Background By Path**
### **NOTE: Every time you change the configuration, it is auto reloading but if not just, run reload Editor Background By Path.**
### **NOTE: Before you uninstall the extension run the Editor Background By Path: Disable command to cleanup the patched JS from vscode files.**

Add custom background by path to your Visual Studio Code. 

![example](https://github.com/BartaG512/editor-background-by-path/raw/HEAD/images/example.png)

## Getting Started

1. Install this extension.

2. Add to `settings.json`:

   ```json
		"editor_background_by_path.background_map": {
				"path-pattern-1": "/absolute/path/to/image1.png",
				"path-pattern-2": "/absolute/path/to/image2.jpg"
		}
   ```

		```json
		"editor_background_by_path.background_map": {
				"dog": "/c:/vscode_logos/dog.png",
				"kitten": "/c:/vscode_logos/kitten.png",
		}
		```



3. Visual Studio Code automatically detects changes in configuration and restarts itself.

4. At first time after install Activate command Editor Background By Path: Enable".


## Extension commands

Access the command palette and introduce commands you can use ***Ctrl+Shift+P*** 

- ***Editor Background By Path: Enable***: It changes the background of your editor tab specified in your user settings, if the currently opened editor file's path is matching with a key present  `editor_background_by_path.background_map`.
- ***Editor Background By Path: Disable***: It will disable the extension.
- ***Editor Background By Path: Reload***: Disable and then re-enable it.

## Windows users (Based on: Custom CSS and JS Readme)

**In Windows, make sure you run your Visual Studio Code in Administrator mode before enabling or disabling your custom style!**

## Mac and Linux users
**The extension would NOT work if Visual Studio Code cannot modify itself.** The cases include:

- Code files being read-only, like on a read-only file system or,
- Code is not started with the permissions to modify itself.

**You need to claim ownership on Visual Studio Code's installation directory, by running this command**:

```sh
sudo chown -R $(whoami) "$(which code)"
sudo chown -R $(whoami) /usr/share/code
```

The placeholder `<Path to Visual Studio Code>` means the path to VSCode installation. It is typically:

- `/Applications/Visual Studio Code.app/Contents/MacOS/Electron`, on MacOS;
- `/Applications/Visual Studio Code - Insiders.app/Contents/MacOS/Electron`, on MacOS when using Insiders branch;
- `/usr/share/code`, on most Linux;
- `/usr/lib/code/` or `/opt/visual-studio-code` on Arch Linux.

Mac and Linux package managers may have customized installation path. Please double check your path is correct.

## Variables

File URIs support VSCode variables like: `${userHome}`. It just replaces supported variables with their values before parsing into a file path. Supported variables are:

- `${cwd}`
- `${userHome}`
- `${execPath}`
- `${pathSeparator}`, `${/}`

It also supports env variables like `${env:ENV_VAR_NAME}` and you can specify a fallback value like `${env:ENV_VAR:defaultvalue}`



# Disclaimer

This extension modifies some Visual Studio Code files so use it at your own risk.
This extension solves this issue by injecting code into:

- `electron-browser/index.html`.

The extension will keep a copy of the original file in case something goes wrong. That's what the disable command will do for you.

As this extension modifies Visual Studio Code files, it will get disabled with every Visual Studio Code update. You will have to enable the extension via the command palette.

Take into account that this extension is still in beta, so you may find some bugs while playing with it. Please, report them to [the issues section of the Github's repo](https://github.com/BartaG512/editor-background-by-path/).
