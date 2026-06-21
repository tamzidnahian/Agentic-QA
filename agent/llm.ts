import { ChatOpenAI } from "@langchain/openai";

export const planModel = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
  maxTokens: 400,
});

export const codeModel = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
  maxTokens: 500,
});

export const analysisModel = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
  maxTokens: 250,
});
