import Alpine from "alpinejs";

import { FolderTreeHelper, isFile, getFileFromItem } from "./FolderTreeHelper";
import { zipFilesAsync, getCookie } from "./utils";
import { FileSystemNodeData, TreeNode } from "./tree/TreeNode";

type FileItem = {
  type: string;
  file?: File;
  handle?: FileSystemFileHandle;
};

type SelectionChangeEventDetail = {
  selectedNodes: TreeNode<FileSystemNodeData>[];
};

type SelectionInvalidEventDetail = {
  node: TreeNode<FileSystemNodeData>;
  attemptedState: boolean;
};

function app() {
  return {
    githubUrl: "",
    selectedItems: [] as FileItem[],
    folderTreeHelper: null as FolderTreeHelper | null,
    selectedCount: 0,
    selectedSize: 0,
    maxFiles: 200,
    maxSizeMB: 500,
    isProcessing: false,

    init() {
      const selectionValidator = (
        currentSelection: TreeNode<FileSystemNodeData>[],
        node: TreeNode<FileSystemNodeData>,
        isSelecting: boolean,
      ) => {
        const nodeFileCount = this.folderTreeHelper!.getFileCount(node);
        const nodeSize = this.folderTreeHelper!.getTotalSize(node);

        let countAdjustment = isSelecting ? nodeFileCount : -nodeFileCount;
        let sizeAdjustment = isSelecting ? nodeSize : -nodeSize;

        let projectedCount = this.selectedCount + countAdjustment;
        let projectedSize = this.selectedSize + sizeAdjustment;

        console.info({
          projectedCount,
          projectedSize,
          countAdjustment,
          sizeAdjustment,
          nodeFileCount,
          nodeSize,
        });

        return (
          projectedCount <= this.maxFiles &&
          projectedSize <= this.maxSizeMB * 1024 * 1024
        );
      };

      this.folderTreeHelper = new FolderTreeHelper(
        document.getElementById("tree-container")!,
        selectionValidator,
      );

      document.addEventListener("selectionChanged", (event: Event) => {
        const { selectedNodes } = (
          event as CustomEvent<SelectionChangeEventDetail>
        ).detail;
        this.selectedCount = selectedNodes.reduce(
          (count, node) => count + this.folderTreeHelper!.getFileCount(node),
          0,
        );
        this.selectedSize = selectedNodes.reduce(
          (size, node) => size + this.folderTreeHelper!.getTotalSize(node),
          0,
        );
        this.updateSelectionDisplay();
      });

      document.addEventListener("selectionInvalid", (event: Event) => {
        const { node, attemptedState } = (
          event as CustomEvent<SelectionInvalidEventDetail>
        ).detail;
        const action = attemptedState ? "select" : "deselect";
        const nodeType = node.data.type === "folder" ? "folder" : "file";
        const reason =
          this.folderTreeHelper!.getFileCount(node) > this.maxFiles
            ? `exceed the limit of ${this.maxFiles} files`
            : `exceed the limit of ${this.maxSizeMB} MB`;

        alert(`Cannot ${action} this ${nodeType}. It would ${reason}.`);
      });
    },

    updateSelectionDisplay() {
      // Update the UI to show current selection status
      // This could update a progress bar, change colors, etc.
    },

    showSelectionInvalidWarning(node: TreeNode<any>, attemptedState: boolean) {
      const action = attemptedState ? "select" : "deselect";
      alert(
        `Cannot ${action} "${node.data.name}". It would exceed the file count or size limit.`,
      );
    },

    async selectFolder() {
      (
        document.getElementById("folder-dialog") as HTMLDialogElement
      ).showModal();
      const tree = await this.folderTreeHelper!.selectFolder();
      if (tree) {
        console.log("Folder selected and tree rendered");
      }
    },

    async confirmAndUploadFiles() {
      this.isProcessing = true;
      this.showLoadingState();

      try {
        const selectedFiles =
          await this.folderTreeHelper!.getSelectedFilesForUpload();

        if (selectedFiles.length === 0) {
          throw new Error("No valid files selected for upload");
        }

        const { zipBuffer, errors } = await zipFilesAsync(
          selectedFiles,
          this.updateProgressBar,
          this.handleZipError,
        );

        if (errors.length > 0) {
          console.error("Errors occurred during zipping:", errors);
          // Optionally, display these errors to the user
        }

        this.submitZipFile(zipBuffer);
      } catch (error) {
        console.error("Error in confirmAndUploadFiles:", error);
        alert(
          (error as Error).message ||
            "An error occurred during the upload process. Please try again.",
        );
      } finally {
        this.isProcessing = false;
        this.hideLoadingState();
      }
    },

    showLoadingState() {
      document.getElementById("loading-spinner")!.classList.remove("hidden");
      document.getElementById("page-overlay")!.classList.remove("hidden");
      document
        .querySelectorAll("button, input")
        .forEach(
          (el) =>
            ((el as HTMLButtonElement | HTMLInputElement).disabled = true),
        );
    },

    hideLoadingState() {
      document.getElementById("loading-spinner")!.classList.add("hidden");
      document.getElementById("page-overlay")!.classList.add("hidden");
      document
        .querySelectorAll("button, input")
        .forEach(
          (el) =>
            ((el as HTMLButtonElement | HTMLInputElement).disabled = false),
        );
    },

    updateProgressBar(
      processedFiles: number,
      totalFiles: number,
      compressedSize: number,
      totalSize: number,
    ) {
      const percentage = (processedFiles / totalFiles) * 100;
      const progressBar = document.getElementById(
        "progress-bar",
      ) as HTMLElement;
      const progressText = document.getElementById(
        "progress-text",
      ) as HTMLElement;
      const progressContainer = document.getElementById(
        "progress-container",
      ) as HTMLElement;

      progressBar.style.width = `${percentage}%`;
      progressText.textContent = `Processed ${processedFiles} of ${totalFiles} files (${(
        compressedSize /
        1024 /
        1024
      ).toFixed(2)} MB / ${(totalSize / 1024 / 1024).toFixed(2)} MB)`;
      progressContainer.classList.remove("hidden");
    },

    handleZipError(fileName: string, error: Error) {
      console.error(`Error zipping file ${fileName}:`, error);
      // Optionally, display this error to the user
      alert(`Error processing file: ${fileName}`);
    },

    submitZipFile(zipBuffer: Uint8Array) {
      const blob = new Blob([zipBuffer], { type: "application/zip" });
      const file = new File([blob], "selected_files.zip", {
        type: "application/zip",
      });

      const form = document.createElement("form");
      const fileInput = document.createElement("input");

      // Set up form
      form.action = "/";
      form.method = "post";
      form.enctype = "multipart/form-data";

      form.classList.add("hidden");

      // Set up file input
      fileInput.type = "file";
      fileInput.name = "zip_file";

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInput.files = dataTransfer.files;
      form.appendChild(fileInput);

      // Get CSRF token from cookies
      const csrftoken = getCookie("csrftoken");

      // Create and add CSRF token input to form
      const csrfInput = document.createElement("input");
      csrfInput.type = "hidden";
      csrfInput.name = "csrfmiddlewaretoken";
      csrfInput.value = csrftoken!;
      form.appendChild(csrfInput);

      document.body.appendChild(form);

      // Submit form
      form.submit();
    },

    closeDialog() {
      (document.getElementById("folder-dialog") as HTMLDialogElement).close();
      document.getElementById("tree-container")!.innerHTML = "";
    },
  };
}

Alpine.data("app", app);

window.Alpine = Alpine;

Alpine.start();
