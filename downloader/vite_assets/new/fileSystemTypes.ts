export interface SelectedItem {
  name: string;
  type: "file" | "folder";
  path: string;
  handle: FileSystemFileHandle | FileSystemDirectoryHandle | null;
  file: File | null;
}
