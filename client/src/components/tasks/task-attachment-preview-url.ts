/** Request inline delivery without changing the attachment's download link. */
export function taskAttachmentPreviewUrl(url: string): string {
  if (!url.startsWith("/") || url.startsWith("//")) {
    throw new Error("Attachment previews require a local URL");
  }
  const parsed = new URL(url, "https://attachment-preview.invalid");
  parsed.searchParams.set("preview", "1");
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}