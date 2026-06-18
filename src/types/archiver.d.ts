// Minimal types for archiver v8 (the published @types/archiver targets v6/7 and
// doesn't match the new class-based API). Only what we use is declared.
declare module "archiver" {
  import type { Readable } from "node:stream";

  class BaseArchive extends Readable {
    append(source: Readable | Buffer | string, data: { name: string }): this;
    finalize(): Promise<void>;
    abort(): this;
  }

  export class ZipArchive extends BaseArchive {
    constructor(options?: { zlib?: { level?: number } });
  }
  export class TarArchive extends BaseArchive {
    constructor(options?: Record<string, unknown>);
  }
  export class JsonArchive extends BaseArchive {
    constructor(options?: Record<string, unknown>);
  }
}
