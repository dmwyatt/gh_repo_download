import { Alpine as AlpineType } from "alpinejs";
import { FileSystemNodeData } from "./new/tree/TreeNode";

declare global {
  var Alpine: AlpineType;

  interface DocumentEventMap {
    selectionChanged: CustomEvent<
      SelectionChangeEventDetail<FileSystemNodeData>
    >;
  }
}
