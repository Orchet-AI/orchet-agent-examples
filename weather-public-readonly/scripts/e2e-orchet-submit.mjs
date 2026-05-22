#!/usr/bin/env node
import { parseManifest } from "@orchet/agent-sdk/manifest";
import { manifest as localManifest } from "../lib/manifest.ts";
import { openapi as localOpenApi } from "../lib/openapi.ts";

const DEFAULT_AGENT_BASE = "https://weather-public-readonly.orchet.ai";
const DEFAULT_API_BASE = "https://api.orchet.ai";
const DEFAULT_WEB_BASE = "https://www.orchet.ai";

const flags = parseFlags(process.argv.slice(2));

if (flags.help || flags.h) {
  printHelp();
  process.exit(0);
}

const validateLocal = Boolean(flags["validate-local"]);
const validateOnly = validateLocal || Boolean(flags["validate-only"]);
const apiBase = normalizeBase(
  String(flags["api-base"] ?? process.env.ORCHET_API_BASE ?? DEFAULT_API_BASE),
);
const webBase = normalizeBase(
  String(flags["web-base"] ?? process.env.ORCHET_WEB_BASE ?? DEFAULT_WEB_BASE),
);
const agentBase = normalizeBase(
  String(
    flags["agent-base"] ??
      process.env.ORCHET_AGENT_BASE_URL ??
      process.env.ORCHET_WEATHER_PUBLIC_READONLY_AGENT_BASE_URL ??
      DEFAULT_AGENT_BASE,
  ),
);
const manifestUrl = `${agentBase}/.well-known/agent.json`;
const openapiUrl = `${agentBase}/openapi.json`;
const healthUrl = `${agentBase}/health`;

try {
  const { manifest, openapi, health } = validateLocal
    ? await loadLocalArtifacts()
    : await loadRemoteArtifacts({ manifestUrl, openapiUrl, healthUrl });

  const parsedManifest = parseManifest(manifest);
  const tools = validateOpenApi(openapi);
  validateHealth(health, parsedManifest.agent_id, parsedManifest.version);

  console.log("validated artifacts");
  console.log(`agent: ${parsedManifest.agent_id}@${parsedManifest.version}`);
  console.log(`tools: ${tools.join(", ")}`);

  if (validateOnly) {
    console.log("validate-only: no submission was sent");
    process.exit(0);
  }

  const token = process.env.ORCHET_DEVELOPER_TOKEN ?? process.env.ORCHET_API_TOKEN;
  if (!token?.trim()) {
    fail(
      "Missing ORCHET_DEVELOPER_TOKEN. Create one at https://www.orchet.ai/developer/keys.",
    );
  }
  const contactEmail = String(
    flags["contact-email"] ?? process.env.ORCHET_CONTACT_EMAIL ?? "",
  ).trim();
  if (!contactEmail) {
    fail("Missing contact email. Set ORCHET_CONTACT_EMAIL or pass --contact-email.");
  }

  const accepted = await submitAgent({
    apiBase,
    token,
    contactEmail,
    manifestUrl,
    openapiUrl,
    healthUrl,
  });
  const submissionId = String(accepted.submission_id ?? "");
  if (!submissionId) {
    fail(`Submit response did not include submission_id: ${JSON.stringify(accepted)}`);
  }

  console.log(`submission accepted: ${submissionId}`);
  const finalState = await pollSubmission({ apiBase, token, submissionId });
  console.log(`state: ${finalState}`);
  console.log(`developer url: ${webBase}/developer/submissions/${submissionId}`);
  console.log(`admin review url: ${webBase}/admin/review-queue`);
} catch (err) {
  fail(err instanceof Error ? err.message : String(err));
}

async function loadLocalArtifacts() {
  return {
    manifest: localManifest,
    openapi: localOpenApi,
    health: {
      status: "ok",
      agent_id: localManifest.agent_id,
      version: localManifest.version,
      checked_at: Date.now(),
    },
  };
}

async function loadRemoteArtifacts(urls) {
  const [manifest, openapi, health] = await Promise.all([
    getJson(urls.manifestUrl, "manifest"),
    getJson(urls.openapiUrl, "OpenAPI"),
    getJson(urls.healthUrl, "health"),
  ]);
  return { manifest, openapi, health };
}

