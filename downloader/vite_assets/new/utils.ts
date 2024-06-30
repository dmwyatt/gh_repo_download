import { ZipPassThrough, Zip } from "fflate";

/**
 * Reads a File or Blob as an ArrayBuffer.
 *
 * @param file - The File or Blob to be read.
 * @returns A promise that resolves with the file contents as a Uint8Array.
 * @throws If there's an error reading the file.
 */
function readFileAsArrayBuffer(file: File | Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) =>
      resolve(new Uint8Array((event.target as any).result));
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}

type ProgressCallback = (
  processedFiles: number,
  totalFiles: number,
  compressedSize: number,
  totalSize: number,
) => void;
type ErrorCallback = (fileName: string, error: Error) => void;
type FileError = {
  file: string;
  error: string;
};
type ZipFilesAsyncReturn = {
  zipBuffer: Uint8Array;
  errors: FileError[];
};

/**
 * Asynchronously compresses an array of files into a ZIP archive using a streaming approach.
 *
 * @param files - An array of File objects to be compressed.
 * @param [progressCallback] - Optional callback for progress updates.
 *        Called with the number of processed files, total number of files, current compressed size, and total uncompressed size.
 * @param [errorCallback] - Optional callback for individual file errors.
 *        Called with the name of the file that encountered an error and the error object.
 * @param [abortOnError=false] - If true, the entire process will abort on the first error encountered.
 *        If false, it will continue processing other files after an error.
 * @returns A promise that resolves with an object containing:
 *          - zipBuffer: The compressed ZIP file as a Uint8Array.
 *          - errors: An array of objects describing any errors encountered, each containing the file name and error message.
 * @throws If abortOnError is true and an error is encountered, or if there's an error in the ZIP stream itself.
 */
export function zipFilesAsync(
  files: File[],
  progressCallback: ProgressCallback | null = null,
  errorCallback: ErrorCallback | null = null,
  abortOnError: boolean = false,
): Promise<ZipFilesAsyncReturn> {
  return new Promise((resolve, reject) => {
    const totalFiles = files.length;
    let processedFiles = 0;
    let totalSize = 0;
    let compressedSize = 0;
    let zipChunks: Uint8Array[] = [];
    let errors: FileError[] = [];

    const zipStream = new Zip((err, data, final) => {
      if (err) {
        reject(err);
      } else {
        zipChunks.push(data);
        compressedSize += data.length;
        if (progressCallback) {
          progressCallback(
            processedFiles,
            totalFiles,
            compressedSize,
            totalSize,
          );
        }
        if (final) {
          const zipBuffer = new Uint8Array(compressedSize);
          let offset = 0;
          for (const chunk of zipChunks) {
            zipBuffer.set(chunk, offset);
            offset += chunk.length;
          }
          resolve({ zipBuffer, errors });
        }
      }
    });

    function processNextFile(index: number) {
      if (index >= files.length) {
        zipStream.end();
        return;
      }

      const file = files[index];
      readFileAsArrayBuffer(file)
        .then((fileData) => {
          totalSize += fileData.length;
          processedFiles++;

          const zipObject = new ZipPassThrough(file.name);
          zipStream.add(zipObject);
          zipObject.push(fileData, true);

          if (progressCallback) {
            progressCallback(
              processedFiles,
              totalFiles,
              compressedSize,
              totalSize,
            );
          }

          processNextFile(index + 1);
        })
        .catch((error) => {
          console.error(`Error reading file ${file.name}:`, error);
          errors.push({ file: file.name, error: error.message });

          if (errorCallback) {
            errorCallback(file.name, error);
          }

          if (abortOnError) {
            reject(
              new Error(`Error reading file ${file.name}: ${error.message}`),
            );
          } else {
            processedFiles++;
            if (progressCallback) {
              progressCallback(
                processedFiles,
                totalFiles,
                compressedSize,
                totalSize,
              );
            }
            processNextFile(index + 1);
          }
        });
    }

    processNextFile(0);
  });
}
