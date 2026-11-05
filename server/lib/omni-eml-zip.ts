import type { FileHandle } from "node:fs/promises";
import { deflateRaw } from "node:zlib";
import { promisify } from "node:util";
const compress = promisify(deflateRaw);
const crcTable = Array.from({ length: 256 }, (_, i) => {
  let value = i;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
export function crc32(bytes: Uint8Array) {
  let value = 0xffffffff;
  for (let index = 0; index < bytes.length; index++) value = crcTable[(value ^ bytes[index]) & 255] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}
export function safeEmlName(value: string) {
  return value.normalize("NFKC").replace(/[\x00-\x1f\x7f<>:"/\\|?*]/g, "_").replace(/^\.+|[. ]+$/g, "").slice(0, 100) || "email";
}
/** ZIP32, UTF-8 filenames and deflated original MIME bytes; no new runtime dependency. */
export class EmlZipWriter {
  private offset = 0;
  private central: Buffer[] = [];
  private count = 0;
  constructor(private file: FileHandle) {}
  async add(name: string, mime: Buffer) {
    const filename = Buffer.from(name, "utf8");
    const data = await compress(mime);
    const crc = crc32(mime);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6); local.writeUInt16LE(8, 8);
    local.writeUInt16LE(33, 12); // 1980-01-01, valid DOS date
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(mime.length, 22); local.writeUInt16LE(filename.length, 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0x800, 8); entry.writeUInt16LE(8, 10); entry.writeUInt16LE(33, 14);
    entry.writeUInt32LE(crc, 16); entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(mime.length, 24); entry.writeUInt16LE(filename.length, 28);
    entry.writeUInt32LE(this.offset, 42);
    for (const part of [local, filename, data]) await this.file.writeFile(part);
    this.central.push(entry, filename); this.count++;
    this.offset += local.length + filename.length + data.length;
  }
  async finish() {
    const end = Buffer.alloc(22);
    const centralSize = this.central.reduce((total, part) => total + part.length, 0);
    end.writeUInt32LE(0x06054b50); end.writeUInt16LE(this.count, 8); end.writeUInt16LE(this.count, 10);
    end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(this.offset, 16);
    for (const part of [...this.central, end]) await this.file.writeFile(part);
  }
}
