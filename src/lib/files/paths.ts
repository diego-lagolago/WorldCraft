import path from "node:path";

export function fileStorageRoot(): string {
  return path.resolve(
    /* turbopackIgnore: true */ process.env.FILE_STORAGE_PATH ?? "./data/uploads",
  );
}
