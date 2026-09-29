/** Strip Unity TMP rich-text tags from almanac pedia strings for plain dossier display. */
export function stripTmpRichText(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/<\/?color(?:=[^>\s]*)?>/gi, "")
    .replace(/<\/?[bi]>/gi, "")
    .replace(/<\/?size(?:=[^>\s]*)?>/gi, "")
    .replace(/\r\n/g, "\n")
    .trim();
}
