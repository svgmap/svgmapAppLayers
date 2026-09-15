export default {
  rootDir: "..",
  testEnvironment: "jest-environment-jsdom",
  setupFiles: ["<rootDir>/commonLib/__tests__/setupBrowserLibraries.js"],
  testMatch: ["<rootDir>/commonLib/__tests__/**/*.spec.js"]
};
