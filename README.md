# Custom CSS Hot Reload

This extension makes it easier to style VSCode by instantly applying the added CSS. Just simply open the CSS file you set in the config and start editing.

## Getting Started

![example](https://github.com/BartaG512/editor-background-by-path/raw/HEAD/images/example.gif)


1. Install this extension.

2. Add to `settings.json`:

```json
"custom_css_hot_reload.imports": [
  "file:///absolute/path/to/custom.css",
  "file:///absolute/path/to/custom.js"
]
```

3. Visual Studio Code automatically detects changes in configuration and applies the configurations.

4. The first time after install, activate the command "`Custom CSS Hot Reload: Enable`".

5. Open the CSS file in the config and start editing
  
## Extension commands

Access the command palette and introduce commands you can use ***Ctrl+Shift+P*** 

- ***Custom CSS Hot Reload: Enable***: It will enable the extension.
- ***Custom CSS Hot Reload: Disable***: It will disable the extension.
- ***Custom CSS Hot Reload: Reload***: Disable and then re-enable it.

## Configuration 

In the `custom_css_hot_reload.imports` array, you can define custom CSS and JS files to be injected into the editor. Each item in the array should be a URL pointing to a CSS or JS file.

## Windows users 

**In Windows, make sure you run your Visual Studio Code in Administrator mode before enabling or disabling your custom style!**

## Mac and Linux users
**The extension will NOT work if Visual Studio Code cannot modify itself.** The cases include:

- Code files being read-only, like on a read-only file system or,
- Code is not started with the permissions to modify itself.

**You need to claim ownership of Visual Studio Code's installation directory by running this command**:

```sh
sudo chown -R $(whoami) "$(which code)"
sudo chown -R $(whoami) /usr/share/code
```

The placeholder `<Path to Visual Studio Code>` means the path to the VSCode installation. It is typically:

- `/Applications/Visual Studio Code.app/Contents/MacOS/Electron`, on MacOS;
- `/Applications/Visual Studio Code - Insiders.app/Contents/MacOS/Electron`, on MacOS when using the Insiders branch;
- `/usr/share/code`, on most Linux;
- `/usr/lib/code/` or `/opt/visual-studio-code` on Arch Linux.

Mac and Linux package managers may have customized the installation path. Please double-check your path is correct.

# Disclaimer

This extension modifies some Visual Studio Code files, so use it at your own risk.
This extension solves this issue by injecting code into:

- `electron-browser/index.html`.

The extension will keep a copy of the original file in case something goes wrong. That's what the disable command will do for you.

As this extension modifies Visual Studio Code files, it will get disabled with every Visual Studio Code update. You will have to enable the extension via the command palette.

Take into account that this extension is still in beta, so you may find some bugs while using it. Please, report them to [the issues section of the Github's repo](https://github.com/BartaG512/custom-css-hot-reload/).
