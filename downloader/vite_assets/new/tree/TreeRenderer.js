import { TreeNodeRenderer } from "./TreeNodeRenderer";
import { TreeStateManager } from "./TreeStateManager";

export class TreeRenderer {
  constructor(tree, containerElement, treeConfig) {
    this.tree = tree;
    this.containerElement = containerElement;
    this.renderFunctions = treeConfig.renderFunctions;
    this.eventHandlers = treeConfig.eventHandlers;
    this.stateManager = new TreeStateManager(treeConfig.selectionValidator);
    this.injectCSS();
  }

  injectCSS() {
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

  async render() {
    this.containerElement.innerHTML = "";
    for (const node of this.tree.nodes) {
      await this.renderNode(node, this.containerElement, true);
    }
  }
  async renderNode(node, parentElement, isInitialRender = false) {
    const nodeRenderer = new TreeNodeRenderer(
      node,
      this.stateManager,
      this.renderFunctions,
      this.eventHandlers,
    );
    const nodeElement = nodeRenderer.render();
    parentElement.appendChild(nodeElement);

    if (node.data.type === "folder" && isInitialRender) {
      const childrenContainer = nodeElement.querySelector(
        ".children-container",
      );
      if (childrenContainer) {
        childrenContainer.style.display = "none";
      }
    }
  }
}
