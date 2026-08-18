/* Minimal PDFs, built byte by byte.
 *
 * There is no PDF library in this project and there is not going to be one —
 * the app extracts text with about 200 lines of regex precisely so that it
 * stays a single self-contained file with no supply chain. The tests hold to
 * the same bargain, so the fixtures are constructed here rather than committed
 * as binaries. That also makes them reviewable: a reader can see exactly which
 * PDF feature each one exercises instead of trusting a blob.
 *
 * Four documents, one per real-world case:
 *
 *   identityH      — what Word exports for Arabic. A subset font, Identity-H
 *                    encoding, hex strings of 2-byte glyph indices, and a
 *                    /ToUnicode CMap that names them. This is the file that
 *                    came back as "we couldn't read this".
 *   identityHNoMap — the same thing with the CMap gone. Genuinely unreadable,
 *                    and the product's job is to say so, not to emit soup.
 *   winAnsi        — what Word exports for Latin. Literal (…) strings. This
 *                    already worked and must keep working.
 *   scanned        — a page whose only content is an image. No text operators
 *                    at all, so no retry of the same file can ever succeed.
 */
import { deflateSync } from "node:zlib";

const enc = new TextEncoder();

function bytes(...parts) {
  const chunks = parts.map(p => (typeof p === "string" ? enc.encode(p) : p));
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

/* Latin-1, matching how the extractor reads raw bytes. */
function raw(str) {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xff;
  return out;
}

/* Assemble numbered objects into a file. The xref table is deliberately
   omitted: the extractor scans for `N 0 obj` and `stream…endstream` and never
   consults it, so a fake xref would test nothing and a real one would only
   assert that our own arithmetic is self-consistent. */
function build(objects) {
  const parts = ["%PDF-1.7\n"];
  objects.forEach((body, i) => {
    parts.push(`${i + 1} 0 obj\n`);
    parts.push(body);
    parts.push("\nendobj\n");
  });
  parts.push("trailer\n<< /Size " + (objects.length + 1) + " /Root 1 0 R >>\n%%EOF\n");
  return bytes(...parts);
}

/* A stream object. `flate` exercises the inflate path, which is what every
   real exporter uses and therefore what the fixtures default to. */
function stream(body, { flate = true, dict = "" } = {}) {
  const data = flate ? deflateSync(Buffer.from(body, "latin1")) : raw(body);
  return bytes(
    `<< ${dict} /Length ${data.length}${flate ? " /Filter /FlateDecode" : ""} >>\nstream\n`,
    new Uint8Array(data),
    "\nendstream",
  );
}

const hex4 = n => n.toString(16).toUpperCase().padStart(4, "0");

/* Build a ToUnicode CMap and the matching hex string for `text`, assigning
   each distinct character its own glyph id exactly as a subsetting exporter
   does. Glyph ids start at 1: 0 is .notdef, and starting there would hide a
   whole class of off-by-one. */
function subset(text) {
  const cid = new Map();
  let next = 1;
  for (const ch of text) if (!cid.has(ch)) cid.set(ch, next++);
  const entries = [...cid.entries()];
  const cmap =
    "/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n" +
    "1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n" +
    `${entries.length} beginbfchar\n` +
    entries.map(([ch, id]) => `<${hex4(id)}> <${hex4(ch.codePointAt(0))}>`).join("\n") +
    "\nendbfchar\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend";
  const hex = [...text].map(ch => hex4(cid.get(ch))).join("");
  return { cmap, hex };
}

/* Word's Arabic output: hex strings of glyph indices, meaningless without the
   CMap. Reading these bytes as characters is what produced the soup. */
export function identityH(text) {
  const { cmap, hex } = subset(text);
  return build([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type0 /BaseFont /ABCDEF+Calibri /Encoding /Identity-H /ToUnicode 6 0 R >>",
    stream(`BT\n/F1 12 Tf\n<${hex}> Tj\nET`),
    stream(cmap),
  ]);
}

/* Two fonts on one page, each with its own CMap and DIFFERENT glyph ids for
   the same characters. Decoding a run through the wrong font's map is the
   defect this exists to catch, and it is invisible in a single-font file. */
export function twoFonts(a, b) {
  const A = subset(a), B = subset(b);
  return build([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type0 /BaseFont /AAAAAA+Calibri /Encoding /Identity-H /ToUnicode 7 0 R >>",
    "<< /Type /Font /Subtype /Type0 /BaseFont /BBBBBB+Amiri /Encoding /Identity-H /ToUnicode 8 0 R >>",
    stream(`BT\n/F1 12 Tf\n<${A.hex}> Tj\n/F2 12 Tf\n<${B.hex}> Tj\nET`),
    stream(A.cmap),
    stream(B.cmap),
  ]);
}

/* The same document with the CMap reference removed. */
export function identityHNoMap(text) {
  const { hex } = subset(text);
  return build([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type0 /BaseFont /ABCDEF+Calibri /Encoding /Identity-H >>",
    stream(`BT\n/F1 12 Tf\n<${hex}> Tj\nET`),
  ]);
}

/* Latin text as literal strings, including the TJ array form and escaping —
   the shapes that already worked and must not regress. */
export function winAnsi(text) {
  const esc = text.replace(/([()\\])/g, "\\$1");
  const half = Math.ceil(esc.length / 2);
  return build([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /TrueType /BaseFont /Arial /Encoding /WinAnsiEncoding >>",
    stream(`BT\n/F1 12 Tf\n[(${esc.slice(0, half)}) -20 (${esc.slice(half)})] TJ\nET`),
  ]);
}

/* A scan: one image, no text operators anywhere. */
export function scanned() {
  return build([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /Resources << /XObject << /Im1 5 0 R >> >> /Contents 4 0 R >>",
    stream("q 612 0 0 792 0 0 cm /Im1 Do Q"),
    stream(" ".repeat(200),
           { dict: "/Type /XObject /Subtype /Image /Width 20 /Height 20 /ColorSpace /DeviceGray /BitsPerComponent 8" }),
  ]);
}
