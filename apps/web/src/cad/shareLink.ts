import {
  parseFeatureDocument,
  serializeFeatureDocument,
  type FeatureDocument,
} from "@spacetech/sfd-lang";

/** Compact URL hash share for feature documents (no server). */
export function encodeShareHash(doc: FeatureDocument): string {
  const json = serializeFeatureDocument(doc);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return `#sfd=${b64}`;
}

export function decodeShareHash(hash: string): FeatureDocument | null {
  const m = hash.match(/#sfd=([A-Za-z0-9+/=]+)/);
  if (!m?.[1]) return null;
  try {
    const json = decodeURIComponent(escape(atob(m[1])));
    return parseFeatureDocument(json);
  } catch {
    return null;
  }
}

export function copyShareUrl(doc: FeatureDocument): string {
  const url = `${window.location.origin}${window.location.pathname}${encodeShareHash(doc)}`;
  void navigator.clipboard?.writeText(url);
  return url;
}
