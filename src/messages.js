exports.messages = {
	admin: "Run VS Code with admin privileges so the changes can be applied.",
	enabled:
	"Custom CSS Hot Reload enabled. Restart to take effect. This is only needed once after install. Restart abd configure CSS by adding files to the custom_css_hot_reload.imports.\r\n" +
	"If Code complains about it is corrupted, \r\nCLICK DON'T SHOW AGAIN. " +
		"\r\nSee README for more detail.",
	disabled: "Custom CSS Hot Reload disabled and reverted to default. Restart to take effect.",
	already_disabled: "Custom CSS Hot Reload.",
	somethingWrong: "Something went wrong: ",
	restartIde: "Restart Visual Studio Code",
	unableToLocateVsCodeInstallationPath:
		"Unable to locate the installation path of VSCode. This extension may not function correctly.",
	cannotLoad: url => `Cannot load '${url}'. Skipping.`
};
