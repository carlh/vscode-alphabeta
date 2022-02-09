import {
  commands,
  Event,
  EventEmitter,
  ProviderResult,
  Range,
  Selection,
  TextEditorRevealType,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  Uri,
  window,
  workspace,
} from 'vscode';

import {
  AnnotatedRange,
  FileAnnotations,
  onAnnotationsUpdate,
} from './annotationmanager';

import { platform } from 'os';

enum TreeItemType {
  root,
  file,
  phase,
  lineitem,
}

const pathSeparator = platform() === 'win32' ? '\\' : '/';
const platformFileScheme = platform() === 'win32' ? 'file:///' : 'file://';

class PrereleaseTreeItem extends TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: TreeItemCollapsibleState,
    public readonly itemType: TreeItemType
  ) {
    super(label, collapsibleState);
  }
}

class LineItemTreeItem extends PrereleaseTreeItem {
  constructor(
    public readonly label: string,
    public readonly parentFile: string,
    public readonly range: Range
  ) {
    super(label, TreeItemCollapsibleState.None, TreeItemType.lineitem);
    this.command = {
      command: 'prerelease.opentosymbol',
      title: 'Show in editor',
      arguments: [parentFile, range],
    };
  }
}

class PhaseTreeItem extends PrereleaseTreeItem {
  constructor(
    public readonly label: string,
    public readonly parentFile: string
  ) {
    super(label, TreeItemCollapsibleState.Collapsed, TreeItemType.phase);
  }
}

class FileTreeItem extends PrereleaseTreeItem {
  /**
   *
   * @param path This is the absolute path to the file.  It will also be used as the tooltip.
   * @param label This should only be the name of the file.
   */
  constructor(public readonly path: Uri, public readonly label: string) {
    super(label, TreeItemCollapsibleState.Collapsed, TreeItemType.file);
    this.tooltip = path.fsPath;
    this.iconPath = ThemeIcon.File;
  }
}

export class PrereleaseTreeDataProvider
  implements TreeDataProvider<PrereleaseTreeItem | string>
{
  annotations: FileAnnotations = {};

  private _onDidChangeTreeData: EventEmitter<
    PrereleaseTreeItem | undefined | null | void
  > = new EventEmitter<PrereleaseTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: Event<
    PrereleaseTreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private _annotationsListener = (annotations: FileAnnotations) => {
    this.annotations = annotations;
    this._onDidChangeTreeData.fire();
  };

  private _rootNode: PrereleaseTreeItem;

  constructor() {
    onAnnotationsUpdate.addListener(this._annotationsListener);
    this._rootNode = new PrereleaseTreeItem(
      'Prerelease Usage',
      TreeItemCollapsibleState.Collapsed,
      TreeItemType.root
    );
    commands.registerCommand(
      'prerelease.opentosymbol',
      (file: string, range: Range) => this.openFileToSymbol(file, range)
    );
  }

  openFileToSymbol = async (file: string, range: Range) => {
    try {
      const document = await workspace.openTextDocument(file);
      const editor = await window.showTextDocument(document);
      if (editor) {
        editor.selection = new Selection(range.start, range.end);
        editor.revealRange(
          range,
          TextEditorRevealType.InCenterIfOutsideViewport
        );
      }
    } catch {
      // NOP - if we can't open the file, we just don't open the file.
    }
  };

  getTreeItem(element: PrereleaseTreeItem): TreeItem | Thenable<TreeItem> {
    return element;
  }

  getChildren(
    element?: PrereleaseTreeItem
  ): ProviderResult<PrereleaseTreeItem[]> {
    if (!element) {
      return Promise.resolve([this._rootNode]);
    }

    if (element.itemType === TreeItemType.root) {
      // Right now I'm just grabbing the active file.  For full reporting this should optionally show all prerelease data for all files.
      const activeFilename = window.activeTextEditor?.document.fileName ?? '';
      const annotation = this.annotations[activeFilename];
      if (annotation) {
        const fileUri = Uri.parse(`${platformFileScheme}${activeFilename}`);
        const fileName = activeFilename.substring(
          activeFilename.lastIndexOf(pathSeparator) + 1
        );
        const treeItem = new FileTreeItem(fileUri, fileName);
        treeItem.resourceUri = Uri.parse(
          `${platformFileScheme}${activeFilename}`
        );
        return Promise.resolve([treeItem]);
      }
      return Promise.resolve([]);
    }

    if (element.itemType === TreeItemType.file) {
      const currentAnnotationNode =
        this.annotations[(element as FileTreeItem).path.fsPath];
      if (currentAnnotationNode) {
        // This is a file name node, need to return the phase nodes
        // element.
        const children: PhaseTreeItem[] = [];
        Object.keys(currentAnnotationNode).forEach((phase) => {
          const node = new PhaseTreeItem(
            phase,
            (element as FileTreeItem).path.fsPath
          );
          children.push(node);
        });
        return Promise.resolve(children);
      }
      return Promise.resolve([]);
    }

    if (element.itemType === TreeItemType.phase) {
      const phaseItem = element as PhaseTreeItem;
      const currentAnnotationNode = this.annotations[phaseItem.parentFile];
      if (currentAnnotationNode) {
        const lineItems: LineItemTreeItem[] = [];
        let fileAnnotations: AnnotatedRange[] = [];
        const phase = phaseItem.label;
        if (phase === "alpha") {
          fileAnnotations = currentAnnotationNode.alpha;
        } else if (phase === "beta") {
          fileAnnotations = currentAnnotationNode.beta;
        } else if (phase === "internal") {
          fileAnnotations = currentAnnotationNode.internal;
        } else if (phase === "deprecated") {
          fileAnnotations = currentAnnotationNode.deprecated;
        }

        fileAnnotations.forEach((annotation) => {
          const label = `[line: ${annotation.range.start.line + 1}, char: ${
            annotation.range.start.character + 1
          }] - ${annotation.name}`;
          const node = new LineItemTreeItem(
            label,
            phaseItem.parentFile,
            annotation.range
          );
          lineItems.push(node);
        });
        return Promise.resolve(lineItems);
      }
      return Promise.resolve([]);
    }
    return Promise.resolve([]);
  }
}
