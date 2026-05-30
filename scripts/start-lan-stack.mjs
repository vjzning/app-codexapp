#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import qrcode from "qrcode-terminal";

const mobileTokenFile = process.env.CODEX_APP_SERVER_TOKEN_FILE || homePath(".codex", "app-server", "mobile.token");
const relayTokenFile = process.env.RELAY_TOKEN_FILE || homePath(".codex", "app-server", "relay.token");
const listenPort = Number(process.env.RELAY_LISTEN_PORT || "4501");
const publicHost = process.env.CODEX_MOBILE_LAN_HOST || getLanIpAddress();
const mobileUrl = `ws://${publicHost}:${listenPort}`;
const children = [];

await ensureTokenFile(mobileTokenFile, "Codex app-server token");
await ensureTokenFile(relayTokenFile, "relay token");
await assertPortFree(4500, "127.0.0.1");
await assertPortFree(listenPort, "0.0.0.0");

const relayToken = fs.readFileSync(relayTokenFile, "utf8").trim();
const mobileConnectionPayload = JSON.stringify({
  kind: "codex-mobile-connection",
  version: 1,
  url: mobileUrl,
  token: relayToken,
});

start("codex-app-server", "codex", [
  "app-server",
  "--listen",
  "ws://127.0.0.1:4500",
  "--ws-auth",
  "capability-token",
  "--ws-token-file",
  mobileTokenFile,
]);

start(
  "relay",
  "node",
  ["scripts/app-server-relay.mjs"],
  {
    RELAY_LISTEN_HOST: "0.0.0.0",
    RELAY_LISTEN_PORT: String(listenPort),
    RELAY_TOKEN: relayToken,
    UPSTREAM_WS_URL: "ws://127.0.0.1:4500",
    UPSTREAM_TOKEN_FILE: mobileTokenFile,
  },
);

console.log("\nLAN stack is starting.");
console.log("Mobile URL:");
console.log(`${mobileUrl}?relay_token=${relayToken}`);
console.log("\nScan this QR in the mobile app connection settings:");
qrcode.generate(mobileConnectionPayload, { small: true });
console.log("\nKeep your phone and this computer on the same network. Press Ctrl+C to stop.\n");

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("exit", () => {
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
});

function start(name, command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...extraEnv,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  children.push(child);

  child.stdout.on("data", (chunk) => {
    writePrefixed(name, chunk);
  });

  child.stderr.on("data", (chunk) => {
    writePrefixed(name, chunk);
  });

  child.on("exit", (code, signal) => {
    if (code === 0 || signal) {
      return;
    }

    console.error(`[${name}] exited with code ${code}`);
    shutdown();
  });
}

function writePrefixed(name, chunk) {
  for (const line of String(chunk).split(/\r?\n/)) {
    if (line) {
      console.log(`[${name}] ${line}`);
    }
  }
}

function homePath(...segments) {
  return path.join(os.homedir(), ...segments);
}

async function ensureTokenFile(filePath, label) {
  if (fs.existsSync(filePath)) {
    return;
  }

  // 首次运行自动生成本地 token，避免开源用户还没配置就启动失败。
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${crypto.randomBytes(32).toString("hex")}\n`, { mode: 0o600 });
  console.log(`${label} created: ${filePath}`);
}

function getLanIpAddress() {
  const interfaces = os.networkInterfaces();

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal) {
        return entry.address;
      }
    }
  }

  throw new Error("No LAN IPv4 address found. Set CODEX_MOBILE_LAN_HOST manually.");
}

function assertPortFree(port, host) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") {
        reject(new Error(`port ${host}:${port} is already in use`));
        return;
      }
      reject(error);
    });
    server.once("listening", () => {
      server.close(() => resolve());
    });
    server.listen(port, host);
  });
}

function shutdown() {
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
  process.exit(0);
}
