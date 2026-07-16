import {
  parseFeatureDocument,
  serializeFeatureDocument,
  type FeatureDocument,
} from "@spacetech/sfd-lang";
import { isRestorableFeatureDocument } from "../hooks/useAutosave";

export const MAX_SHARE_HASH_LENGTH = 8000;

function utf8ToBase64(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToUtf8(b64: string): string {
  const normalized = b64.replace(/-/g, "+").replace(/_/g, "/");
  const padded =
    normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function extractSharePayload(hash: string): string | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const match = raw.match(/(?:^|&)sfd=([^&]+)/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/** Compact URL hash share for feature documents (no server). */
export function encodeShareHash(doc: FeatureDocument): string {
  const json = serializeFeatureDocument(doc);
  return `#sfd=${utf8ToBase64(json)}`;
}

export function decodeShareHash(hash: string): FeatureDocument | null {
  const payload = extractSharePayload(hash);
  if (!payload) return null;
  try {
    const json = base64ToUtf8(payload);
    const doc = parseFeatureDocument(json);
    if (!isRestorableFeatureDocument(doc)) return null;
    return doc;
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
