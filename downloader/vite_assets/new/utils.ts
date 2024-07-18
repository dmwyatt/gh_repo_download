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
 * Asynchronously zips an array of files into a single zip file.
 *
 * @param files - The array of File objects to be zipped.
 * @param progressCallback - An optional callback function that receives progress updates during zipping.
 *                          It should have the following signature:
 *                          (processedFiles: number, totalFiles: number, compressedSize: number, totalSize: number) => void
 * @param errorCallback - An optional callback function that handles errors that occur during zipping.
 *                       It should have the following signature:
 *                       (fileName: string, error: Error) => void
 * @param abortOnError - A boolean indicating whether to stop zipping if an error occurs while processing a file.
 * @returns A promise that resolves with an object containing the zipped file contents as a Uint8Array and any errors encountered.
 *          The resolved object has the following structure:
 *          {
 *            zipBuffer: Uint8Array, // The zipped file contents
 *            errors: FileError[]    // An array of objects containing file-specific errors
 *          }
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

/**
 * Retrieves the value of a cookie by its name.
 *
 * @param name - The name of the cookie to retrieve.
 * @returns The value of the cookie, or null if the cookie is not found.
 */
export function getCookie(name: string) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== "") {
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      // Does this cookie string begin with the name we want?
      if (cookie.substring(0, name.length + 1) === name + "=") {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}
