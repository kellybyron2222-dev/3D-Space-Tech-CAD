import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import {
  createEmptyDocument,
  createReference3UDocument,
  getParam,
  serializeDocument,
} from "@spacetech/sfd-lang";
import { createEmptyLedger, summarize } from "@spacetech/budgets";
import { runCdsScorecard } from "@spacetech/rules-cds";

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "127.0.0.1";

/** In-memory project store for MVP-1 scaffolding */
const projects = new Map<string, { id: string; name: string; sfd: string }>();

export function buildServer() {
  const app = Fastify({ logger: true });

  app.get("/health", async () => ({ ok: true, service: "spacetech-api" }));

  app.get("/v1/demo/reference-3u", async () => {
    const doc = createReference3UDocument();
    const chassis = doc.parts.find((p) => p.id === "chassis");
    const w = chassis ? getParam(chassis, "widthMm", 100) : 100;
    const d = chassis ? getParam(chassis, "depthMm", 100) : 100;
    const h = chassis ? getParam(chassis, "heightMm", 340.5) : 340.5;

    const ledger = createEmptyLedger();
    ledger.massItems.push({
      id: "structure",
      name: "Structure (placeholder)",
      massKg: 1.5,
      cgMm: { x: 0, y: 0, z: h / 2 },
    });
    ledger.powerItems.push({
      id: "bus",
      name: "Bus loads (placeholder)",
      wattsByMode: { safe: 1, nominal: 3, peak: 5, eclipse: 2 },
    });
    ledger.assumptions.push("MVP placeholder masses — not a flight design");

    const summary = summarize(ledger);
    const scorecard = runCdsScorecard({
      units: 3,
      envelopeMm: { x: w, y: d, z: h },
      totalMassKg: summary.totalMassKg,
    });

    return {
      document: doc,
      sfd: serializeDocument(doc),
      budgetSummary: summary,
      scorecard,
      disclaimer: "Not flight-qualified. Educational placeholder data.",
    };
  });

  app.post<{ Body: { name?: string } }>("/v1/projects", async (req) => {
    const id = crypto.randomUUID();
    const name = req.body?.name?.trim() || "Untitled";
    const sfd = serializeDocument(createEmptyDocument(name));
    const project = { id, name, sfd };
    projects.set(id, project);
    return project;
  });

  app.get<{ Params: { id: string } }>("/v1/projects/:id", async (req, reply) => {
    const project = projects.get(req.params.id);
    if (!project) {
      return reply.code(404).send({ error: "not_found" });
    }
    return project;
  });

  return app;
}

async function main() {
  const app = buildServer();
  await app.listen({ port, host });
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
