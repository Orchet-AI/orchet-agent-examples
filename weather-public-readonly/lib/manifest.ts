/**
 * Weather Public Readonly agent manifest.
 *
 * Served at /.well-known/agent.json. Conforms to @orchet/agent-sdk's
 * AgentManifestSchema (v0.6.0).
 *
 * OAuth client_id/secret are NEVER in this manifest — they're env-var
 * names that resolve at runtime per ADR-015's hard credential boundary.
 */
import { defineManifest } from "@orchet/agent-sdk/manifest";

function resolveBaseUrl(): string {
  const configured = process.env.ORCHET_WEATHER_PUBLIC_READONLY_AGENT_BASE_URL;
  if (configured) return configured;
  const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (productionUrl) return `https://${productionUrl.replace(/^https?:\/\//, "")}`;
  const deploymentUrl = process.env.VERCEL_URL;
  if (deploymentUrl) return `https://${deploymentUrl.replace(/^https?:\/\//, "")}`;
  return "https://weather-public-readonly.orchet.ai";
}

const BASE_URL = resolveBaseUrl();

export const manifest = defineManifest({
  agent_id: "weather-public-readonly",
  version: "0.1.0",
  domain: BASE_URL,
  display_name: "Weather Public Readonly",
  one_liner: "Get current public weather for a city without user authentication.",
  intents: ["weather", "forecast", "temperature", "wind"],
  example_utterances: [
    "What's the weather in Tokyo?",
    "How windy is it in San Francisco?",
    "Current temperature in Chennai",
  ],
  openapi_url: `${BASE_URL}/openapi.json`,
  health_url: `${BASE_URL}/health`,
  ui: { components: [] },
  sla: {
    p50_latency_ms: 800,
    p95_latency_ms: 2500,
    availability_target: 0.99,
  },
  pii_scope: [],
  requires_payment: false,
  supported_regions: ["US"],
  capabilities: {
    sdk_version: "0.6.0",
    supports_compound_bookings: false,
    implements_cancellation: false,
    payment_mode: "agent_owned",
  },


  listing: {
    category: "Weather",
    homepage_url: BASE_URL,
    about_paragraphs: [
      "Read-only public weather lookup powered by Open-Meteo.",
      "No user account connection or personal data is required.",
    ],
    pricing_note: "",
    privacy_policy_url: "https://orchet.ai/privacy",
    terms_url: "https://orchet.ai/terms",
  },
  on_call_escalation: "mailto:developers@orchet.ai",
});
