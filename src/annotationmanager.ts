import * as vscode from 'vscode';
import * as ts from 'typescript';
import { MarkdownString } from 'vscode';
import {
  onConfigurationUpdate,
  refreshInterval,
  showAlpha,
  showAnnotations,
  showBeta,
  showInternal,
} from './configurationmanager';
import {
  internalDecorationType,
  betaDecorationType,
  alphaDecorationType,
} from './decorations';

const JSDOC_INTERNAL_ANNOTATION = '*@internal*';
const JSDOC_ALPHA_ANNOTATION = '*@alpha*';
const JSDOC_BETA_ANNOTATION = '*@beta*';

type Phase = 'internal' | 'alpha' | 'beta';

export type AnnotatedRange = {
  name: string;
  range: vscode.Range;
};

export type AnnotatedRangeSet = {
  alpha: AnnotatedRange[];
  beta: AnnotatedRange[];
  internal: AnnotatedRange[];
};

export interface FileAnnotations {
  [key: string]: AnnotatedRangeSet;
}

let annotationsForFiles: FileAnnotations = {};

type AnnotationUpdateHandler = (annotations: FileAnnotations) => void;

class AnnotationUpdateListener {
  private _listeners: AnnotationUpdateHandler[] = [];
  readonly listeners = this._listeners;
  addListener = (listener: AnnotationUpdateHandler) => {
    this._listeners.push(listener);
  };
}

export const onAnnotationsUpdate = new AnnotationUpdateListener();

let timer: NodeJS.Timeout | null = null;

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
  if (!showBeta || !showAnnotations) {
    return false;
  }
  return containsMarkedRanges(hovers, JSDOC_BETA_ANNOTATION);
};

const containsAlphaAnnotations = (hovers: vscode.Hover[]): boolean => {
  if (!showAlpha || !showAnnotations) {
    return false;
  }
  return containsMarkedRanges(hovers, JSDOC_ALPHA_ANNOTATION);
};

const containsInternalAnnotations = (hovers: vscode.Hover[]): boolean => {
  if (!showInternal || !showAnnotations) {
    return false;
  }
  return containsMarkedRanges(hovers, JSDOC_INTERNAL_ANNOTATION);
};

const getAnnotatedRanges = (
  hovers: vscode.Hover[][],
  document: vscode.TextDocument
): AnnotatedRangeSet => {
  const annotatedRanges: AnnotatedRangeSet = {
    alpha: [],
    beta: [],
    internal: [],
  };

  const annotatedRangeFromHover = (
    hover: vscode.Hover,
    document: vscode.TextDocument
  ): AnnotatedRange => {
    const range = hover.range as vscode.Range;
    const symbolName = document.getText(range);
    return {
      name: symbolName,
      range: range,
    };
  };

  hovers.reduce((ranges: vscode.Range[], hover: vscode.Hover[]) => {
    if (containsInternalAnnotations(hover)) {
      const currentHover = hover.pop();
      if (currentHover) {
        annotatedRanges.internal.push(
          annotatedRangeFromHover(currentHover, document)
        );
        return [...ranges, currentHover?.range as vscode.Range];
      }
    } else if (containsAlphaAnnotations(hover)) {
      const currentHover = hover.pop();
      if (currentHover) {
        annotatedRanges.alpha.push(
          annotatedRangeFromHover(currentHover, document)
        );
        return [...ranges, currentHover?.range as vscode.Range];
      }
    } else if (containsBetaAnnotations(hover)) {
      const currentHover = hover.pop();
      if (currentHover) {
        annotatedRanges.beta.push(
          annotatedRangeFromHover(currentHover, document)
        );
        return [...ranges, currentHover?.range as vscode.Range];
      }
    }
    return ranges;
  }, []);

  return annotatedRanges;
};

const paintAnnotations = (
  editor: vscode.TextEditor,
  annotatedRanges: AnnotatedRangeSet
) => {
  annotatedRanges.internal.forEach((annotation) => {});

  const setDecorations = (
    decorationType: vscode.TextEditorDecorationType,
    ranges: vscode.Range[]
  ) => {
    editor.setDecorations(decorationType, []);
    editor.setDecorations(decorationType, ranges);
  };

  const internalRanges = annotatedRanges.internal.map((value) => {
    return value.range;
  });

  const alphaRanges = annotatedRanges.alpha.map((value) => {
    return value.range;
  });

  const betaRanges = annotatedRanges.beta.map((value) => {
    return value.range;
  });
  setDecorations(internalDecorationType, internalRanges);
  setDecorations(alphaDecorationType, alphaRanges);
  setDecorations(betaDecorationType, betaRanges);
};

const onDidUpdateTextDocument = async (
  document: vscode.TextDocument | undefined,
  editor: vscode.TextEditor | undefined
) => {
  if (editor && document) {
    if (showAnnotations) {
      const languageId = document.languageId;
      if (
        languageId === 'typescript' ||
        languageId === 'typescriptreact' ||
        languageId === 'javascript' ||
        languageId === 'javascriptreact'
      ) {
        const positions: vscode.Position[] = getIdentifierPositions(document);
        const annotations: vscode.Hover[][] = await getHoverAnnotations(
          document,
          positions
        );
        const prerelease: AnnotatedRangeSet = getAnnotatedRanges(
          annotations,
          document
        );
        paintAnnotations(editor, prerelease);
        annotationsForFiles[document.fileName] = prerelease;
        onAnnotationsUpdate.listeners.forEach((listener) => {
          listener(annotationsForFiles);
        });
      }
    } else {
      clearAnnotations();
    }
  }
};

export const updateAnnotations = () => {
  if (!showAnnotations) {
    clearAnnotations();
    return;
  }
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
  vscode.window.visibleTextEditors.forEach((editor) => {
    onDidUpdateTextDocument(editor.document, editor);
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
    if (internalDecorationType) {
      editor.setDecorations(internalDecorationType, []);
    }
    if (alphaDecorationType) {
      editor.setDecorations(alphaDecorationType, []);
    }
    if (betaDecorationType) {
      editor.setDecorations(betaDecorationType, []);
    }
  });
};

onConfigurationUpdate.addListener(updateAnnotations);
