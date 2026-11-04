/**
 * Turns whatever the user drops into the photo box into plain image files:
 * images pass through; a ZIP (also Word/PowerPoint/Excel files, which are zips)
 * gives the pictures inside it; a PDF gives its embedded JPEG photos.
 */
import { unzipSync } from "fflate";

const IMG = /\.(jpe?g|png|webp|gif|bmp)$/i;
const MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", bmp: "image/bmp" };
const MIN_BYTES = 15000; // skips icons, logos and tiny decorations

const ext = (n: string) => (n.split(".").pop() || "").toLowerCase();
const isZipLike = (f: File) => /\.(zip|docx|pptx|xlsx)$/i.test(f.name) || /zip|officedocument/.test(f.type);
const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);

function fromZip(buf: Uint8Array, base: string): File[] {
  const out: File[] = [];
  const entries = unzipSync(buf, { filter: (e) => IMG.test(e.name) && !/(^|\/)(__MACOSX|\.)/.test(e.name) && e.originalSize >= MIN_BYTES });
  Object.keys(entries).sort().forEach((name, i) => {
    const e = ext(name);
    out.push(new File([entries[name] as BlobPart], base + "-" + (i + 1) + "." + e, { type: MIME[e] || "image/jpeg" }));
  });
  return out;
}

function indexOfBytes(hay: Uint8Array, needle: number[], from: number): number {
  const n = needle.length;
  outer: for (let i = from; i <= hay.length - n; i++) {
    for (let j = 0; j < n; j++) if (hay[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

/** JPEG photos stored as-is inside a PDF (the usual case for photo brochures). */
function fromPdf(buf: Uint8Array, base: string): File[] {
  const out: File[] = [];
  const END = [101, 110, 100, 115, 116, 114, 101, 97, 109]; // "endstream"
  let pos = 0;
  while (true) {
    const s = indexOfBytes(buf, [0xff, 0xd8, 0xff], pos);
    if (s < 0) break;
    let e = indexOfBytes(buf, END, s);
    if (e < 0) e = buf.length;
    // trim back to the last JPEG end marker before "endstream"
    let end = e;
    while (end > s + 2 && !(buf[end - 2] === 0xff && buf[end - 1] === 0xd9)) end--;
    if (end - s >= MIN_BYTES && end > s + 2) out.push(new File([buf.slice(s, end)], base + "-" + (out.length + 1) + ".jpg", { type: "image/jpeg" }));
    pos = e + 1;
  }
  return out;
}

/** Returns image files plus the names of files that held none. */
export async function expandToImages(files: FileList | File[] | null): Promise<{ images: File[]; empty: string[] }> {
  const images: File[] = [];
  const empty: string[] = [];
  for (const f of Array.from(files || [])) {
    if (f.type.startsWith("image/")) { images.push(f); continue; }
    const base = f.name.replace(/\.[^.]+$/, "") || "photo";
    try {
      const buf = new Uint8Array(await f.arrayBuffer());
      const found = isZipLike(f) ? fromZip(buf, base) : isPdf(f) ? fromPdf(buf, base) : [];
      if (found.length) images.push(...found); else empty.push(f.name);
    } catch { empty.push(f.name); }
  }
  return { images, empty };
}
