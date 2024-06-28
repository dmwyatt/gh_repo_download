export class TreeNode {
  constructor(data) {
    this.data = data;
    this.children = [];
    this.parent = null;
    this.element = null;
    this.checkbox = null;
  }

  addChild(childNode) {
    childNode.parent = this;
    this.children.push(childNode);
  }
}
