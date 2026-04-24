# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

An Electron desktop app for translating comics/manga. It uses AI vision models to read comic pages, reasoning models to produce translations, and image generation models to render translated pages. The UI is in Chinese (Simplified). Uses lucide-react for icons — no emoji anywhere in the project.

## Commands

```bash
# Run the app in dev mode
pnpm run dev

# Build for production
pnpm run build

# Preview production build
pnpm run preview
```

## Dependencies

```bash
pnpm install
```

Core: electron, electron-vite, React 18, TypeScript, TailwindCSS, DaisyUI, better-sqlite3, sharp, lucide-react.

## Architecture

### Process Model

- Main process: window management, SQLite (better-sqlite3), file I/O, all API calls, translation pipeline
- Renderer process: React SPA, pure UI, communicates via IPC
- Preload script: contextBridge exposes typed `window.api` object

### Translation Pipeline (4 phases)

Orchestrated in `src/main/translate-pipeline.ts` with semaphore-based concurrency control:

1. **Vision** — `vision-service.ts` sends each page to a vision model (OpenAI or Anthropic)
2. **Global Analysis** — `reasoning-service.ts` analyzes all vision results, produces master prompt
3. **Page Translation** — `reasoning-service.ts` translates each page using master prompt
4. **Image Generation** — `image-gen-service.ts` calls OpenAI Responses API (SSE) to edit images

Supports auto mode (phases chain automatically) and manual mode (pauses after each phase for user review).

### API Layer

All HTTP calls use Node.js native `fetch`. Two provider patterns:
- OpenAI-compatible: `/chat/completions` with Bearer auth
- Anthropic: `/messages` with `x-api-key` header
- Image gen: OpenAI Responses API `/v1/responses` with SSE streaming

### Data

- SQLite at `data/comics.db` (WAL mode, foreign keys on)
- Tables: `projects`, `pages`
- Config: `data/config.json`
- Output: `output/<project_name>/`

### UI Structure

Single window + Tab mode. Two fixed tabs (Bookshelf, Settings) + dynamic workspace tabs.
Workspace uses 3-column PDF-reader layout: left thumbnails, center image viewer, right detail panel.

### Key Config Fields

Prompts use `{source_lang}`, `{target_lang}`, `{master_prompt}`, `{refined}` as template variables. Empty fields fall back to defaults in `src/main/config.ts`.
