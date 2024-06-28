export class Tree {
  constructor(nodes = []) {
    this.nodes = nodes;
  }

  addNode(node) {
    this.nodes.push(node);
  }
}
