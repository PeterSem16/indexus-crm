import XLSX from "xlsx";
const { CFB } = XLSX;

type Address = { emailAddress?: { name?: string; address?: string } };
export type MsgAttachment = { name: string; contentType?: string; data: Buffer; contentId?: string; isInline?: boolean };
export type MsgMessage = {
  subject?: string; body?: { contentType?: string; content?: string }; bodyPreview?: string;
  from?: Address; sender?: Address; toRecipients?: Address[]; ccRecipients?: Address[]; bccRecipients?: Address[];
  receivedDateTime?: string; sentDateTime?: string; internetMessageId?: string;
  internetMessageHeaders?: { name: string; value: string }[]; importance?: string; isRead?: boolean;
};

/** MS-OXMSG Unicode IPM.Note in a real OLE compound file, not renamed MIME.
 * CFB is supplied by the existing, bundled xlsx dependency.
 */
export function writeOutlookMsg(message: MsgMessage, attachments: MsgAttachment[]): Buffer {
  const file = CFB.utils.cfb_new({ root: "Root Entry", CLSID: "0B0D020000000000C000000000000046" });
  const add = (path: string, data: Buffer) => CFB.utils.cfb_add(file, path, data);
  type Property = { id: number; type: number; value: Buffer };
  const text = (id: number, value?: string): Property => ({ id, type: 0x001f, value: Buffer.from(value || "", "utf16le") });
  const integer = (id: number, value: number): Property => {
    const bytes = Buffer.alloc(8); bytes.writeUInt32LE(value >>> 0); return { id, type: 0x0003, value: bytes };
  };
  const boolean = (id: number, value: boolean): Property => {
    const bytes = Buffer.alloc(8); bytes.writeUInt16LE(value ? 1 : 0); return { id, type: 0x000b, value: bytes };
  };
  const binary = (id: number, value: Buffer): Property => ({ id, type: 0x0102, value });
  const oneOffEntry = (name: string, email: string) => Buffer.concat([
    Buffer.from("00000000812b1fa4bea310199d6e00dd010f540200000080", "hex"),
    Buffer.from(`${name}\0SMTP\0${email}\0`, "utf16le"),
  ]);
  const timestamp = (id: number, value?: string): Property[] => {
    const ms = Date.parse(value || "");
    if (!Number.isFinite(ms)) return [];
    const bytes = Buffer.alloc(8); bytes.writeBigUInt64LE((BigInt(ms) + BigInt("11644473600000")) * BigInt(10000));
    return [{ id, type: 0x0040, value: bytes }];
  };
  const writeProperties = (path: string, properties: Property[], header: Buffer) => {
    const entries = properties.filter(property => property.type !== 0x001f || property.value.length > 0)
      .sort((a, b) => a.id - b.id).map(property => {
      const entry = Buffer.alloc(16);
      entry.writeUInt16LE(property.type); entry.writeUInt16LE(property.id, 2); entry.writeUInt32LE(6, 4);
      if (property.type === 0x001f || property.type === 0x0102) {
        // MS-OXMSG 2.4.2.2: string streams omit NUL; size includes its two bytes.
        entry.writeUInt32LE(property.value.length + (property.type === 0x001f ? 2 : 0), 8);
        const tag = property.id.toString(16).padStart(4, "0") + property.type.toString(16).padStart(4, "0");
        add(`${path}__substg1.0_${tag.toUpperCase()}`, property.value);
      } else property.value.copy(entry, 8, 0, 8);
      return entry;
    });
    add(`${path}__properties_version1.0`, Buffer.concat([header, ...entries]));
  };
  const recipients = [
    ...(message.toRecipients || []).map(address => ({ address, type: 1 })),
    ...(message.ccRecipients || []).map(address => ({ address, type: 2 })),
    ...(message.bccRecipients || []).map(address => ({ address, type: 3 })),
  ];
  recipients.forEach(({ address, type }, index) => {
    const email = address.emailAddress?.address || "", name = address.emailAddress?.name || email;
    writeProperties(`__recip_version1.0_#${index.toString(16).padStart(8, "0").toUpperCase()}/`, [
      integer(0x3000, index), integer(0x0c15, type), integer(0x0ffe, 6), integer(0x3900, 0),
      text(0x3001, name), text(0x3002, "SMTP"), text(0x3003, email), text(0x39fe, email),
      binary(0x0fff, oneOffEntry(name, email)),
      binary(0x300b, Buffer.from(`SMTP:${email.toUpperCase()}\0`)),
    ], Buffer.alloc(8));
  });
  attachments.forEach((attachment, index) => {
    writeProperties(`__attach_version1.0_#${index.toString(16).padStart(8, "0").toUpperCase()}/`, [
      integer(0x0e21, index), integer(0x3705, 1), integer(0x0e20, attachment.data.length),
      integer(0x370b, attachment.isInline ? 0 : 0xffffffff),
      text(0x3001, attachment.name), text(0x3704, attachment.name), text(0x3707, attachment.name),
      text(0x370e, attachment.contentType || "application/octet-stream"), binary(0x3701, attachment.data),
      ...(attachment.contentId ? [text(0x3712, attachment.contentId)] : []),
      boolean(0x7ffe, !!attachment.isInline),
    ], Buffer.alloc(8));
  });
  const sender = message.from?.emailAddress || message.sender?.emailAddress || {};
  const html = message.body?.contentType?.toLowerCase() === "html";
  const display = (addresses?: Address[]) => (addresses || []).map(a => a.emailAddress?.name || a.emailAddress?.address || "").join("; ");
  const rootHeader = Buffer.alloc(32);
  rootHeader.writeUInt32LE(recipients.length, 8); rootHeader.writeUInt32LE(attachments.length, 12);
  rootHeader.writeUInt32LE(recipients.length, 16); rootHeader.writeUInt32LE(attachments.length, 20);
  writeProperties("", [
    text(0x001a, "IPM.Note"), text(0x0037, message.subject), text(0x0070, message.subject),
    binary(0x0c19, oneOffEntry(sender.name || sender.address || "", sender.address || "")),
    binary(0x0041, oneOffEntry(sender.name || sender.address || "", sender.address || "")),
    text(0x0c1a, sender.name || sender.address), text(0x0c1e, "SMTP"), text(0x0c1f, sender.address),
    text(0x5d01, sender.address), text(0x0042, sender.name || sender.address), text(0x0064, "SMTP"),
    text(0x0065, sender.address), text(0x5d02, sender.address),
    text(0x0e04, display(message.toRecipients)), text(0x0e03, display(message.ccRecipients)), text(0x0e02, display(message.bccRecipients)),
    text(0x1035, message.internetMessageId),
    text(0x007d, (message.internetMessageHeaders || []).map(h => `${h.name}: ${h.value}`).join("\r\n")),
    text(0x1000, html ? message.bodyPreview || "" : message.body?.content),
    ...(html ? [binary(0x1013, Buffer.from(message.body?.content || "", "utf8"))] : []),
    integer(0x3fde, 65001), integer(0x3ffd, 65001), integer(0x0ffe, 5),
    integer(0x340d, 0x00040000),
    integer(0x0e07, (message.isRead ? 1 : 0) | (attachments.length ? 0x10 : 0)),
    boolean(0x0e1b, attachments.length > 0), integer(0x0017, message.importance === "high" ? 2 : message.importance === "low" ? 0 : 1),
    ...timestamp(0x0039, message.sentDateTime), ...timestamp(0x0e06, message.receivedDateTime),
  ], rootHeader);
  // No named MAPI properties are used, but Outlook expects the mapping storage.
  for (const tag of ["00020102", "00030102", "00040102"]) add(`__nameid_version1.0/__substg1.0_${tag}`, Buffer.alloc(0));
  return Buffer.from(CFB.write(file, { type: "buffer", fileType: "cfb" }));
}
