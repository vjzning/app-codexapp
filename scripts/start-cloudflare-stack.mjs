#!/usr/bin/env node

import fs from "node:fs";
import net from "node:net";
import { spawn } from "node:child_process";
import qrcode from "qrcode-terminal";

const mobileTokenFile = process.env.CODEX_APP_SERVER_TOKEN_FILE || "/Users/ningjiangzhu/.codex/app-server/mobile.token";
const relayTokenFile = process.env.RELAY_TOKEN_FILE || "/Users/ningjiangzhu/.codex/app-server/relay.token";
const cloudflaredConfig = process.env.CLOUDFLARED_CONFIG || "/Users/ningjiangzhu/.cloudflared/codex-mobile.yml";

const children = [];

await assertFile(mobileTokenFile, "Codex app-server token");
await assertFile(relayTokenFile, "relay token");
await assertFile(cloudflaredConfig, "cloudflared config");
await assertPortFree(4500);
await assertPortFree(4501);

const relayToken = fs.readFileSync(relayTokenFile, "utf8").trim();
const mobileUrl = "wss://codex-mobile.zaime.me";
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
    RELAY_LISTEN_HOST: "127.0.0.1",
    RELAY_LISTEN_PORT: "4501",
    RELAY_TOKEN: relayToken,
    UPSTREAM_WS_URL: "ws://127.0.0.1:4500",
    UPSTREAM_TOKEN_FILE: mobileTokenFile,
  },
);

start("cloudflared", "cloudflared", ["tunnel", "--config", cloudflaredConfig, "run"]);

console.log("\nCloudflare stack is starting.");
console.log("Mobile URL:");
console.log(`${mobileUrl}?relay_token=${relayToken}`);
console.log("\nScan this QR in the mobile app connection settings:");
qrcode.generate(mobileConnectionPayload, { small: true });
console.log("\nPress Ctrl+C to stop all processes.\n");

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

async function assertFile(path, label) {
  if (!fs.existsSync(path)) {
    throw new Error(`${label} not found: ${path}`);
  }
}

function assertPortFree(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") {
        reject(new Error(`port ${port} is already in use`));
        return;
      }
      reject(error);
    });
    server.once("listening", () => {
      server.close(() => resolve());
    });
    server.listen(port, "127.0.0.1");
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
