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
}

export interface TreeEventHandlers<T> {
  onSelect: (selectedItems: SelectionChangeInfo<T>) => void;
  onToggle: (node: TreeNode<T>, isOpen: boolean) => void;
}

export interface TreeConfig<T> {
  renderFunctions: TreeRenderFunctions<T>;
  eventHandlers: TreeEventHandlers<T>;
}
