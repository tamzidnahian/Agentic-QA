import { Command } from "@langchain/langgraph";
import { execSync } from "child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { commentOnTicket } from "./jiraClient";
import { validate } from "./guard";
import { qaGraph } from "./graph";

const [mode, key, decision] = process.argv.slice(2);

if (!mode || !key || !["start", "resume"].includes(mode)) {
  console.error("Usage: npm run agent:start -- QA-123 | npm run agent:resume -- QA-123 approve|reject");
  process.exit(1);
}

const config = { configurable: { thread_id: key } };
const stateDir = "qa/.agent-state";
const pendingPath = `${stateDir}/${key}.json`;

function savePendingApproval(code: string) {
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(pendingPath, JSON.stringify({ ticketKey: key, code, ts: Date.now() }, null, 2));
}

async function resumeFromPending(decision: string | undefined) {
  if (!existsSync(pendingPath)) return false;

  const pending = JSON.parse(readFileSync(pendingPath, "utf8")) as { ticketKey: string; code: string };
  if (decision !== "approve") {
    unlinkSync(pendingPath);
    console.log("Stopped (rejected).");
    return true;
  }

  const guard = validate(pending.code);
  if (!guard.ok) {
    unlinkSync(pendingPath);
    console.log(`Stopped (guard-failed): ${guard.reason}`);
    return true;
  }

  mkdirSync("qa/tests/agent-generated", { recursive: true });
  const testPath = `qa/tests/agent-generated/${pending.ticketKey}.spec.ts`;
  writeFileSync(testPath, pending.code);

  let passed = false;
  let failureLog = "";
  try {
    execSync(`npx.cmd playwright test ${testPath}`, { stdio: "pipe" });
    passed = true;
  } catch (e: any) {
    failureLog = String(e.stdout ?? e).slice(0, 1500);
  }

  mkdirSync("qa/.metrics", { recursive: true });
  appendFileSync(
    "qa/.metrics/ledger.jsonl",
    JSON.stringify({ ticket: pending.ticketKey, passed, totalIn: 0, totalOut: 0, ts: Date.now() }) + "\n",
  );

  const detail = failureLog ? ` Failure log: ${failureLog.slice(0, 500)}` : "";
  await commentOnTicket(pending.ticketKey, `AI-QA: ${passed ? "PASSED" : "FAILED"}. Tokens in/out: 0/0.${detail}`);
  unlinkSync(pendingPath);
  console.log(`Done. Passed: ${passed}`);
  return true;
}

async function main() {
  if (mode === "start") {
    const r = (await qaGraph.invoke({ ticketKey: key, usage: [] }, config)) as any;
    if (r.__interrupt__) {
      const code = r.__interrupt__[0].value.code;
      savePendingApproval(code);
      console.log(`Review:\n${code}\n\nnpm run agent:resume -- ${key} approve   (or reject)`);
    } else {
      console.log("Stopped before approval. Check guardrails or ticket details.");
    }
  } else {
    if (await resumeFromPending(decision)) return;

    const r = await qaGraph.invoke(new Command({ resume: decision }), config);
    console.log(r.passed === undefined ? "Stopped (rejected/guard-failed)." : `Done. Passed: ${r.passed}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
