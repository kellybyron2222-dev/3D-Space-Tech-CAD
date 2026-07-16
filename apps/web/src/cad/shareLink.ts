import {
  parseFeatureDocument,
  serializeFeatureDocument,
  type FeatureDocument,
} from "@spacetech/sfd-lang";

export const MAX_SHARE_HASH_LENGTH = 8000;

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

export function copyShareUrl(doc: FeatureDocument): string | null {
  const hash = encodeShareHash(doc);
  if (hash.length > MAX_SHARE_HASH_LENGTH) return null;
  const url = `${window.location.origin}${window.location.pathname}${hash}`;
  void navigator.clipboard?.writeText(url);
  return url;
}
