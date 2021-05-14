import * as vscode from 'vscode';
import {
  reportingShowInStatusBar,
  onConfigurationUpdate,
} from './configurationmanager';
import { onAnnotationsUpdate } from './annotationmanager';
const SHOW_PRERELEASE_COUNT = 'alphabeta.showPrereleaseCount';
let countStatusBarItem: vscode.StatusBarItem;

let numberOfPrerelease = 0;

const updateStatusBarText = () => {
  if (reportingShowInStatusBar && numberOfPrerelease > 0) {
    countStatusBarItem.text = `Prereleased: ${numberOfPrerelease}`;
    countStatusBarItem.show();
  } else {
    countStatusBarItem.hide();
  }
};

export const registerPrereleaseStatusBarItem = (
  context: vscode.ExtensionContext
) => {
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
  countStatusBarItem.command = SHOW_PRERELEASE_COUNT;
  context.subscriptions.push(countStatusBarItem);

  onConfigurationUpdate.addListener(() => {
    updateStatusBarText();
  });

  onAnnotationsUpdate.addListener(
    (fileName: string, ranges: vscode.Range[]) => {
      if (fileName === vscode.window.activeTextEditor?.document.fileName) {
        numberOfPrerelease = ranges.length;
        updateStatusBarText();
      }
    }
  );
  updateStatusBarText();
};
