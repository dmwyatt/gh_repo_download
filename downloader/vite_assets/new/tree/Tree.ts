import { TreeNode } from "./TreeNode";

export class Tree<T> {
  nodes: TreeNode<T>[];

  constructor(nodes: TreeNode<T>[] = []) {
    this.nodes = nodes;
  }

  addNode(node: TreeNode<T>): void {
    this.nodes.push(node);
  }
}
