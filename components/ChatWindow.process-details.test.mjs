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

test("uses completed group timing for every persisted turn footer", () => {
  assert.match(
    source,
    /getCompletedTurnTiming\(\s*entryTimestamps,\s*userIdx,\s*endIdx,\s*isLiveTail,\s*\)/,
  );
  assert.match(
    source,
    /if \(finalAssistantIdx === -1\) \{[\s\S]*?if \(turnTiming\) \{[\s\S]*?<TurnTimingFooter key=\{`turn-timing-\$\{userIdx\}-\$\{endIdx\}`\} turnTiming=\{turnTiming\} \/>/,
  );
  assert.match(
    source,
    /for \(let renderIdx = finalAssistantIdx \+ 1; renderIdx < endIdx; renderIdx\+\+\) \{[\s\S]*?if \(turnTiming\) \{[\s\S]*?<TurnTimingFooter key=\{`turn-timing-\$\{userIdx\}-\$\{endIdx\}`\} turnTiming=\{turnTiming\} \/>/,
  );
  assert.doesNotMatch(source, /turnTiming=\{options\.turnTiming\}/);
});
