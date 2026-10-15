export interface NimoAssistResult {
  text: string;
  source: "nimo";
  draft: true;
}

export class NimoClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NimoClientError";
  }
}

function extractText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Record<string, unknown>;
  for (const key of ["text", "response", "message", "answer", "content"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  if (record.data && typeof record.data === "object") return extractText(record.data);
  return "";
}

/**
 * Uses the verified NIMO-CORE chat contract as optional text assistance only.
 * This adapter does not transcribe audio or claim to produce verified timestamps.
 */
export async function assistWithLyrics(input: string, signal?: AbortSignal): Promise<NimoAssistResult> {
  const base = import.meta.env.VITE_NIMO_API_BASE_URL?.trim().replace(/\/$/, "");
  if (!base) {
    throw new NimoClientError("NIMO is not configured. Set VITE_NIMO_API_BASE_URL to your NIMO-CORE base URL.");
  }
  if (!input.trim()) throw new NimoClientError("Add or import lyrics before asking NIMO for help.");
  if (input.length > 6000) throw new NimoClientError("Lyrics input is too large for this assist request (maximum 6,000 characters).");

  let response: Response;
  try {
    const timeoutSignal = typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(15_000) : undefined;
    response = await fetch(`${base}/api/nimo/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: [
          "You are assisting the Wavy lyrics editor.",
          "Only reformat the user-provided lyrics into clear line breaks.",
          "Preserve supplied words and language. Do not invent missing lyrics or timestamps and do not claim official accuracy.",
          "Return only the reformatted lyric text, without a preamble.",
          "",
          "User-provided lyrics:",
          input,
        ].join("\n"),
        context: { application: "wavy", task: "lyric-formatting", output: "plain-text-draft" },
      }),
      signal: signal ?? timeoutSignal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new NimoClientError("NIMO request timed out. Check the service and try again.");
    }
    throw new NimoClientError("Could not reach NIMO-CORE. Check the base URL, CORS policy, and service health.");
  }

  if (!response.ok) {
    if (response.status === 429) throw new NimoClientError("NIMO rate limit reached. Wait a moment and try again.");
    if (response.status === 401 || response.status === 403) throw new NimoClientError("NIMO rejected this request. Check service access configuration.");
    throw new NimoClientError(`NIMO-CORE returned HTTP ${response.status}. Check its logs and try again.`);
  }

  let payload: unknown;
  try { payload = await response.json(); } catch {
    throw new NimoClientError("NIMO returned an invalid JSON response.");
  }
  const text = extractText(payload);
  if (!text) throw new NimoClientError("NIMO returned no readable text. Your original lyrics were not changed.");
  return { text, source: "nimo", draft: true };
}
