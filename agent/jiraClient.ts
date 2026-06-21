import { readFileSync } from "fs";

const envPath = ".env.qa";

function loadEnvFile() {
  try {
    const raw = readFileSync(envPath, "utf8");

    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;

      const [, key, value] = match;
      if (process.env[key]) continue;

      process.env[key] = value.replace(/^["']|["']$/g, "");
    }
  } catch {
    // The CI path provides environment variables directly.
  }
}

loadEnvFile();

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const jiraBaseUrl = () => required("JIRA_BASE_URL").replace(/\/$/, "");

const authHeader = () => {
  const email = required("JIRA_EMAIL");
  const token = required("JIRA_API_TOKEN");
  return `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;
};

async function jiraFetch(path: string, init: RequestInit = {}) {
  const response = await fetch(`${jiraBaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(),
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Jira ${response.status}: ${text}`);
  }

  return response;
}

function adfToText(value: any): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(adfToText).filter(Boolean).join("\n");
  if (typeof value !== "object") return "";

  const ownText = typeof value.text === "string" ? value.text : "";
  const childText = adfToText(value.content);
  return [ownText, childText].filter(Boolean).join(value.type === "paragraph" ? "\n" : "");
}

export async function getTicket(key: string) {
  const response = await jiraFetch(`/rest/api/3/issue/${encodeURIComponent(key)}`);
  const issue = await response.json();

  return {
    key: issue.key as string,
    summary: String(issue.fields?.summary ?? ""),
    description: adfToText(issue.fields?.description).trim(),
  };
}

export async function commentOnTicket(key: string, text: string) {
  await jiraFetch(`/rest/api/3/issue/${encodeURIComponent(key)}/comment`, {
    method: "POST",
    body: JSON.stringify({
      body: {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text }],
          },
        ],
      },
    }),
  });
}
