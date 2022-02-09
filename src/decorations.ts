import { window } from 'vscode';

export const internalDecorationType = window.createTextEditorDecorationType({
  backgroundColor: { id: 'AlphaBETA.internal' },
  borderWidth: '2px',
  borderRadius: '4px',
});

export const betaDecorationType = window.createTextEditorDecorationType({
  backgroundColor: { id: 'AlphaBETA.beta' },
  borderWidth: '2px',
  borderRadius: '4px',
});

export const alphaDecorationType = window.createTextEditorDecorationType({
  backgroundColor: { id: 'AlphaBETA.alpha' },
  borderWidth: '2px',
  borderRadius: '4px',
});

export const deprecatedDecorationType = window.createTextEditorDecorationType({
  backgroundColor: { id: "AlphaBETA.deprecated" },
  borderWidth: "2px",
  borderRadius: "4px",
});
