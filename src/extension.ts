// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { updateAnnotations } from './annotationmanager';
import { updateConfiguration } from './configurationmanager';
import { registerPrereleaseStatusBarItem } from './prereleaseStatusBarItem';
import { PrereleaseTreeDataProvider } from './prereleaseTreeDataProvider';

let disposables: vscode.Disposable[] = [];
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('AlphaBETA is now active');
  updateConfiguration();
  vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('AlphaBETA')) {
      updateConfiguration();
    }
  });

  registerPrereleaseStatusBarItem(context);

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

  disposables.push(
    vscode.window.registerTreeDataProvider(
      'AlphaBETA.Prerelease',
      new PrereleaseTreeDataProvider()
    )
  );
}

// this method is called when your extension is deactivated
export function deactivate() {
  disposables.forEach((disposable) => disposable.dispose());
  disposables = [];
}
