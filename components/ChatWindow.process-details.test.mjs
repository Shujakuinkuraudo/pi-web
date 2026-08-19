import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./ChatWindow.tsx", import.meta.url), "utf8");

test("expands process details when a completed turn has no final answer", () => {
  assert.match(source, /const \[expanded, setExpanded\] = useState\(defaultExpanded\)/);
  assert.match(
    source,
    /<ProcessDetailsGroup[\s\S]*?defaultExpanded=\{!finalAnswerMessage\}/,
  );
});

test("passes persisted visual-turn timing only to the final answer", () => {
  assert.match(
    source,
    /const turnTiming = getTurnTiming\(\s*entryTimestamps\[userIdx\],\s*entryTimestamps\[finalAssistantIdx\],\s*\)/,
  );
  assert.match(
    source,
    /renderMessage\(finalAssistantIdx, \{\s*messageOverride: finalAnswerMessage,\s*writtenFiles,\s*turnTiming,\s*\}\)/,
  );
});
