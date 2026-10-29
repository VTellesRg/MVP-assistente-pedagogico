import pdf from "pdf-parse";
import fs from "fs";

export async function extractPdfText(
  path: string
) {
  const buffer = fs.readFileSync(path);

  const data = await pdf(buffer);

  return data.text;
}