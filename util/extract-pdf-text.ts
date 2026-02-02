import fs from "node:fs";
import path from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export async function extractTextFromPdf(pdfPath: string): Promise<string> {
  const data = new Uint8Array(fs.readFileSync(path.resolve(pdfPath)));
  const doc = await getDocument({ data, useSystemFonts: true }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((item: { str: string }) => item.str).join(" "));
  }
  return pages.join("\n");
}
