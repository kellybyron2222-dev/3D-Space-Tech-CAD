import {
  parseDocument,
  type SfdDocument,
  type SfdProjectFile,
} from "@spacetech/sfd-lang";
import {
  createReference3USystemsPack,
  type SystemsPack,
} from "@spacetech/systems";

export interface AppProjectFile {
  format: "spacetech-project";
  formatVersion: 2;
  savedAt: string;
  document: SfdDocument;
  systems: SystemsPack;
}

export function toAppProjectFile(
  doc: SfdDocument,
  systems: SystemsPack,
): AppProjectFile {
  return {
    format: "spacetech-project",
    formatVersion: 2,
    savedAt: new Date().toISOString(),
    document: doc,
    systems,
  };
}

export function parseAppProjectFile(raw: string): {
  document: SfdDocument;
  systems: SystemsPack;
} {
  const parsed = JSON.parse(raw) as AppProjectFile | SfdProjectFile | SfdDocument;

  if (
    parsed &&
    typeof parsed === "object" &&
    "format" in parsed &&
    parsed.format === "spacetech-project"
  ) {
    const doc = parseDocument(JSON.stringify(parsed.document));
    const systems =
      "systems" in parsed && parsed.systems
        ? (parsed.systems as SystemsPack)
        : createReference3USystemsPack();
    return { document: doc, systems };
  }

  return {
    document: parseDocument(raw),
    systems: createReference3USystemsPack(),
  };
}
