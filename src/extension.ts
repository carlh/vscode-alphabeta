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
  const file: string = document.uri.fsPath;
  const program: ts.Program = ts.createProgram([file], { allowJs: true });
  const source: ts.SourceFile | undefined = program.getSourceFile(file);

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
  return containsMarkedRanges(hovers, JSDOC_BETA_ANNOTATION);
};

const containsAlphaAnnotations = (hovers: vscode.Hover[]): boolean => {
  return containsMarkedRanges(hovers, JSDOC_ALPHA_ANNOTATION);
};

const containsInternalAnnotations = (hovers: vscode.Hover[]): boolean => {
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
  if (editor && document) {
    const positions: vscode.Position[] = getIdentifierPositions(document);
    const annotations: vscode.Hover[][] = await getHoverAnnotations(
      document,
      positions
    );
    const deprecated: vscode.Range[] = getAnnotatedRanges(annotations);

    paintAnnotations(editor, deprecated, decorationType);
  }
};

let disposables: vscode.Disposable[] = [];
let showAnnotations: boolean = false;
let refreshInterval: number = 10;

const debugConfiguration = () => {
  console.log(`Show annotations: ${showAnnotations}`);
  console.log(`Refresh interval: ${refreshInterval}`);
};

const updateConfiguration = () => {
  refreshInterval = vscode.workspace
    .getConfiguration('AlphaBETA')
    .get('refreshInterval') as number;

  showAnnotations = vscode.workspace
    .getConfiguration('AlphaBETA')
    .get('showAnnotations') as boolean;

  debugConfiguration();
};

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('AlphaBETA is now active');
  const decorationType: vscode.TextEditorDecorationType =
    vscode.window.createTextEditorDecorationType({
      textDecoration: 'underline',
      color: 'red',
    });

  setImmediate(() =>
    onDidUpdateTextDocument(
      vscode.window.activeTextEditor?.document,
      vscode.window.activeTextEditor,
      decorationType
    )
  );

  updateConfiguration();

  vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('AlphaBETA')) {
      updateConfiguration();
    }
  });

  disposables.push(
    vscode.workspace.onDidOpenTextDocument((document: vscode.TextDocument) => {
      onDidUpdateTextDocument(
        vscode.window.activeTextEditor?.document,
        vscode.window.activeTextEditor,
        decorationType
      );
    })
  );

  disposables.push(
    vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
      onDidUpdateTextDocument(
        vscode.window.activeTextEditor?.document,
        vscode.window.activeTextEditor,
        decorationType
      );
    })
  );
}

// this method is called when your extension is deactivated
export function deactivate() {
  disposables.forEach((disposable) => disposable.dispose());
  disposables = [];
}
