# **PROJECT_NAME**

TypeScript project hardened by `strong-mode` for safer vibe coding.

## Quality gates

```bash
npm run check
npm run quality
```

## Rules of thumb

- External input must be `unknown` and parsed with `zod`.
- Read environment variables only through `src/env.ts`.
- Do not use `any`, non-null assertions (`!`), or chained assertions (`as unknown as T`).
