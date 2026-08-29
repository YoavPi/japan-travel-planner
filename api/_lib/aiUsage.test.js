const test = require("node:test");
const assert = require("node:assert");
const { usageFromGemini, generationRow } = require("./aiUsage");

test("usageFromGemini reads Gemini usageMetadata", () => {
  const data = { usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 800, totalTokenCount: 920 } };
  assert.deepStrictEqual(usageFromGemini(data), { prompt: 120, output: 800, total: 920 });
});

test("usageFromGemini returns nulls when metadata is missing", () => {
  assert.deepStrictEqual(usageFromGemini({}), { prompt: null, output: null, total: null });
  assert.deepStrictEqual(usageFromGemini(null), { prompt: null, output: null, total: null });
});

test("generationRow builds a create row with tokens", () => {
  const row = generationRow("u1", { usage: { prompt: 1, output: 2, total: 3 }, kind: "create" });
  assert.deepStrictEqual(row, { user_id: "u1", prompt_tokens: 1, output_tokens: 2, total_tokens: 3, kind: "create" });
});

test("generationRow defaults kind to create and tokens to null", () => {
  const row = generationRow("u2", {});
  assert.deepStrictEqual(row, { user_id: "u2", prompt_tokens: null, output_tokens: null, total_tokens: null, kind: "create" });
});

test("generationRow accepts refine kind", () => {
  assert.strictEqual(generationRow("u3", { kind: "refine" }).kind, "refine");
});
