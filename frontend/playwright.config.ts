import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command:
        "cd ../backend && ./mvnw -q test-compile exec:java -Dexec.mainClass=com.buildease.e2e.E2eServer -Dexec.classpathScope=test",
      url: "http://localhost:8080/api/auth/csrf",
      timeout: 180000,
      reuseExistingServer: false,
    },
    {
      command: "npm run build && npm run preview",
      url: "http://localhost:5173",
      timeout: 120000,
      reuseExistingServer: false,
    },
  ],
});
