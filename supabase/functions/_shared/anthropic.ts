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
  model = "claude-opus-4-20250514",
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
  // Opus 4 pricing (per 1M tokens): $15 input, $75 output
  // Haiku pricing (per 1M tokens): $0.25 input, $1.25 output
  if (model.includes("haiku")) {
    return (inputTokens * 0.25 + outputTokens * 1.25) / 1_000_000;
  }
  return (inputTokens * 15 + outputTokens * 75) / 1_000_000;
}
