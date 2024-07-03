import * as vscode from "vscode";
import * as child_process from "child_process";

interface Account {
  type: string;
  username: string;
  email: string;
}

let accounts: Account[] = [];
let currentAccount: Account | null = null;

async function addOrUpdateAccount(context: vscode.ExtensionContext) {
  const type = await vscode.window.showInputBox({
    prompt: "Enter Account Type (e.g., work, personal)",
    ignoreFocusOut: true,
  });

  if (!type) {
    vscode.window.showErrorMessage("Account type is required.");
    return;
  }

  const username = await vscode.window.showInputBox({
    prompt: "Enter Git Username",
    ignoreFocusOut: true,
  });

  if (!username) {
    vscode.window.showErrorMessage("Username is required.");
    return;
  }

  const email = await vscode.window.showInputBox({
    prompt: "Enter Git Email",
    ignoreFocusOut: true,
  });

  if (!email) {
    vscode.window.showErrorMessage("Email is required.");
    return;
  }

  const account: Account = { type, username, email };
  const index = accounts.findIndex((acc) => acc.type === type);
  if (index !== -1) {
    accounts[index] = account;
  } else {
    accounts.push(account);
  }

  context.globalState.update("GitAccounts", accounts);
  currentAccount = account;
  context.globalState.update("currentAccount", currentAccount);
  vscode.window.showInformationMessage(
    `Switched to ${type} account: ${username}`
  );
  updateGitConfig(username, email);
  updateStatusBarItem();
}

async function switchAccount(context: vscode.ExtensionContext) {
  if (accounts.length === 0) {
    vscode.window.showErrorMessage(
      "No accounts available. Please add an account first."
    );
    await addOrUpdateAccount(context);
    return;
  }

  const options: vscode.QuickPickItem[] = [
    ...accounts.map((account) => ({
      label: account.type,
      description: `Username: ${account.username}, Email: ${account.email}`,
    })),
    { label: "", kind: vscode.QuickPickItemKind.Separator },
    {
      label: "> New Account",
      description: "Create new Git account details",
    },
  ];

  const selection = await vscode.window.showQuickPick(options, {
    placeHolder: "Select account type to switch",
  });

  if (!selection) {
    return;
  }

  if (selection.label === "> New Account") {
    await addOrUpdateAccount(context);
  } else {
    const type = selection.label;
    currentAccount = accounts.find((account) => account.type === type) || null;
    if (currentAccount) {
      context.globalState.update("currentAccount", currentAccount);
      vscode.window.showInformationMessage(
        `Switched to ${type} account: ${currentAccount.username}`
      );
      updateGitConfig(currentAccount.username, currentAccount.email);
      updateStatusBarItem();
    }
  }
}

async function removeAccount(context: vscode.ExtensionContext) {
  const types = accounts.map((account) => account.type);
  if (types.length === 0) {
    vscode.window.showErrorMessage("No accounts available to remove.");
    return;
  }

  const type = await vscode.window.showQuickPick(types, {
    placeHolder: "Select account type to remove",
  });

  if (!type) {
    return;
  }

  accounts = accounts.filter((account) => account.type !== type);
  context.globalState.update("GitAccounts", accounts);

  if (currentAccount?.type === type) {
    currentAccount = null;
    context.globalState.update("currentAccount", currentAccount);
    vscode.window.showInformationMessage(
      `Removed current account and switched to no account.`
    );
  } else {
    vscode.window.showInformationMessage(`Removed account: ${type}`);
  }

  updateStatusBarItem();
}

function updateGitConfig(username: string, email: string) {
  try {
    child_process.execSync(`git config --global user.name "${username}"`);
    child_process.execSync(`git config --global user.email "${email}"`);
    vscode.window.showInformationMessage(
      "Git global config updated successfully."
    );
  } catch (error) {
    vscode.window.showErrorMessage("Failed to update Git global config.");
  }
}

function updateStatusBarItem() {
  if (currentAccount) {
    statusBar.text = `Git: ${currentAccount.username} (${currentAccount.type})`;
  } else {
    statusBar.text = "Git: Not logged in";
  }
}

let statusBar: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  const addOrUpdateAccountCommand = vscode.commands.registerCommand(
    "extension.addOrUpdateGitAccount",
    () => addOrUpdateAccount(context)
  );
  const switchAccountCommand = vscode.commands.registerCommand(
    "extension.switchGitAccount",
    () => switchAccount(context)
  );
  const removeAccountCommand = vscode.commands.registerCommand(
    "extension.removeGitAccount",
    () => removeAccount(context)
  );

  context.subscriptions.push(addOrUpdateAccountCommand);
  context.subscriptions.push(switchAccountCommand);
  context.subscriptions.push(removeAccountCommand);

  accounts = context.globalState.get<Account[]>("GitAccounts") || [];
  currentAccount = context.globalState.get<Account>("currentAccount") || null;

  if (currentAccount) {
    vscode.window.showInformationMessage(
      `Current Git account: ${currentAccount.username} (${currentAccount.type})`
    );
  } else {
    vscode.window.showInformationMessage("No Git account logged in.");
  }

  statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );

  updateStatusBarItem();
  statusBar.command = "extension.switchGitAccount";
  statusBar.show();
  context.subscriptions.push(statusBar);
}

export function deactivate() {}
