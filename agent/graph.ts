import { Annotation, END, interrupt, MemorySaver, START, StateGraph } from "@langchain/langgraph";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import { z } from "zod";
import { getTicket, commentOnTicket } from "./jiraClient";
import { validate } from "./guard";
import { analysisModel, codeModel, planModel } from "./llm";

const GUIDE = readFileSync("qa/context/conduit-guide.md", "utf8");

const Plan = z.object({
  scenario: z.string(),
  steps: z.array(z.string()),
  assertions: z.array(z.string()),
});

const State = Annotation.Root({
  ticketKey: Annotation<string>(),
  summary: Annotation<string>(),
  description: Annotation<string>(),
  plan: Annotation<z.infer<typeof Plan>>(),
  code: Annotation<string>(),
  guard: Annotation<{ ok: boolean; reason?: string }>(),
  approved: Annotation<boolean>(),
  passed: Annotation<boolean>(),
  failureLog: Annotation<string>(),
  analysis: Annotation<string>(),
  usage: Annotation<Array<{ in: number; out: number }>>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),
});

const tok = (r: any) => [
  {
    in: r.usage_metadata?.input_tokens ?? 0,
    out: r.usage_metadata?.output_tokens ?? 0,
  },
];

const readStory = async (s: typeof State.State) => {
  const t = await getTicket(s.ticketKey);
  return { summary: t.summary, description: t.description };
};

const planTest = async (s: typeof State.State) => {
  const plan = await planModel.withStructuredOutput(Plan).invoke(
    `${GUIDE}\n\nTicket ${s.ticketKey}: ${s.summary}\n${s.description}\nProduce a concise test plan.`,
  );
  return { plan };
};

const generateTest = async (s: typeof State.State) => {
  const r = await codeModel.invoke(
    `${GUIDE}\n\nWrite ONE Playwright .ts test for this plan. Output ONLY code.\n${JSON.stringify(s.plan)}`,
  );

  return {
    code: String(r.content).replace(/```ts|```typescript|```/g, "").trim(),
    usage: tok(r),
  };
};

const guardrail = async (s: typeof State.State) => ({ guard: validate(s.code) });

const humanApproval = async (s: typeof State.State) => {
  const decision = interrupt({ question: `Approve test for ${s.ticketKey}?`, code: s.code });
  return { approved: decision === "approve" };
};

const runPlaywright = async (s: typeof State.State) => {
  mkdirSync("qa/tests/agent-generated", { recursive: true });
  const path = `qa/tests/agent-generated/${s.ticketKey}.spec.ts`;
  writeFileSync(path, s.code);

  try {
    execSync(`npx playwright test ${path}`, { stdio: "pipe" });
    return { passed: true };
  } catch (e: any) {
    return { passed: false, failureLog: String(e.stdout ?? e).slice(0, 1500) };
  }
};

const analyzeFailures = async (s: typeof State.State) => {
  const r = await analysisModel.invoke(
    `Test failed. Give likely cause (1 sentence) + suggested fix (1 sentence).\nCode:\n${s.code}\nLog:\n${s.failureLog}`,
  );
  return { analysis: String(r.content), usage: tok(r) };
};

const recordMetrics = async (s: typeof State.State) => {
  const totalIn = s.usage.reduce((a, x) => a + x.in, 0);
  const totalOut = s.usage.reduce((a, x) => a + x.out, 0);

  mkdirSync("qa/.metrics", { recursive: true });
  appendFileSync(
    "qa/.metrics/ledger.jsonl",
    JSON.stringify({ ticket: s.ticketKey, passed: s.passed, totalIn, totalOut, ts: Date.now() }) + "\n",
  );
  await commentOnTicket(
    s.ticketKey,
    `AI-QA: ${s.passed ? "PASSED" : "FAILED"}. Tokens in/out: ${totalIn}/${totalOut}.${
      s.analysis ? " " + s.analysis : ""
    }`,
  );
  return {};
};

export const qaGraph = new StateGraph(State)
  .addNode("readStory", readStory)
  .addNode("planTest", planTest)
  .addNode("generateTest", generateTest)
  .addNode("guardrail", guardrail)
  .addNode("humanApproval", humanApproval)
  .addNode("runPlaywright", runPlaywright)
  .addNode("analyzeFailures", analyzeFailures)
  .addNode("recordMetrics", recordMetrics)
  .addEdge(START, "readStory")
  .addEdge("readStory", "planTest")
  .addEdge("planTest", "generateTest")
  .addEdge("generateTest", "guardrail")
  .addConditionalEdges("guardrail", (s) => (s.guard.ok ? "humanApproval" : END))
  .addConditionalEdges("humanApproval", (s) => (s.approved ? "runPlaywright" : END))
  .addConditionalEdges("runPlaywright", (s) => (s.passed ? "recordMetrics" : "analyzeFailures"))
  .addEdge("analyzeFailures", "recordMetrics")
  .addEdge("recordMetrics", END)
  .compile({ checkpointer: new MemorySaver() });
