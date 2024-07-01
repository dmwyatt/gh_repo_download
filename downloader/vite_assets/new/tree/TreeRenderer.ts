import { Tree } from "./Tree";
import { TreeNode } from "./TreeNode";
import { TreeNodeRenderer } from "./TreeNodeRenderer";
import { TreeStateManager } from "./TreeStateManager";
import {
  TreeRenderFunctions,
  TreeEventHandlers,
  TreeConfig,
} from "./treeTypes";

export class TreeRenderer<T> {
  tree: Tree<T>;
  containerElement: HTMLElement;
  renderFunctions: TreeRenderFunctions<T>;
  eventHandlers: TreeEventHandlers<T>;
  stateManager: TreeStateManager<T>;

  constructor(
    tree: Tree<T>,
    containerElement: HTMLElement,
    treeConfig: TreeConfig<T>,
  ) {
    this.tree = tree;
    this.containerElement = containerElement;
    this.renderFunctions = treeConfig.renderFunctions;
    this.eventHandlers = treeConfig.eventHandlers;
    this.stateManager = new TreeStateManager<T>(treeConfig.selectionValidator);
    this.injectCSS();
  }

  private injectCSS(): void {
    const styleId = "tree-renderer-styles";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        .tree-node {
          margin-left: 20px;
        }
        .node-content {
          display: flex;
          align-items: center;
          user-select: none;
          padding: 5px;
        }
        .icon, .chevron {
          width: 24px;
          height: 24px;
          margin-right: 5px;
        }
        .chevron {
          transition: transform 0.3s ease;
          cursor: pointer;
        }
        .open > .node-content > .chevron {
          transform: rotate(90deg);
        }
        .checkbox {
          margin-right: 5px;
        }
        .node-label {
          cursor: pointer;
        }
      `;
      document.head.appendChild(style);
    }
  }

  async render(): Promise<void> {
    this.containerElement.innerHTML = "";
    for (const node of this.tree.nodes) {
      await this.renderNode(node, this.containerElement, true);
    }
  }

  private async renderNode(
    node: TreeNode<T>,
    parentElement: HTMLElement,
    isInitialRender: boolean = false,
  ): Promise<void> {
    const nodeRenderer = new TreeNodeRenderer<T>(
      node,
      this.stateManager,
      this.renderFunctions,
      this.eventHandlers,
    );
    const nodeElement = nodeRenderer.render();
    parentElement.appendChild(nodeElement);

    if (
      isInitialRender &&
      this.renderFunctions.shouldInitiallyHideChildren(node)
    ) {
      const childrenContainer = nodeElement.querySelector<HTMLElement>(
        ".children-container",
      );
      if (childrenContainer) {
        childrenContainer.style.display = "none";
      }
    }
  }
}
