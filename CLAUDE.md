# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A PySide6 desktop app for translating comics/manga. It uses AI vision models to read comic pages, reasoning models to produce translations, and image generation models to render translated pages. The UI is in Chinese (Simplified).

## Commands

```bash
# Run the app
python main.py

# Run all tests
pytest

# Run a single test
pytest tests/test_database.py
pytest tests/test_file_manager.py -k "test_name"
```

## Dependencies

```bash
pip install -r requirements.txt
```

Core deps: PySide6, Pillow. Tests use pytest + pytest-qt.

## Architecture

### Translation Pipeline (4 phases)

The core workflow in `ComicWorkspace._start_translation()` runs sequentially through four phases, each using the `WorkerPool` for concurrency:

1. **Vision** — `VisionService` sends each comic page image to a vision model (OpenAI or Anthropic) to extract text and positional descriptions
2. **Global Analysis** — `ReasoningService.analyze_global()` takes all vision results and produces a "master prompt" (总控提示词) with character names, terminology, and style guidelines for translation consistency
3. **Page Translation** — `ReasoningService.translate_page()` translates each page using the master prompt for context
4. **Image Generation** — `ImageGenService` calls the OpenAI Responses API (`/v1/responses` with SSE streaming) to edit the original image with translated text

Phase transitions happen in `_on_page_finished` and `_on_all_finished` — when all pages complete a phase, the next phase starts automatically. The pipeline is resumable: on restart, it inspects existing data (vision_result, refined_translation, final_prompt) to determine where each page left off.

### API Layer

All HTTP calls use `urllib.request` directly (no SDK dependencies). Two provider patterns:
- **OpenAI-compatible**: `/chat/completions` with Bearer auth — used by VisionService and ReasoningService
- **Anthropic**: `/messages` with `x-api-key` header — used by VisionService and ReasoningService
- **Image gen**: OpenAI Responses API at `/v1/responses` with SSE streaming — handled by `provider_api.py`

Provider selection is driven by `ModelConfig.provider` field ("openai" or "anthropic").

### Concurrency

`WorkerPool` wraps `QThreadPool`. `TranslateWorker` is a `QRunnable` with built-in exponential backoff retry. Signals (`page_finished`, `page_error`, `page_progress`, `all_finished`) bridge worker threads back to the Qt main thread.

### Data

- SQLite database at `data/comics.db` (WAL mode, foreign keys on)
- Two tables: `projects` (comic collections) and `pages` (individual images within a project)
- Config stored as JSON at `data/config.json` via `AppConfig` dataclass
- Logs at `data/logs/comics-translate.log`
- Translated images output to `output/<project_name>/`

### UI Structure

`MainWindow` uses a `QTabWidget` with two permanent tabs (Bookshelf, Settings) and dynamic tabs for each opened comic project (`ComicWorkspace`). Double-clicking a comic card in `BookshelfWidget` opens its `ComicWorkspace`. Double-clicking a page thumbnail opens `PageDetailDialog` for viewing/editing per-page results and regenerating individual images.

### Key Config Fields

Prompts in `AppConfig` use `{source_lang}`, `{target_lang}`, `{master_prompt}`, `{refined}` as template variables. Empty prompt fields fall back to hardcoded defaults in `config.py`.
