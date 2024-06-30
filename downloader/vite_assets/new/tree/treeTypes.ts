import { TreeNode } from "./TreeNode";

export type SelectionChangeInfo<T> = {
  node: TreeNode<T>;
  newState: boolean | "indeterminate";
  source: "user" | "programmatic";
};

export type RenderOptions<T> = {
  getNodeTemplate: (node: TreeNode<any>, options: RenderOptions<T>) => string;
  getIcon: (node: TreeNode<any>) => SVGSVGElement;
  getChevron: (node: TreeNode<any>) => SVGSVGElement;
  onSelect: (selectedItems: SelectionChangeInfo<T>) => void;
  onToggle: (node: TreeNode<any>, isOpen: boolean) => void;
};
