import * as vscode from 'vscode';

type ConfigurationUpdateHandler = () => void;

class ConfigurationUpdateListener {
  private _listeners: ConfigurationUpdateHandler[] = [];
  readonly listeners = this._listeners;
  addListener = (listener: ConfigurationUpdateHandler) => {
    this._listeners.push(listener);
  };
}

export const onConfigurationUpdate = new ConfigurationUpdateListener();

export let showAnnotations: boolean = false;
export let refreshInterval: number = 10;
export let showInternal: boolean = false;
export let showAlpha: boolean = false;
export let showBeta: boolean = false;
export let reportingShowInStatusBar: boolean = false;

const debugConfiguration = () => {
  console.log(`Show annotations: ${showAnnotations}`);
  console.log(`Refresh interval: ${refreshInterval}`);
  console.log(`Show internal: ${showInternal}`);
  console.log(`Refresh alpha: ${showAlpha}`);
  console.log(`Refresh beta: ${showBeta}`);
  console.log(`Show in status bar: ${reportingShowInStatusBar}`);
};

export const updateConfiguration = () => {
  refreshInterval = vscode.workspace
    .getConfiguration('AlphaBETA')
    .get('control.refreshInterval') as number;

  showAnnotations = vscode.workspace
    .getConfiguration('AlphaBETA')
    .get('control.showAnnotations') as boolean;

  showInternal = vscode.workspace
    .getConfiguration('AlphaBETA')
    .get('phase.showInternal') as boolean;

  showAlpha = vscode.workspace
    .getConfiguration('AlphaBETA')
    .get('phase.showAlpha') as boolean;

  showBeta = vscode.workspace
    .getConfiguration('AlphaBETA')
    .get('phase.showBeta') as boolean;

  reportingShowInStatusBar = vscode.workspace
    .getConfiguration('AlphaBETA')
    .get('reporting.showInStatusBar') as boolean;

  onConfigurationUpdate.listeners.forEach((listener) => {
    listener();
  });

  debugConfiguration();
};
