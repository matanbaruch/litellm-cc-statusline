#!/usr/bin/env node

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Package info
const packageJson = require('./package.json');
const VERSION = packageJson.version;
const NAME = packageJson.name;

// Cache file path
const CACHE_FILE = path.join(os.tmpdir(), 'litellm-cc-statusline-cache.json');
const CACHE_TTL_MS = 3000; // 3 seconds cache TTL

// Claude Code settings path
const CLAUDE_SETTINGS_DIR = path.join(os.homedir(), '.claude');
const CLAUDE_SETTINGS_FILE = path.join(CLAUDE_SETTINGS_DIR, 'settings.json');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

function showHelp() {
  console.log(`
${colors.bold}${NAME}${colors.reset} v${VERSION}

LiteLLM status line for Claude Code - displays user budget and spending.

${colors.bold}USAGE${colors.reset}
  ${NAME} [OPTIONS]

${colors.bold}OPTIONS${colors.reset}
  --help, -h      Show this help message
  --install       Install the status line in Claude Code settings
  --uninstall     Remove the status line from Claude Code settings
  --version, -v   Show version number

${colors.bold}ENVIRONMENT VARIABLES${colors.reset}
  ANTHROPIC_BASE_URL     LiteLLM proxy base URL (required)
  ANTHROPIC_AUTH_TOKEN   LiteLLM API key (required)

${colors.bold}INSTALLATION${colors.reset}
  1. Install globally: npm install -g ${NAME}
  2. Run: ${NAME} --install
  3. Restart Claude Code

${colors.bold}EXAMPLE${colors.reset}
  export ANTHROPIC_BASE_URL="https://your-litellm-proxy.com"
  export ANTHROPIC_AUTH_TOKEN="sk-your-api-key"
  ${NAME}

${colors.bold}MORE INFO${colors.reset}
  https://github.com/matan-anthropic/${NAME}
`);
}

function showVersion() {
  console.log(VERSION);
}

function findExecutablePath() {
  // Try to find where this package is installed
  const possiblePaths = [
    // Global npm install
    path.join(path.dirname(process.execPath), NAME),
    // npx or local
    process.argv[1],
    // Fallback to just the command name (relies on PATH)
    NAME,
  ];

  for (const p of possiblePaths) {
    if (p && fs.existsSync(p)) {
      return p;
    }
  }
  
  // Default to command name - will work if in PATH
  return NAME;
}

