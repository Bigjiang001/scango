import { spawnSync } from "node:child_process";
const envId = process.argv[2];
if (!envId || !/^[a-zA-Z0-9-]+$/.test(envId)) {
  console.error(
    "用法：npm run deploy:cloudbase -- 环境ID（先通过 tcb login 登录）",
  );
  process.exit(1);
}
for (const [cmd, args] of [
  ["npm", ["run", "build:cloudbase"]],
  [
    "npx",
    [
      "--yes",
      "@cloudbase/cli@3.8.4",
      "hosting",
      "deploy",
      "dist-cloudbase",
      "-e",
      envId,
    ],
  ],
]) {
  const result = spawnSync(cmd, args, { stdio: "inherit" });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
