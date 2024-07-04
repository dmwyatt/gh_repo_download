import { TreeNode } from "./tree/TreeNode";

export type SelectionChangeEventDetail<T> = {
  selectedNodes: TreeNode<T>[];
  selectedCount: number;
  indeterminateCount: number;
};