function installStatusLine() {
  try {
    // Create .claude directory if it doesn't exist
    if (!fs.existsSync(CLAUDE_SETTINGS_DIR)) {
      fs.mkdirSync(CLAUDE_SETTINGS_DIR, { recursive: true });
      console.log(`${colors.green}✓${colors.reset} Created ${CLAUDE_SETTINGS_DIR}`);
    }

    // Read existing settings or create new object
    let settings = {};
    if (fs.existsSync(CLAUDE_SETTINGS_FILE)) {
      try {
        const content = fs.readFileSync(CLAUDE_SETTINGS_FILE, 'utf8');
        settings = JSON.parse(content);
        console.log(`${colors.dim}Reading existing settings from ${CLAUDE_SETTINGS_FILE}${colors.reset}`);
      } catch (e) {
        console.log(`${colors.yellow}⚠${colors.reset} Could not parse existing settings, creating new file`);
      }
    }

    const execPath = findExecutablePath();

    // Add statusLine configuration
    settings.statusLine = {
      type: 'command',
      command: execPath,
      padding: 0,
    };

    // Write settings
    fs.writeFileSync(CLAUDE_SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
    
    console.log(`${colors.green}✓${colors.reset} Status line installed successfully!`);
    console.log(`${colors.dim}  Command: ${execPath}${colors.reset}`);
    console.log(`${colors.dim}  Settings: ${CLAUDE_SETTINGS_FILE}${colors.reset}`);
    console.log(`\n${colors.bold}Next steps:${colors.reset}`);
    console.log(`  1. Make sure ANTHROPIC_BASE_URL and ANTHROPIC_AUTH_TOKEN are set`);
    console.log(`  2. Restart Claude Code to see the status line`);
  } catch (error) {
    console.error(`${colors.red}✗${colors.reset} Failed to install: ${error.message}`);
    process.exit(1);
  }
}

function uninstallStatusLine() {
  try {
    if (!fs.existsSync(CLAUDE_SETTINGS_FILE)) {
      console.log(`${colors.yellow}⚠${colors.reset} No settings file found at ${CLAUDE_SETTINGS_FILE}`);
      return;
    }

    const content = fs.readFileSync(CLAUDE_SETTINGS_FILE, 'utf8');
    const settings = JSON.parse(content);

    if (!settings.statusLine) {
      console.log(`${colors.yellow}⚠${colors.reset} No status line configured`);
      return;
    }

    delete settings.statusLine;
    fs.writeFileSync(CLAUDE_SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
    
    console.log(`${colors.green}✓${colors.reset} Status line removed from Claude Code settings`);
    console.log(`${colors.dim}Restart Claude Code to apply changes${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}✗${colors.reset} Failed to uninstall: ${error.message}`);
    process.exit(1);
  }
}

function getSpendColor(percentage) {
  if (percentage < 50) return colors.green;
  if (percentage < 80) return colors.yellow;
  return colors.red;
}

function formatCurrency(value) {
  if (value === null || value === undefined) return '?';
  return value.toFixed(2);
}

function extractUsername(userInfo, currentKey) {
  if (currentKey && currentKey.key_alias) {
    return currentKey.key_alias;
  }
  if (userInfo && userInfo.user_email) {
    return userInfo.user_email.split('@')[0];
  }
  if (userInfo) {
    return userInfo.user_alias || userInfo.username || userInfo.user_id || 'unknown';
  }
  return 'unknown';
}

function findCurrentKey(keys, apiKey) {
  if (!keys || !apiKey) return null;
  const keyEnd = apiKey.slice(-4);
  for (const key of keys) {
    if (key.key_name && key.key_name.endsWith(keyEnd)) {
      return key;
    }
  }
  return null;
}

function formatStatusLine(data, apiKey) {
  const userInfo = data.user_info || data;
  const keys = data.keys || [];
  const currentKey = findCurrentKey(keys, apiKey);
  const username = extractUsername(userInfo, currentKey);
  
  let spend, maxBudget;
  if (currentKey) {
    spend = currentKey.spend || 0;
    maxBudget = currentKey.max_budget || userInfo.max_budget || 100;
  } else {
    spend = userInfo.spend || 0;
    maxBudget = userInfo.max_budget || 100;
  }
  
  const percentage = maxBudget > 0 ? (spend / maxBudget) * 100 : 0;
  const percentageDisplay = Math.round(percentage);
  const spendColor = getSpendColor(percentage);
  
  return `${colors.cyan}${username}${colors.reset} | 💰${spendColor}$${formatCurrency(spend)}/$${formatCurrency(maxBudget)} (${percentageDisplay}%)${colors.reset}`;
}

function readCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const content = fs.readFileSync(CACHE_FILE, 'utf8');
      const cache = JSON.parse(content);
      const isExpired = !cache.timestamp || (Date.now() - cache.timestamp >= CACHE_TTL_MS);
      return { data: cache.data, isExpired };
    }
  } catch (e) {}
  return { data: null, isExpired: true };
}

function writeCache(data) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ timestamp: Date.now(), data }), 'utf8');
  } catch (e) {}
}

function fetchUserInfo(baseUrl, apiKey) {
  return new Promise((resolve, reject) => {
    const url = new URL('/user/info', baseUrl);
    const protocol = url.protocol === 'https:' ? https : http;
    
    const req = protocol.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'GET',
      timeout: 5000,
      headers: {
        'accept': 'application/json',
        'x-litellm-api-key': apiKey,
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Invalid JSON'));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

async function runStatusLine() {
  // Consume stdin without blocking
  process.stdin.resume();
  process.stdin.on('data', () => {});
  
  const baseUrl = process.env.ANTHROPIC_BASE_URL;
  const apiKey = process.env.ANTHROPIC_AUTH_TOKEN;

  if (!baseUrl || !apiKey) {
    console.log('⚠ Set ANTHROPIC_BASE_URL and ANTHROPIC_AUTH_TOKEN');
    process.exit(0);
  }

  const cache = readCache();
  
  // Show cached data immediately if available
  if (cache.data) {
    console.log(formatStatusLine(cache.data, apiKey));
    
    // If cache is expired, refresh in background
    if (cache.isExpired) {
      fetchUserInfo(baseUrl, apiKey)
        .then(data => writeCache(data))
        .catch(() => {})
        .finally(() => process.exit(0));
    } else {
      process.exit(0);
    }
    return;
  }
  
  // No cache - must fetch
  try {
    const data = await fetchUserInfo(baseUrl, apiKey);
    writeCache(data);
    console.log(formatStatusLine(data, apiKey));
  } catch (error) {
    console.log(`${colors.dim}LiteLLM: ${error.message}${colors.reset}`);
  }
  process.exit(0);
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }
  
  if (args.includes('--version') || args.includes('-v')) {
    showVersion();
    process.exit(0);
  }
  
  if (args.includes('--install')) {
    installStatusLine();
    process.exit(0);
  }
  
  if (args.includes('--uninstall')) {
    uninstallStatusLine();
    process.exit(0);
  }
  
  // Default: run the status line
  runStatusLine();
}

main();
