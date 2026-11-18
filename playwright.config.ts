import { defineConfig, devices } from '@playwright/test';

// node_modules carries Linux binaries, so the API and Vite run under WSL (the API on nvm node 22, which has
// Map.groupBy); Playwright and Chromium run on Windows and reach both through WSL's localhost forwarding.
//
// Playwright starts each command through the platform shell, which on Windows is cmd.exe. cmd.exe does not treat single
// quotes as quotes and splits a line at `&&`, so the bash script is wrapped in double quotes and holds no double quote,
// no backslash and nothing cmd.exe reads as its own ($HOME and the pipe-free commands are left for bash). The same
// string is valid for sh on Linux and macOS.
const root = '/mnt/c/Users/ahmed/Desktop/SolidSnake';
const node = '$HOME/.nvm/versions/node/v22.22.0/bin';
const inShell = (script: string) => (process.platform === 'win32' ? `wsl -e bash -lc "cd ${root} && ${script}"` : `bash -lc "${script}"`);

export default defineConfig({
  testDir: 'e2e',
  timeout: 240_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5199', trace: 'off', ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
  webServer: [
    {
      // Test-only signing key: the server refuses to start without one and e2e workspaces are throwaway.
      command: inShell(`PATH=${node}:$PATH PORT=8787 AUDIT_HMAC_KEY=e2e-only-audit-key-0123456789abcdef0123 exec npx tsx server/api/server.ts`),
      url: 'http://localhost:8787/api/session',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: inShell(`PATH=${node}:$PATH API_PORT=8787 VITE_CONFIG_NATIVE_IGNORE_WARNING=true exec npx vite --config e2e/vite.e2e.config.ts --port 5199 --strictPort --host 0.0.0.0`),
      url: 'http://localhost:5199/console/',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