async function submitAgent(args) {
  const res = await fetch(`${args.apiBase}/marketplace/submissions/sdk`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${args.token}`,
    },
    body: JSON.stringify({
      manifest_url: args.manifestUrl,
      openapi_url: args.openapiUrl,
      health_url: args.healthUrl,
      contact_email: args.contactEmail,
      requested_tier: "community",
    }),
  });
  const body = await safeJson(res);
  if (!res.ok) {
    fail(`submit failed (${res.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

async function pollSubmission(args) {
  const maxPolls = numberFlag("max-polls", 12);
  const intervalMs = numberFlag("poll-interval-ms", 1500);
  let lastState = "unknown";

  for (let attempt = 0; attempt < maxPolls; attempt += 1) {
    if (attempt > 0) await sleep(intervalMs);
    const res = await fetch(
      `${args.apiBase}/marketplace/submissions/${encodeURIComponent(args.submissionId)}`,
      { headers: { authorization: `Bearer ${args.token}` } },
    );
    const body = await safeJson(res);
    if (!res.ok) {
      fail(`status failed (${res.status}): ${JSON.stringify(body)}`);
    }
    lastState = String(body.submission?.state ?? body.state ?? lastState);
    if (["pending", "in_review", "approved", "rejected"].includes(lastState)) {
      return lastState;
    }
  }

  return lastState;
}

async function getJson(url, label) {
  let res;
  try {
    res = await fetch(url, { headers: { accept: "application/json" } });
  } catch (err) {
    fail(`${label} fetch failed from ${url}: ${formatError(err)}`);
  }
  const body = await safeJson(res);
  if (!res.ok) {
    fail(`${label} fetch failed (${res.status}) from ${url}: ${JSON.stringify(body)}`);
  }
  return body;
}

function formatError(err) {
  if (err instanceof Error) {
    const cause = err.cause instanceof Error ? ` (${err.cause.message})` : "";
    return `${err.message}${cause}`;
  }
  return String(err);
}

async function safeJson(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

function validateOpenApi(openapi) {
  if (!openapi || typeof openapi !== "object") fail("OpenAPI must be an object");
  if (typeof openapi.openapi !== "string" || !openapi.openapi.startsWith("3.")) {
    fail("OpenAPI version must start with 3.");
  }
  if (!openapi.paths || typeof openapi.paths !== "object") {
    fail("OpenAPI paths object is required");
  }

  const tools = [];
  for (const [path, pathItem] of Object.entries(openapi.paths)) {
    if (!pathItem || typeof pathItem !== "object") continue;
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;
      if (!operation || typeof operation !== "object") continue;
      if (operation["x-orchet-tool"] !== true) continue;
      if (typeof operation.operationId !== "string" || !operation.operationId.trim()) {
        fail(`OpenAPI tool at ${method.toUpperCase()} ${path} is missing operationId`);
      }
      const schema =
        operation.requestBody?.content?.["application/json"]?.schema ??
        operation.parameters;
      if (!schema) {
        fail(`OpenAPI tool ${operation.operationId} is missing input schema`);
      }
      tools.push(operation.operationId);
    }
  }

  if (!tools.includes("weather_get_current")) {
    fail("OpenAPI must expose x-orchet-tool operation weather_get_current");
  }
  return tools;
}

function validateHealth(health, agentId, version) {
  if (!health || typeof health !== "object") fail("health response must be an object");
  if (health.status !== "ok" && health.status !== "degraded") {
    fail(`health.status must be ok or degraded, got ${String(health.status)}`);
  }
  if (health.agent_id !== agentId) {
    fail(`health.agent_id mismatch: expected ${agentId}, got ${String(health.agent_id)}`);
  }
  if (health.version !== version) {
    fail(`health.version mismatch: expected ${version}, got ${String(health.version)}`);
  }
}

function numberFlag(name, fallback) {
  const raw = flags[name] ?? process.env[`ORCHET_E2E_${name.toUpperCase().replaceAll("-", "_")}`];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    fail(`--${name} must be a positive number`);
  }
  return value;
}

function normalizeBase(raw) {
  const value = raw.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//.test(value)) {
    fail(`URL must start with http:// or https://: ${raw}`);
  }
  return value;
}

function parseFlags(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      fail(`Unexpected positional argument: ${arg}`);
    }
    const raw = arg.slice(2);
    const eq = raw.indexOf("=");
    if (eq >= 0) {
      parsed[raw.slice(0, eq)] = raw.slice(eq + 1);
      continue;
    }
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      parsed[raw] = true;
      continue;
    }
    parsed[raw] = next;
    i += 1;
  }
  return parsed;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fail(message) {
  console.error(`e2e submit failed: ${message}`);
  process.exit(1);
}

function printHelp() {
  console.log(`Weather demo Orchet submission E2E

Usage:
  npm run e2e:submit -- --agent-base https://weather-public-readonly.orchet.ai --contact-email dev@example.com

Required for real submission:
  ORCHET_DEVELOPER_TOKEN=orchet_dev_...
  ORCHET_CONTACT_EMAIL=dev@example.com

Options:
  --agent-base <url>       Deployed weather agent base URL
  --api-base <url>         Orchet API base, defaults to ${DEFAULT_API_BASE}
  --web-base <url>         Orchet web base, defaults to ${DEFAULT_WEB_BASE}
  --contact-email <email>  Developer contact email
  --validate-only          Validate deployed manifest/OpenAPI/health without submitting
  --validate-local         Validate local manifest/OpenAPI/health without network or token
  --max-polls <n>          Status poll attempts, defaults to 12
  --poll-interval-ms <n>   Status poll interval, defaults to 1500
`);
}
