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

Once configured, simply run:

```bash
npx papra-ingest-tool
```

The tool will validate your configuration and proceed with the main functionality.

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
