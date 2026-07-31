// Low-level LLM client. Provider-pluggable because muapi.ai's Claude/text endpoint
// shape isn't publicly pinned — the endpoint is a *config value* (AI_PROVIDER + base URL),
// not a hardcode. When no key/provider is configured we run "disabled" so every caller
// falls back to its deterministic (regex) path and the app still works offline.
//
// Providers:
//   muapi     — OpenAI-compatible  POST {MUAPI_BASE_URL}/v1/chat/completions  (Bearer)
//   anthropic — Messages API       POST {ANTHROPIC_BASE_URL}/v1/messages       (x-api-key)
//   mock      — no network; chat() throws AiDisabledError

export type AiProvider = "muapi" | "anthropic" | "mock";

export class AiDisabledError extends Error {
  constructor() {
    super("AI provider is disabled (AI_PROVIDER=mock or no API key).");
    this.name = "AiDisabledError";
  }
}

export type ChatParams = {
  system: string;
  user: string;
  /** Ask the model to return strict JSON. */
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
};

function provider(): AiProvider {
  const p = (process.env.AI_PROVIDER ?? "muapi").toLowerCase();
  return p === "anthropic" || p === "mock" ? p : "muapi";
}

function apiKey(): string | undefined {
  return provider() === "anthropic"
    ? process.env.ANTHROPIC_API_KEY
    : process.env.MUAPI_API_KEY;
}

/** True when a real LLM call can be made. Callers use this to decide fallback. */
export function aiEnabled(): boolean {
  return provider() !== "mock" && !!apiKey();
}

export function aiModel(): string {
  return process.env.MUAPI_MODEL ?? "claude-sonnet-4-5";
}

/** Strip ```json fences / prose the model may wrap around a JSON object. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.search(/[[{]/);
  if (start === -1) throw new Error("No JSON found in model output");
  // Walk to the matching bracket so trailing prose doesn't break JSON.parse.
  const open = raw[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  for (let i = start; i < raw.length; i++) {
    if (raw[i] === open) depth++;
    else if (raw[i] === close && --depth === 0) {
      return JSON.parse(raw.slice(start, i + 1));
    }
  }
  return JSON.parse(raw.slice(start)); // best effort
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// muapi.ai uses a submit-then-poll pattern per model:
//   POST {base}/api/v1/{model}          {prompt, system_prompt?, image_url?}  → {request_id}
//   GET  {base}/api/v1/predictions/{id}/result → {status, outputs:[text]} | {detail:{status,error}}
// Auth is the x-api-key header. There's no response_format; JSON is requested in the prompt.
async function callMuapi(p: ChatParams, key: string): Promise<string> {
  const base = (process.env.MUAPI_BASE_URL ?? "https://api.muapi.ai").replace(/\/$/, "");
  const model = aiModel();

  const submit = await fetch(`${base}/api/v1/${model}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key },
    body: JSON.stringify({ prompt: p.user, system_prompt: p.system }),
  });
  if (!submit.ok) {
    throw new Error(`muapi submit ${submit.status}: ${await submit.text().catch(() => submit.statusText)}`);
  }
  const { request_id } = (await submit.json()) as { request_id?: string };
  if (!request_id) throw new Error("muapi: no request_id returned");

  // Poll for the result (typical inference ~10s). Cap so a stuck job can't hang a scan.
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    await sleep(1500);
    const res = await fetch(`${base}/api/v1/predictions/${request_id}/result`, {
      headers: { "x-api-key": key },
    });
    const body = (await res.json()) as {
      status?: string;
      outputs?: string[];
      detail?: { status?: string; error?: string };
    };
    const status = body.status ?? body.detail?.status;
    if (status === "completed") return body.outputs?.join("\n") ?? "";
    if (status === "failed" || body.detail?.error) {
      throw new Error(`muapi job failed: ${body.detail?.error ?? "unknown error"}`);
    }
    // else still processing/pending/queued → keep polling
  }
  throw new Error("muapi: result timed out");
}

async function callAnthropic(p: ChatParams, key: string): Promise<string> {
  const base = (process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com").replace(/\/$/, "");
  const res = await fetch(`${base}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: aiModel(),
      max_tokens: p.maxTokens ?? 1500,
      temperature: p.temperature ?? 0,
      system: p.system,
      messages: [{ role: "user", content: p.user }],
    }),
  });
  if (!res.ok) {
    throw new Error(`anthropic ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  }
  const data = (await res.json()) as { content?: { text?: string }[] };
  return data.content?.map((c) => c.text ?? "").join("") ?? "";
}

/** Single chat turn. Throws AiDisabledError when no provider is configured. */
export async function chat(p: ChatParams): Promise<string> {
  const key = apiKey();
  if (!aiEnabled() || !key) throw new AiDisabledError();
  return provider() === "anthropic" ? callAnthropic(p, key) : callMuapi(p, key);
}
