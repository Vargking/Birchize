declare module "utif" {
  export function decode(
    data: ArrayBuffer,
  ): Array<{ width: number; height: number }>;
  export function decodeImage(data: ArrayBuffer, image: unknown): void;
  export function toRGBA8(image: unknown): Uint8Array;
}
declare module "libarchive.js" {
  export const Archive: {
    init(options: { workerUrl: string; getWorker?: () => Worker }): void;
    write(options: {
      files: Array<{ file: File; pathname: string }>;
      outputFileName: string;
      compression: string;
      format: string;
      passphrase: string | null;
    }): Promise<File>;
    open(file: File): Promise<{
      usePassword(password: string): Promise<void>;
      getFilesArray(): Promise<
        Array<{
          file: { name: string; size: number; extract(): Promise<File> };
          path: string;
        }>
      >;
      close(): Promise<void>;
    }>;
  };
}
