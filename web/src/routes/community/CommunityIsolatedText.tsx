/**
 * Mixed-direction text isolation (slice COMMUNITY).
 *
 * Community bodies are user text and routinely mix directions (an English
 * body naming an Arabic dish, an Arabic reply quoting English). Rendering
 * such runs inline lets the surrounding paragraph's base direction reorder
 * them into gibberish. Each directional run is therefore wrapped in <bdi>
 * (unicode-bidi: isolate) so every run keeps its own reading order while the
 * paragraph flows in the UI language's direction.
 */
import type { ReactNode } from "react";

/** Arabic + Hebrew + Syriac + Thaana + presentation-forms blocks. */
const RTL_RUN = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u08A0-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]+/g;

/** Split text into per-direction runs (each becomes one <bdi>). */
function directionalRuns(text: string): { rtl: boolean; value: string }[] {
  const runs: { rtl: boolean; value: string }[] = [];
  let last = 0;
  for (const match of text.matchAll(RTL_RUN)) {
    const index = match.index ?? 0;
    if (index > last) runs.push({ rtl: false, value: text.slice(last, index) });
    runs.push({ rtl: true, value: match[0] });
    last = index + match[0].length;
  }
  if (last < text.length) runs.push({ rtl: false, value: text.slice(last) });
  return runs.length > 0 ? runs : [{ rtl: false, value: "" }];
}

/**
 * Renders `text` with each directional run isolated in its own <bdi>.
 * Whitespace is preserved (user line breaks render), and fully-neutral
 * strings degrade to a single isolated run — identical to plain text.
 */
export function CommunityIsolatedText({
  text,
  className,
}: {
  text: string;
  className?: string;
}): ReactNode {
  return (
    <span className={className} style={{ unicodeBidi: "isolate" }}>
      {directionalRuns(text).map((run, i) => (
        <bdi key={i}>{run.value}</bdi>
      ))}
    </span>
  );
}
