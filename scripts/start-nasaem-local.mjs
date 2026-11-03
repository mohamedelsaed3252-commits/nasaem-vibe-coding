import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";
const packageManager = isWindows ? "pnpm.cmd" : "pnpm";
const publicDirectory =
  process.env.NASAEM_PUBLIC_DIR ??
  path.join(root, "artifacts", "nasaem-inventory", "dist", "public");
const dataDirectory =
  process.env.NASAEM_DATA_DIR ?? path.join(root, "nasaem-data");
const migrationsDirectory =
  process.env.NASAEM_MIGRATIONS_DIR ?? path.join(root, "lib", "db", "drizzle");
const localPort = process.env.NASAEM_PORT ?? "8080";
const sharedEnv = {
  ...process.env,
  NODE_ENV: "development",
  NASAEM_LOCAL_MODE: "true",
  NASAEM_DATA_DIR: dataDirectory,
  NASAEM_PUBLIC_DIR: publicDirectory,
  NASAEM_MIGRATIONS_DIR: migrationsDirectory,
};

function runBuild(args, env) {
  const result = spawnSync(packageManager, args, {
    cwd: root,
    env,
    stdio: "inherit",
    shell: isWindows,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Build command failed: pnpm ${args.join(" ")}`);
  }
}

function lanAddresses() {
  const addresses = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) addresses.push(entry.address);
    }
  }
  return [...new Set(addresses)];
}

try {
  console.log("Building Nasaem for local shop use...");
  runBuild(
    ["--filter", "@workspace/nasaem-inventory", "run", "build"],
    {
      ...sharedEnv,
      PORT: "22615",
      BASE_PATH: "/",
      VITE_LOCAL_MODE: "true",
    },
  );
  runBuild(
    ["--filter", "@workspace/api-server", "run", "build"],
    { ...sharedEnv, PORT: localPort },
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : "Build failed");
  process.exit(1);
}

console.log("\nNasaem is starting. Keep this computer on for the shop to use it.");
console.log(`On this computer: http://localhost:${localPort}`);
const addresses = lanAddresses();
if (addresses.length) {
  for (const address of addresses) {
    console.log(`On the shop Wi-Fi: http://${address}:${localPort}`);
  }
} else {
  console.log("No shop network address found. Connect this computer to the shop Wi-Fi.");
}
console.log("Press Ctrl+C to stop the local system.\n");

const server = spawn(
  packageManager,
  ["--filter", "@workspace/api-server", "run", "start"],
  {
    cwd: root,
    env: { ...sharedEnv, PORT: localPort },
    stdio: "inherit",
    shell: isWindows,
  },
);

const stopServer = () => {
  if (!server.killed) server.kill("SIGINT");
};
process.on("SIGINT", stopServer);
process.on("SIGTERM", stopServer);
server.on("error", (error) => {
  console.error(`Could not start Nasaem: ${error.message}`);
  process.exitCode = 1;
});
server.on("exit", (code) => {
  process.exitCode = code ?? 0;
});
