// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as ts from 'typescript';
import { MarkdownString } from 'vscode';

const JSDOC_INTERNAL_ANNOTATION = '*@internal*';
const JSDOC_ALPHA_ANNOTATION = '*@alpha*';
const JSDOC_BETA_ANNOTATION = '*@beta*';

const getIdentifierPositions = (
  document: vscode.TextDocument
): vscode.Position[] => {
  const positions: vscode.Position[] = [];
  let source: ts.SourceFile | undefined = ts.createSourceFile(
    `${document.uri.fsPath}.tmp`,
    document.getText(),
    ts.ScriptTarget.Latest
  );

  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) {
      positions.push(document.positionAt(node.end));
    }
    ts.forEachChild(node, visit);
  };
  if (source) {
    ts.forEachChild(source, visit);
  }
  return positions;
};

const getHoverAnnotations = async (
  document: vscode.TextDocument,
  positions: vscode.Position[]
): Promise<vscode.Hover[][]> => {
  return Promise.all(
    positions.map((position: vscode.Position): Thenable<vscode.Hover[]> => {
      const thenable: Thenable<vscode.Hover[]> = vscode.commands.executeCommand(
        'vscode.executeHoverProvider',
        document.uri,
        position
      ) as Thenable<vscode.Hover[]>;
      return thenable;
    })
  );
};

const containsMarkedRanges = (
  hovers: vscode.Hover[],
  token: string
): boolean => {
  return hovers.some((hover: vscode.Hover) => {
    return hover.contents.some(
      (content) => (content as MarkdownString)?.value.includes(token) ?? false
    );
  });
};

const containsBetaAnnotations = (hovers: vscode.Hover[]): boolean => {
  if (!showBeta) {
    return false;
  }
  return containsMarkedRanges(hovers, JSDOC_BETA_ANNOTATION);
};

const containsAlphaAnnotations = (hovers: vscode.Hover[]): boolean => {
  if (!showAlpha) {
    return false;
  }
  return containsMarkedRanges(hovers, JSDOC_ALPHA_ANNOTATION);
};

const containsInternalAnnotations = (hovers: vscode.Hover[]): boolean => {
  if (!showInternal) {
    return false;
  }
  return containsMarkedRanges(hovers, JSDOC_INTERNAL_ANNOTATION);
};

const getAnnotatedRanges = (hovers: vscode.Hover[][]): vscode.Range[] => {
  return hovers.reduce((ranges: vscode.Range[], hover: vscode.Hover[]) => {
    if (
      containsInternalAnnotations(hover) ||
      containsAlphaAnnotations(hover) ||
      containsBetaAnnotations(hover)
    ) {
      return [...ranges, hover.pop()?.range as vscode.Range];
    }
    return ranges;
  }, []);
};

const paintAnnotations = (
  editor: vscode.TextEditor,
  ranges: vscode.Range[],
  decorationType: vscode.TextEditorDecorationType
) => {
  editor.setDecorations(decorationType, []);
  editor.setDecorations(decorationType, ranges);
};

const onDidUpdateTextDocument = async (
  document: vscode.TextDocument | undefined,
  editor: vscode.TextEditor | undefined,
  decorationType: vscode.TextEditorDecorationType
) => {
  if (editor && document && showAnnotations) {
    const positions: vscode.Position[] = getIdentifierPositions(document);
    const annotations: vscode.Hover[][] = await getHoverAnnotations(
      document,
      positions
    );
    const prerelease: vscode.Range[] = getAnnotatedRanges(annotations);

    paintAnnotations(editor, prerelease, decorationType);
  }
};

let showAnnotations: boolean = false;
let refreshInterval: number = 10;
let showInternal: boolean = false;
let showAlpha: boolean = false;
let showBeta: boolean = false;

const debugConfiguration = () => {
  console.log(`Show annotations: ${showAnnotations}`);
  console.log(`Refresh interval: ${refreshInterval}`);
  console.log(`Show internal: ${showInternal}`);
  console.log(`Refresh alpha: ${showAlpha}`);
  console.log(`Refresh beta: ${showBeta}`);
};

const updateConfiguration = () => {
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

  if (showAnnotations) {
    updateAnnotations();
  } else {
    clearAnnotations();
  }

  debugConfiguration();
};

let timer: NodeJS.Timeout | null = null;
let decorationType: vscode.TextEditorDecorationType | null = null;

const updateAnnotations = () => {
  if (!showAnnotations) {
    clearAnnotations();
    return;
  }
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
  vscode.window.visibleTextEditors.forEach((editor) => {
    if (decorationType) {
      onDidUpdateTextDocument(editor.document, editor, decorationType);
    }
  });
  timer = setInterval(() => {
    updateAnnotations();
  }, refreshInterval * 1000);
};

const clearAnnotations = () => {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }

  vscode.window.visibleTextEditors.forEach((editor) => {
    if (decorationType) {
      editor.setDecorations(decorationType, []);
    }
  });
};

let disposables: vscode.Disposable[] = [];
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('AlphaBETA is now active');
  decorationType = vscode.window.createTextEditorDecorationType({
    textDecoration: 'underline',
    color: 'red',
  });

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
