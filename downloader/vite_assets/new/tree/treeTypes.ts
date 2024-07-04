import { TreeNode } from "./TreeNode";

export type SelectionChangeInfo<T> = {
  node: TreeNode<T>;
  newState: boolean | "indeterminate";
  source: "user" | "programmatic";
};

export interface TreeRenderFunctions<T> {
  getNodeTemplate: (
    node: TreeNode<T>,
    renderFunctions: TreeRenderFunctions<T>,
  ) => string;
  getIcon: (node: TreeNode<T>) => SVGSVGElement;
  getChevron: (node: TreeNode<T>) => SVGSVGElement;
  shouldInitiallyHideChildren: (node: TreeNode<T>) => boolean;
}

export interface TreeEventHandlers<T> {
  onSelect: (selectedItems: SelectionChangeInfo<T>) => void;
  onToggle: (node: TreeNode<T>, isOpen: boolean) => void;
}

export interface TreeConfig<T> {
  renderFunctions: TreeRenderFunctions<T>;
  eventHandlers: TreeEventHandlers<T>;
  selectionValidator?: (
    currentSelection: TreeNode<T>[],
    node: TreeNode<T>,
    isSelecting: boolean,
  ) => boolean;
}

export type SelectionState = boolean | "indeterminate";
