import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/network",
  outputDir: "network-test-results",
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:5181",
    viewport: { width: 1024, height: 820 },
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm run signal",
      url: "http://127.0.0.1:9000/pocket-tanks",
      reuseExistingServer: false,
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 5181",
      url: "http://127.0.0.1:5181",
      env: { VITE_PEER_HOST: "127.0.0.1", VITE_PEER_PORT: "9000" },
      reuseExistingServer: false,
    },
  ],
  reporter: [["list"]],
});
