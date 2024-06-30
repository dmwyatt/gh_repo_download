declare module "fflate" {
  export interface ZipAttributes {
    attrs?: number;
    comment?: string;
    extra?: Record<number, Uint8Array>;
    mtime?: string | number | Date;
    os?: number;
  }

  export interface ZipInputFile extends ZipAttributes {
    compression: number;
    crc: number;
    filename: string;
    flag?: number;
    ondata?: AsyncFlateStreamHandler;
    size: number;
    terminate?: AsyncTerminable;
  }

  export class ZipPassThrough implements ZipInputFile {
    constructor(filename: string);
    attrs?: number;
    comment?: string;
    compression: number;
    crc: number;
    extra?: Record<number, Uint8Array>;
    filename: string;
    mtime?: string | number | Date;
    ondata: AsyncFlateStreamHandler;
    os?: number;
    size: number;
    terminate?: AsyncTerminable;
    push(chunk: Uint8Array, final?: boolean): void;
  }

  export type AsyncFlateStreamHandler = (
    err: FlateError | null,
    data: Uint8Array,
    final: boolean,
  ) => void;

  export interface AsyncTerminable {
    (): void;
  }

  export interface FlateError extends Error {
    code: number;
  }

  export class Zip {
    constructor(cb?: AsyncFlateStreamHandler);
    ondata: AsyncFlateStreamHandler;
    add(file: ZipInputFile): void;
    end(): void;
    terminate(): void;
  }
}
