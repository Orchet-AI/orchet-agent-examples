/**
 * OpenAPI 3.1 spec for Weather Public Readonly's tools.
 *
 * Served at /openapi.json. Generated from the agent's per-tool
 * configuration at scaffold time. Edit lib/openapi.ts to add new
 * tools or refine request/response schemas after generation.
 */

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

export const openapi = {
  openapi: "3.1.0",
  info: {
    title: "Weather Public Readonly for Orchet — REST tool surface",
    version: "0.1.0",
    description:
      "Tools that wrap Weather Public Readonly's API under the @orchet/agent-sdk contract.",
  },
  servers: [
    {
      url: "{base}/tools",
      variables: { base: { default: BASE_URL } },
    },
  ],
  components: {
    securitySchemes: {
      bearer: {
        type: "http",
        scheme: "bearer",
        description:
          "User-scoped Weather Public Readonly access token, attached by the Orchet router after resolving the user's connection.",
      },
    },
  },
  paths: {
  "/tools/weather_get_current": {
    "post": {
      "operationId": "weather_get_current",
      "summary": "Get current public weather for a city name.",
      "description": "Use this when the user asks for current weather, temperature, wind, or conditions in a city. This tool reads public weather data only and does not require account connection.",
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "city"
              ],
              "properties": {
                "city": {
                  "type": "string",
                  "minLength": 1,
                  "description": "City or place name, such as Tokyo or San Francisco."
                },
                "units": {
                  "type": "string",
                  "enum": [
                    "metric",
                    "imperial"
                  ],
                  "default": "metric",
                  "description": "metric returns Celsius and km/h; imperial returns Fahrenheit and mph."
                }
              },
              "additionalProperties": false
            }
          }
        }
      },
      "responses": {
        "200": {
          "description": "Tool result",
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "city",
                  "latitude",
                  "longitude",
                  "temperature",
                  "temperature_unit",
                  "wind_speed",
                  "wind_speed_unit",
                  "summary"
                ],
                "properties": {
                  "city": {
                    "type": "string"
                  },
                  "latitude": {
                    "type": "number"
                  },
                  "longitude": {
                    "type": "number"
                  },
                  "temperature": {
                    "type": "number"
                  },
                  "temperature_unit": {
                    "type": "string"
                  },
                  "wind_speed": {
                    "type": "number"
                  },
                  "wind_speed_unit": {
                    "type": "string"
                  },
                  "summary": {
                    "type": "string"
                  }
                },
                "additionalProperties": false
              }
            }
          }
        }
      },
      "x-orchet-tool": true,
      "x-orchet-cost-tier": "free",
      "x-orchet-requires-confirmation": false,
      "x-orchet-pii-required": [],
      "x-orchet-intent-tags": [
        "weather-public-readonly"
      ]
    }
  }
},
} as const;
