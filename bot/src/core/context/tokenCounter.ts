export interface TokenCounter {
  count(text: string): number;
}

// Rough placeholder estimator, NOT an exact tokenizer.
// Real tokenizers differ per model, and non-English text (including Armenian)
// usually needs more tokens per character. The ratios below are guesses and
// should be replaced by values measured on the models we actually use.
export class HeuristicTokenCounter implements TokenCounter {
  constructor(
    private asciiCharsPerToken = 4,
    private otherCharsPerToken = 1.5,
  ) {}

  count(text: string): number {
    let ascii = 0;
    let other = 0;
    for (const ch of text) {
      if (ch.charCodeAt(0) < 128) ascii++;
      else other++;
    }
    return Math.ceil(ascii / this.asciiCharsPerToken + other / this.otherCharsPerToken);
  }
}
