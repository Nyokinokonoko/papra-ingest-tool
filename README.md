# papra-ingest-tool

A powerful CLI tool for batch uploading PDFs to Papra with OCR support and AI-powered auto-tagging.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Features](#features)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
  - [Upload PDFs](#upload-pdfs)
  - [OCR Language Support](#ocr-language-support)
  - [Manual Tagging](#manual-tagging)
  - [AI Auto-Tagging](#ai-auto-tagging)
  - [Command Reference](#command-reference)
- [Common Workflows](#common-workflows)
- [Development](#development)
- [License](#license)

---

## Quick Start

Get started in 3 easy steps:

```bash
# 1. Run setup wizard
npx papra-ingest-tool --setup

# 2. Upload your first PDF
npx papra-ingest-tool --src /path/to/document.pdf

# 3. Upload a folder with auto-tagging
npx papra-ingest-tool --src /path/to/folder --autotag
```

---

## Features

**Key Capabilities:**

- **Batch Upload** - Process single files or entire directories recursively
- **OCR Support** - 100+ languages including English, Japanese, Chinese, Korean, Arabic, and more
- **Manual Tagging** - Apply custom tags to organize your documents
- **AI Auto-Tagging** - Smart tag generation using LLM analysis (powered by OpenRouter)
- **Progress Tracking** - Real-time upload status and summary reports
- **Easy Configuration** - Interactive setup wizard with platform-specific config storage

---

## Installation

### Option 1: Run Without Installation (Recommended)

```bash
npx papra-ingest-tool
```

### Option 2: Global Installation

```bash
npm install -g papra-ingest-tool
```

---

## Configuration

### Initial Setup

Run the interactive setup wizard on first use:

```bash
npx papra-ingest-tool --setup
```

### Configuration Options

The wizard will prompt you for the following settings:

| Setting                   | Required | Description                                                       |
| ------------------------- | -------- | ----------------------------------------------------------------- |
| **Papra URL**             | Yes      | Your Papra instance URL (e.g., `https://your-papra-instance.com`) |
| **Papra API Key**         | Yes      | Your Papra API authentication key                                 |
| **Papra Organization ID** | Yes      | Your Papra organization identifier                                |
| **OpenRouter Endpoint**   | Optional | API endpoint (default: `https://openrouter.ai/api/v1`)            |
| **OpenRouter API Key**    | Optional | Required only for AI auto-tagging feature                         |
| **OpenRouter Model**      | Optional | LLM model name (default: `openai/gpt-5-nano`)                     |

> **Note:** OpenRouter settings are only needed if you want to use the AI auto-tagging feature.

### Config File Location

Configuration is automatically saved to a platform-specific location:

- **Windows**: `%APPDATA%\papra-ingest-tool\config.json`
- **macOS**: `~/Library/Preferences/papra-ingest-tool/config.json`
- **Linux**: `~/.config/papra-ingest-tool/config.json`

### Updating Configuration

Re-run the setup wizard to update settings:

```bash
npx papra-ingest-tool --setup
```

Press `Enter` to keep existing values or type new ones to update.

### Manual Configuration

You can also manually edit the configuration file:

```json
{
  "papra_url": "https://your-papra-instance.com",
  "papra_api_key": "your-papra-api-key",
  "papra_organization_id": "your-organization-id",
  "openrouter_endpoint": "https://openrouter.ai/api/v1",
  "openrouter_api_key": "your-openrouter-api-key",
  "openrouter_model_name": "openai/gpt-5-nano"
}
```

---

## Usage

### Upload PDFs

#### Basic Upload

Upload a single PDF (will prompt for path if not provided):

```bash
npx papra-ingest-tool
```

Upload with a specific file path:

```bash
npx papra-ingest-tool --src /path/to/file.pdf
```

Upload all PDFs in a directory recursively:

```bash
npx papra-ingest-tool --src /path/to/folder
```

### OCR Language Support

Specify OCR language(s) for document processing:

```bash
# Single language
npx papra-ingest-tool --src /path/to/folder --lang eng

# Multiple languages (comma-separated)
npx papra-ingest-tool --src /path/to/folder --lang eng,jpn,fra
```

**Supported Languages:**

The tool supports 100+ languages including:

- `eng` - English
- `jpn` - Japanese
- `fra` - French
- `deu` - German
- `spa` - Spanish
- `chi_sim` - Chinese Simplified
- `chi_tra` - Chinese Traditional
- `kor` - Korean
- `ara` - Arabic
- `rus` - Russian

For a complete list, see [Tesseract language codes](https://tesseract-ocr.github.io/tessdoc/Data-Files-in-different-versions.html).

### Manual Tagging

Apply custom tags to organize your documents:

```bash
# Single tag
npx papra-ingest-tool --src /path/to/folder --tag invoice

# Multiple tags (comma-separated)
npx papra-ingest-tool --src /path/to/folder --tag invoice,important,2024
```

**Tag Behavior:**

- Tags are created automatically if they don't exist (default color: `#000000`)
- Tag matching is case-insensitive
- All documents in the batch receive the same tags
- Tags are prepared once at the start to minimize API calls

### AI Auto-Tagging

Enable intelligent automatic tagging using LLM analysis:

```bash
# Enable auto-tagging
npx papra-ingest-tool --src /path/to/folder --autotag

# Combine with manual tags
npx papra-ingest-tool --src /path/to/folder --autotag --tag important
```

#### How It Works

1. **Local PDF Processing** - Extracts text from PDF files locally using `pdf-parse`
2. **Smart Summarization** - Creates compact summaries (≤2000 chars) including:
   - Document title and detected type
   - Key headings and sections
   - Important entities (dates, amounts, emails, IDs)
   - Top keywords using TF-IDF analysis
   - Excerpts from first and last pages
3. **LLM Analysis** - Sends summary (not full PDF) to LLM with existing tag list
4. **Tag Generation** - LLM generates 2-5 contextually relevant tags per document
5. **Tag Application** - Auto-generated tags + manual tags are attached to document

#### Key Features

- **Efficient** - Processes PDFs locally, sends only summaries to LLM
- **Accurate** - Individual document analysis for higher precision
- **Smart** - Prioritizes existing tags to maintain consistency
- **Fast** - 90-95% token reduction vs. sending full PDF
- **Cost-Effective** - Minimal API usage (~500-1000 tokens per document)
- **Deterministic** - Uses temperature 0 for consistent results

#### Requirements

> **Important:** Auto-tagging requires OpenRouter configuration. Run `npx papra-ingest-tool --setup` to configure:
>
> - OpenRouter API Key (required)
> - OpenRouter Endpoint (optional)
> - OpenRouter Model Name (optional)

### Command Reference

| Option           | Description                          | Example               |
| ---------------- | ------------------------------------ | --------------------- |
| `--setup`        | Run configuration wizard             | `--setup`             |
| `--src <path>`   | Path to PDF file or directory        | `--src /path/to/docs` |
| `--lang <codes>` | OCR language codes (comma-separated) | `--lang eng,jpn`      |
| `--tag <tags>`   | Tag names (comma-separated)          | `--tag invoice,2024`  |
| `--autotag`      | Enable AI auto-tagging               | `--autotag`           |

---

## Common Workflows

### Scenario 1: Upload Invoices with Manual Tags

```bash
npx papra-ingest-tool --src ./invoices --tag invoice,finance,2024
```

### Scenario 2: Multilingual Documents with OCR

```bash
npx papra-ingest-tool --src ./documents --lang eng,jpn,chi_sim
```

### Scenario 3: AI Auto-Tagging for Smart Organization

```bash
npx papra-ingest-tool --src ./documents --autotag
```

### Scenario 4: Complete Workflow (OCR + Auto-Tag + Manual Tags)

```bash
npx papra-ingest-tool --src ./invoices --lang eng,jpn --autotag --tag finance
```

### Scenario 5: Setup Configuration First

```bash
# Setup ignores other arguments and only runs configuration wizard
npx papra-ingest-tool --setup --src ./folder --lang eng
```

---

## Development

### Local Development Setup

Clone and install:

```bash
git clone https://github.com/Nyokinokonoko/papra-ingest-tool.git
cd papra-ingest-tool
npm install
```

Run locally:

```bash
npm start
```

Run setup wizard:

```bash
npm start -- --setup
```

### Testing the CLI

Test CLI locally before publishing:

```bash
npm link
papra-ingest-tool
```

---

## License

MIT © Kenny Ha
