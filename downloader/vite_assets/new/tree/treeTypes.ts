import { TreeNode } from "./TreeNode";

export type SelectionChangeInfo<T> = {
  node: TreeNode<T>;
  newState: boolean | "indeterminate";
  source: "user" | "programmatic";
};

// export type RenderOptions<T> = {
//   getNodeTemplate: (node: TreeNode<any>, options: RenderOptions<T>) => string;
//   getIcon: (node: TreeNode<any>) => SVGSVGElement;
//   getChevron: (node: TreeNode<any>) => SVGSVGElement;
//   onSelect: (selectedItems: SelectionChangeInfo<T>) => void;
//   onToggle: (node: TreeNode<any>, isOpen: boolean) => void;
//   selectionValidator: SelectionValidator<T>;
// };
export type SelectionState = boolean | "indeterminate";

export type SelectionValidator<T> = (
  currentSelection: TreeNode<T>[],
  node: TreeNode<T>,
  isSelecting: boolean,
) => boolean;

export interface TreeRenderCallbacks<T> {
  getNodeTemplate: (node: TreeNode<T>) => string;
  getIcon: (node: TreeNode<T>) => SVGSVGElement;
  getChevron: (node: TreeNode<T>) => SVGSVGElement;
}

export interface TreeInteractionCallbacks<T> {
  onSelect: (selectedItems: SelectionChangeInfo<T>) => void;
  onToggle: (node: TreeNode<T>, isOpen: boolean) => void;
}
