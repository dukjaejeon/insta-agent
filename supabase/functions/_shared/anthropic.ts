const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | Array<{ type: string; [key: string]: unknown }>;
}

interface AnthropicResponse {
  content: Array<{ type: string; text?: string }>;
  usage: { input_tokens: number; output_tokens: number };
}

export async function callClaude({
  model = "claude-opus-4-6",
  system,
  messages,
  maxTokens = 4096,
}: {
  model?: string;
  system: string;
  messages: AnthropicMessage[];
  maxTokens?: number;
}): Promise<{ text: string; usage: { input_tokens: number; output_tokens: number } }> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errorBody}`);
  }

  const data: AnthropicResponse = await response.json();
  const text = data.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("");

  return { text, usage: data.usage };
}

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  // Haiku 4.5: $0.80/$4 per 1M tokens
  if (model.includes("haiku")) {
    return (inputTokens * 0.80 + outputTokens * 4.0) / 1_000_000;
  }
  // Sonnet 4.6: $3/$15 per 1M tokens
  if (model.includes("sonnet")) {
    return (inputTokens * 3.0 + outputTokens * 15.0) / 1_000_000;
  }
  // Opus 4.6: $15/$75 per 1M tokens
  return (inputTokens * 15.0 + outputTokens * 75.0) / 1_000_000;
}
