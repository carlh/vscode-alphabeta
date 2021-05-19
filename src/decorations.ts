import { window } from 'vscode';

export const internalDecorationType = window.createTextEditorDecorationType({
  borderColor: 'rgb(145,0,13)',
  backgroundColor: 'rgba(145,0,13,0.4)',
  borderWidth: '2px',
  borderRadius: '4px',
});

export const betaDecorationType = window.createTextEditorDecorationType({
  borderColor: 'rgb(18,166,75)',
  backgroundColor: 'rgba(18,166,75,0.4)',
  borderWidth: '2px',
  borderRadius: '4px',
});

export const alphaDecorationType = window.createTextEditorDecorationType({
  borderColor: 'rgb(192,188,23)',
  backgroundColor: 'rgba(192,188,23,0.4)',
  borderWidth: '2px',
  borderRadius: '4px',
});
