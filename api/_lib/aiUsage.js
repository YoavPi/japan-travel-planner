/* Pure helpers for recording AI-generation usage. No I/O — unit-tested. */

const num = (v) => (Number.isFinite(v) ? v : null);

/* Extract token counts from a Gemini generateContent response. */
function usageFromGemini(data) {
  const m = (data && data.usageMetadata) || {};
  return { prompt: num(m.promptTokenCount), output: num(m.candidatesTokenCount), total: num(m.totalTokenCount) };
}

/* Build the ai_generations insert row. */
function generationRow(userId, { usage = {}, kind = "create" } = {}) {
  return {
    user_id: userId,
    prompt_tokens: usage.prompt ?? null,
    output_tokens: usage.output ?? null,
    total_tokens: usage.total ?? null,
    kind: kind === "refine" ? "refine" : "create",
  };
}

module.exports = { usageFromGemini, generationRow };
