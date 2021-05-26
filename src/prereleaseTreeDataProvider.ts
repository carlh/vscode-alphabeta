import {
  Event,
  EventEmitter,
  ProviderResult,
  Range,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  Uri,
  window,
} from 'vscode';

import {
  AnnotatedRange,
  FileAnnotations,
  onAnnotationsUpdate,
} from './annotationmanager';

enum TreeItemType {
  root,
  file,
  phase,
  lineitem,
}

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
  constructor(public readonly label: string) {
    super(label, TreeItemCollapsibleState.Collapsed, TreeItemType.file);
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
  }

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
        const treeItem = new FileTreeItem(activeFilename);
        treeItem.resourceUri = Uri.parse(`file://${activeFilename}`);
        return Promise.resolve([treeItem]);
      }
      return Promise.resolve([]);
    }

    if (element.itemType === TreeItemType.file) {
      const currentAnnotationNode = this.annotations[element.label];
      if (currentAnnotationNode) {
        // This is a file name node, need to return the phase nodes
        // element.
        const children: PhaseTreeItem[] = [];
        Object.keys(currentAnnotationNode).forEach((phase) => {
          const node = new PhaseTreeItem(phase, element.label);
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
        if (phase === 'alpha') {
          fileAnnotations = currentAnnotationNode.alpha;
        } else if (phase === 'beta') {
          fileAnnotations = currentAnnotationNode.beta;
        } else if (phase === 'internal') {
          fileAnnotations = currentAnnotationNode.internal;
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
