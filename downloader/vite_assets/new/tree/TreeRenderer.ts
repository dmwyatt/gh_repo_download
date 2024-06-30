import { Tree } from "./Tree";
import { TreeNode } from "./TreeNode";
import { TreeNodeRenderer } from "./TreeNodeRenderer";
import { TreeStateManager } from "./TreeStateManager";
import {
  TreeRenderCallbacks,
  TreeInteractionCallbacks,
  SelectionValidator,
} from "./treeTypes";

export class TreeRenderer<T> {
  private tree: Tree<T>;
  private containerElement: HTMLElement;
  private stateManager: TreeStateManager<T>;

  constructor(
    tree: Tree<T>,
    containerElement: HTMLElement,
    private renderCallbacks: TreeRenderCallbacks<T>,
    private interactionCallbacks: TreeInteractionCallbacks<T>,
    selectionValidator: SelectionValidator<T>,
  ) {
    this.tree = tree;
    this.containerElement = containerElement;
    this.renderCallbacks = renderCallbacks;
    this.interactionCallbacks = interactionCallbacks;
    this.stateManager = new TreeStateManager<T>(selectionValidator);
  }

  async render(): Promise<void> {
    this.containerElement.innerHTML = "";
    for (const node of this.tree.nodes) {
      await this.renderNode(node, this.containerElement);
    }
  }

  private async renderNode(
    node: TreeNode<T>,
    parentElement: HTMLElement,
  ): Promise<void> {
    const nodeRenderer = new TreeNodeRenderer<T>(node, this.stateManager, {
      getNodeTemplate: this.renderCallbacks.getNodeTemplate,
      getIcon: this.renderCallbacks.getIcon,
      getChevron: this.renderCallbacks.getChevron,
      onSelect: this.interactionCallbacks.onSelect,
      onToggle: this.interactionCallbacks.onToggle,
    });

    const nodeElement = nodeRenderer.render();
    parentElement.appendChild(nodeElement);

    if (node.children.length > 0) {
      const childrenContainer = nodeElement.querySelector(
        ".children-container",
      ) as HTMLElement;
      if (childrenContainer) {
        for (const childNode of node.children) {
          await this.renderNode(childNode, childrenContainer);
        }
      }
    }
  }
}
