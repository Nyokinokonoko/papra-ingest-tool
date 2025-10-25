# papra-ingest-tool

A CLI tool for batch upload to Papra.

## Installation

You can run this tool without installation using `npx`:

```bash
npx papra-ingest-tool
```

Or install it globally:

```bash
npm install -g papra-ingest-tool
```

## Configuration

### First-Time Setup

On first run, the tool will automatically launch a configuration wizard to collect required settings:

```bash
npx papra-ingest-tool --setup
```

The wizard will prompt you for:

**Required:**

- **Papra URL**: Your Papra instance URL (e.g., `https://your-papra-instance.com`)
- **Papra API Key**: Your Papra API key
- **Papra Organization ID**: Your Papra organization ID

**Optional (for AI tagging feature):**

- **OpenRouter Endpoint**: OpenAI-compatible API endpoint (leave blank to skip)
- **OpenRouter API Key**: Your OpenRouter API key (leave blank to skip)
- **OpenRouter Model Name**: The model to use (leave blank to skip)

### Configuration File Location

The configuration is automatically saved to a platform-specific location:

- **Windows**: `%APPDATA%\papra-ingest-tool\config.json`
- **macOS**: `~/Library/Preferences/papra-ingest-tool/config.json`
- **Linux**: `~/.config/papra-ingest-tool/config.json`

### Updating Configuration

To update your configuration, run the setup wizard again:

```bash
npx papra-ingest-tool --setup
```

You can press Enter to keep existing values or type new ones to update.

### Manual Configuration

You can also manually edit the configuration file at the location shown above. The file format is:

```json
{
  "papra_url": "https://your-papra-instance.com",
  "papra_api_key": "your-papra-api-key",
  "papra_organization_id": "your-organization-id",
  "openrouter_endpoint": "https://openrouter.ai/api/v1",
  "openrouter_api_key": "your-openrouter-api-key",
  "openrouter_model_name": "anthropic/claude-3.5-sonnet"
}
```

## Usage

### Upload PDFs to Papra

The tool supports uploading PDF files to your Papra instance with optional OCR language specification.

#### Basic Usage

Upload a single PDF file (will prompt for path):

```bash
npx papra-ingest-tool
```

Upload with a specific file path:

```bash
npx papra-ingest-tool --src /path/to/file.pdf
```

Upload all PDFs in a directory (recursive):

```bash
npx papra-ingest-tool --src /path/to/folder
```

#### OCR Language Support

Specify OCR language(s) for document processing:

```bash
# Single language
npx papra-ingest-tool --src /path/to/folder --lang eng

# Multiple languages (comma-separated)
npx papra-ingest-tool --src /path/to/folder --lang eng,jpn,fra
```

**Supported OCR Languages:**

The tool supports 100+ languages including: `eng` (English), `jpn` (Japanese), `fra` (French), `deu` (German), `spa` (Spanish), `chi_sim` (Chinese Simplified), `chi_tra` (Chinese Traditional), `kor` (Korean), `ara` (Arabic), `rus` (Russian), and many more.

For a complete list of supported language codes, see the [Tesseract language codes](https://tesseract-ocr.github.io/tessdoc/Data-Files-in-different-versions.html).

#### Tag Support

Automatically tag uploaded documents with one or more tags:

```bash
# Single tag
npx papra-ingest-tool --src /path/to/folder --tag invoice

# Multiple tags (comma-separated)
npx papra-ingest-tool --src /path/to/folder --tag invoice,important,2024
```

**Tag Behavior:**

- If a tag doesn't exist, it will be automatically created with default color (#000000)
- Tags are case-insensitive when checking for existing tags
- Tags are prepared once at the start to minimize API calls
- All uploaded documents in the batch will receive the same tags

#### Command Line Options

- `--setup`: Run the configuration wizard
- `--src <path>`: Path to a PDF file or directory (optional, will prompt if not provided)
- `--lang <languages>`: OCR language codes, comma-separated (optional)
- `--tag <tags>`: Tag names, comma-separated (optional)

#### Examples

```bash
# Setup configuration
npx papra-ingest-tool --setup

# Upload with prompt for path
npx papra-ingest-tool

# Upload specific file
npx papra-ingest-tool --src document.pdf

# Upload directory with English OCR
npx papra-ingest-tool --src ./documents --lang eng

# Upload with multiple OCR languages
npx papra-ingest-tool --src ./invoices --lang eng,jpn,chi_sim

# Upload with tags
npx papra-ingest-tool --src ./invoices --tag invoice,2024

# Upload with both OCR languages and tags
npx papra-ingest-tool --src ./documents --lang eng,jpn --tag important,review

# Setup ignores other arguments
npx papra-ingest-tool --setup --src ./folder --lang eng
# (Only runs setup, ignores --src and --lang)
```

#### Behavior

- **Directory Upload**: When a directory is specified, the tool recursively searches for all PDF files and uploads them one by one.
- **File Validation**: Only PDF files are processed. Non-PDF files are rejected with an error message.
- **No PDFs Found**: If no PDF files are found in the specified directory, the tool exits gracefully with an error message.
- **Progress Tracking**: The tool displays upload progress, showing which file is being uploaded and the success/failure status.
- **Upload Summary**: After all files are processed, a summary is displayed showing total files, successful uploads, and failed uploads.

## Development

### Local Development

Clone the repository and install dependencies:

```bash
git clone https://github.com/Nyokinokonoko/papra-ingest-tool.git
cd papra-ingest-tool
npm install
```

Run the tool locally:

```bash
npm start
```

Or run the setup wizard:

```bash
npm start -- --setup
```

### Testing the CLI

Test the CLI locally before publishing:

```bash
npm link
papra-ingest-tool
```

## License

MIT © Kenny Ha
