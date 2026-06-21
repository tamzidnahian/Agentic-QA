# Conduit QA Guide

## Application

Frontend:
http://127.0.0.1:3000

Backend:
http://127.0.0.1:3001/api

## Main routes

- `/` — homepage
- `/login` — sign-in page
- `/register` — registration page
- `/editor` — create an article
- `/settings` — user settings

## Visible homepage content

- conduit
- Home
- Sign in
- Sign up
- Global Feed
- Popular Tags

## Playwright rules

- Use TypeScript.
- Import test and expect from `@playwright/test`.
- Use role, label, text, or test-id locators.
- Do not use XPath.
- Do not use `waitForTimeout`.
- Do not use `test.skip`, `test.fixme`, or `test.only`.
- Every test must contain meaningful assertions.
- Tests may only access localhost.
- Tests must not edit application source files.
- Generated tests belong in `qa/tests/agent-generated`.

## Agent output rules (enforced by agent/guard.ts, not just this doc)
- Output must be a single .ts file, nothing else (no prose, no markdown fences).
- Must import from '@playwright/test' and contain at least one expect().
- Never reference process.env, fs, or child_process.
- If you cannot satisfy the ticket with a safe test, say so — do not guess.