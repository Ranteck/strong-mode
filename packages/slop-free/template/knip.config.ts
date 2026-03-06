/** @type {import("knip").KnipConfig} */
const config = {
  entry: ["src/index.ts"],
  project: ["src/**/*.ts"],
  ignore: ["**/*.test.ts", "**/*.spec.ts"],
  ignoreDependencies: [],
  ignoreExportsUsedInFile: false,
};

export default config;
