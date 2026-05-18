import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

export type LLMMessage = { role: "system" | "user" | "assistant"; content: string };

export async function invokeLLM(options: {
  messages: LLMMessage[];
  response_format?: { type: "json_schema"; json_schema: object };
  max_completion_tokens?: number;
}): Promise<{ choices: [{ message: { content: string } }] }> {
  const response = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: options.max_completion_tokens ?? 4096,
    messages: options.messages,
    ...(options.response_format ? { response_format: options.response_format as any } : {}),
  });
  return { choices: [{ message: { content: response.choices[0].message.content ?? "" } }] };
}

export async function transcribeAudio(audioBuffer: Buffer, language = "fr"): Promise<string> {
  const file = new File([audioBuffer], "audio.wav", { type: "audio/wav" });
  const result = await openai.audio.transcriptions.create({
    file,
    model: "gpt-4o-mini-transcribe",
    response_format: "json",
    language,
  });
  return result.text;
}
