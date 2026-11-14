import sanitizeHtml from "sanitize-html";
import { badRequest } from "../errors.js";

export const NOTES_MAX_LENGTH = 10_000;

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["b", "strong", "i", "em", "u", "p", "br", "ul", "ol", "li"],
  allowedAttributes: {},
  disallowedTagsMode: "discard",
};

/** Rich-text notes from the editor → allow-listed HTML. Empty paragraphs collapse to "". */
export function sanitizeNotes(html: string): string {
  const clean = sanitizeHtml(html, OPTIONS).trim();
  if (clean.replace(/<\/?p>|<br\s*\/?>/g, "").trim() === "") return "";
  if (clean.length > NOTES_MAX_LENGTH) throw badRequest(`Notes must be at most ${NOTES_MAX_LENGTH} characters`);
  return clean;
}
