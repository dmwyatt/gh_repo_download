import { FileSystemNodeData, TreeNode } from "./tree/TreeNode";

export class FileSystemHelper {
  private fileMap: Map<TreeNode<FileSystemNodeData>, File>;
  private totalFiles: number;
  private processedFiles: number;

  constructor() {
    this.fileMap = new Map();
    this.totalFiles = 0;
    this.processedFiles = 0;
  }

  getFileCount(node: TreeNode<FileSystemNodeData>): number {
    if (node.data.type === "file") return 1;
    return node.children.reduce(
      (count, child) => count + this.getFileCount(child),
      0,
    );
  }

  getTotalSize(node: TreeNode<FileSystemNodeData>): number {
    if (node.data.type === "file") return node.data.size;
    return node.children.reduce(
      (size, child) => size + this.getTotalSize(child),
      0,
    );
  }

  async buildTreeFromDirectoryHandle(
    directoryHandle: FileSystemDirectoryHandle,
    parentNode: TreeNode<FileSystemNodeData> | null = null,
  ): Promise<TreeNode<FileSystemNodeData>> {
    const node = new TreeNode<FileSystemNodeData>(directoryHandle.name, {
      type: "folder",
      handle: directoryHandle,
      size: 0,
    });
    if (parentNode) parentNode.addChild(node);

    for await (const entry of directoryHandle.values()) {
      if (entry.kind === "file") {
        if (this.isFileSystemFileHandle(entry)) {
          const file = await entry.getFile();
          const fileNode = new TreeNode<FileSystemNodeData>(entry.name, {
            type: "file",
            handle: entry,
            size: file.size,
          });
          this.fileMap.set(fileNode, file);
          node.addChild(fileNode);
        }
      } else if (entry.kind === "directory") {
        if (this.isFileSystemDirectoryHandle(entry)) {
          await this.buildTreeFromDirectoryHandle(entry, node);
        }
      }
    }

    return node;
  }

  private isFileSystemFileHandle(
    handle: FileSystemHandle,
  ): handle is FileSystemFileHandle {
    return handle.kind === "file" && "getFile" in handle;
  }

  private isFileSystemDirectoryHandle(
    handle: FileSystemHandle,
  ): handle is FileSystemDirectoryHandle {
    return handle.kind === "directory" && "getDirectoryHandle" in handle;
  }

  async buildTreeFromFiles(
    files: File[],
  ): Promise<TreeNode<FileSystemNodeData>> {
    console.log(`Building tree from ${files.length} files`);
    const rootFolderName = files[0].webkitRelativePath.split("/")[0];
    const rootNode = new TreeNode<FileSystemNodeData>(rootFolderName, {
      type: "folder",
      size: 0,
    });
    const pathMap = new Map<string, TreeNode<FileSystemNodeData>>();
    pathMap.set(rootNode.name, rootNode);

    this.totalFiles = files.length;
    this.processedFiles = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      this.processedFiles++;
      if (
        this.processedFiles % 100 === 0 ||
        this.processedFiles === files.length
      ) {
        this.emitProgressEvent(this.processedFiles, files.length);
        await this.yieldToMain();
      }

      const pathParts = file.webkitRelativePath.split("/");
      let currentNode = rootNode;

      for (let j = 1; j < pathParts.length; j++) {
        const part = pathParts[j];
        const path = pathParts.slice(0, j + 1).join("/");

        if (!pathMap.has(path)) {
          const isFile = j === pathParts.length - 1;
          const newNode = new TreeNode<FileSystemNodeData>(part, {
            type: isFile ? "file" : "folder",
            size: isFile ? file.size : 0,
          });
          currentNode.addChild(newNode);
          pathMap.set(path, newNode);

          if (isFile) {
            this.fileMap.set(newNode, file);
          }
        }

        currentNode = pathMap.get(path)!;
      }
    }
    this.emitProgressEvent(files.length, files.length);
    return rootNode;
  }

  private emitProgressEvent(processed: number, total: number): void {
    const event = new CustomEvent("fileProcessingProgress", {
      detail: { processed, total },
    });
    document.dispatchEvent(event);
  }

  private async yieldToMain(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }
}
