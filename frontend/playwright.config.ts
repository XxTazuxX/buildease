import { defineConfig } from "@playwright/test";
const backendPort = process.env.E2E_BACKEND_PORT ?? "8080";
const frontendPort = process.env.E2E_FRONTEND_PORT ?? "5173";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: `http://localhost:${frontendPort}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command:
        "cd ../backend && ./mvnw -q test-compile exec:java -Dexec.mainClass=com.buildease.e2e.E2eServer -Dexec.classpathScope=test",
      url: `http://localhost:${backendPort}/api/auth/csrf`,
      timeout: 180000,
      reuseExistingServer: false,
    },
    {
      command: `npm run build && npm run preview -- --port ${frontendPort}`,
      url: `http://localhost:${frontendPort}`,
      timeout: 120000,
      reuseExistingServer: false,
    },
  ],
});
