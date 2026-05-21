# Orchet Agent Examples

Golden-path examples for developers building Orchet Store agents.

## Examples

| Example | Protocol | Auth | What it proves |
| --- | --- | --- | --- |
| [`weather-public-readonly`](weather-public-readonly/) | SDK/API | none | A developer-hosted read-only agent can expose a manifest, OpenAPI tool schema, health endpoint, and tool route that Orchet can validate and invoke. |

## Local Validation

```bash
cd weather-public-readonly

npm install
npm run validate-manifest
npm run typecheck
npm run build
```

The example temporarily points at a reviewed SDK GitHub commit until `@orchet/agent-sdk@0.6.0` is published to npm. After publish, change the dependency back to `^0.6.0`. The scaffold pins `next@16.2.6` because earlier Next lines are flagged by `npm audit`; generated agents require Node 20.9+.

## Submission Flow

```bash
cd weather-public-readonly
npm pack
ORCHET_SIGNING_SECRET=... orchet-agent sign \
  --bundle ./orchet-weather-public-readonly-agent-0.1.0.tgz \
  --out .orchet/signature.json
ORCHET_DEVELOPER_TOKEN=... orchet-agent submit \
  --manifest-url https://weather-public-readonly.example.com/.well-known/agent.json \
  --bundle ./orchet-weather-public-readonly-agent-0.1.0.tgz \
  --signature-file .orchet/signature.json \
  --contact-email developers@orchet.ai
```
