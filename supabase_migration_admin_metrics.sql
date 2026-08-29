-- Admin dashboard metrics — additive, backward-compatible (old rows = null → 0/unknown).
alter table ai_generations
  add column if not exists prompt_tokens int,
  add column if not exists output_tokens int,
  add column if not exists total_tokens  int,
  add column if not exists kind          text;

alter table trips
  add column if not exists source text;
