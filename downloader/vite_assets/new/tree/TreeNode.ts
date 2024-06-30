export class TreeNode<T> {
  name: string;
  data: T;
  children: TreeNode<T>[];
  parent: TreeNode<T> | null;
  element: HTMLElement | null;
  checkbox: HTMLInputElement | null;

  constructor(name: string, data: T) {
    this.name = name;
    this.data = data;
    this.children = [];
    this.parent = null;
    this.element = null;
    this.checkbox = null;
  }

  addChild(childNode: TreeNode<T>): void {
    childNode.parent = this;
    this.children.push(childNode);
  }
}
