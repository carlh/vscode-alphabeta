// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { updateAnnotations } from './annotationmanager';
import { updateConfiguration } from './configurationmanager';

const SHOW_PRERELEASE_COUNT = 'alphabeta.showPrereleaseCount';
let countStatusBarItem: vscode.StatusBarItem;

const updateStatusBarText = () => {
  countStatusBarItem.text = `${0} Prereleased`;
};

let disposables: vscode.Disposable[] = [];
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  const showPrereleaseCountCommand = vscode.commands.registerCommand(
    SHOW_PRERELEASE_COUNT,
    () => {
      // TODO: Open the output window with the report.
      console.log('Open sesame.');
    }
  );

  context.subscriptions.push(showPrereleaseCountCommand);

  countStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    3
  );
  countStatusBarItem.show();
  countStatusBarItem.command = SHOW_PRERELEASE_COUNT;
  context.subscriptions.push(countStatusBarItem);

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(updateStatusBarText)
  );
  updateStatusBarText();

  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('AlphaBETA is now active');
  updateConfiguration();
  vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('AlphaBETA')) {
      updateConfiguration();
    }
  });

  setImmediate(() => updateAnnotations());

  disposables.push(
    vscode.workspace.onDidOpenTextDocument((document: vscode.TextDocument) => {
      updateAnnotations();
    })
  );

  disposables.push(
    vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
      updateAnnotations();
    })
  );
}

// this method is called when your extension is deactivated
export function deactivate() {
  disposables.forEach((disposable) => disposable.dispose());
  disposables = [];
}
