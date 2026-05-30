#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";

const listenHost = process.env.RELAY_LISTEN_HOST || "0.0.0.0";
const listenPort = Number(process.env.RELAY_LISTEN_PORT || "4501");
const relayToken = process.env.RELAY_TOKEN || "";
const upstreamUrl = new URL(process.env.UPSTREAM_WS_URL || "ws://192.168.0.164:4500");
const upstreamTokenFile = process.env.UPSTREAM_TOKEN_FILE || "/Users/ningjiangzhu/.codex/app-server/mobile.token";
const upstreamToken = fs.readFileSync(upstreamTokenFile, "utf8").trim();

const server = http.createServer((req, res) => {
  if (req.url?.startsWith("/readyz")) {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end("ok");
    return;
  }

  res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  res.end("not found");
});

server.on("upgrade", (request, downstreamSocket) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || `${listenHost}:${listenPort}`}`);
  const providedRelayToken = url.searchParams.get("relay_token") || "";

  if (relayToken && providedRelayToken !== relayToken) {
    rejectUpgrade(downstreamSocket, 403, "relay token mismatch");
    return;
  }

  const upgradeHeader = String(request.headers.upgrade || "").toLowerCase();
  const connectionHeader = String(request.headers.connection || "").toLowerCase();
  const downstreamKey = request.headers["sec-websocket-key"];

  if (upgradeHeader !== "websocket" || !connectionHeader.includes("upgrade") || !downstreamKey) {
    rejectUpgrade(downstreamSocket, 400, "invalid websocket upgrade");
    return;
  }

  const upstreamRequest = http.request({
    host: upstreamUrl.hostname,
    port: upstreamUrl.port,
    path: `${upstreamUrl.pathname || "/"}${upstreamUrl.search || ""}`,
    headers: {
      Connection: "Upgrade",
      Upgrade: "websocket",
      "Sec-WebSocket-Version": "13",
      "Sec-WebSocket-Key": crypto.randomBytes(16).toString("base64"),
      Authorization: `Bearer ${upstreamToken}`,
    },
  });

  upstreamRequest.on("upgrade", (upstreamResponse, upstreamSocket) => {
    acceptUpgrade(downstreamSocket, String(downstreamKey));

    downstreamSocket.on("error", () => {
      upstreamSocket.destroy();
    });
    upstreamSocket.on("error", () => {
      downstreamSocket.destroy();
    });

    downstreamSocket.pipe(upstreamSocket);
    upstreamSocket.pipe(downstreamSocket);
  });

  upstreamRequest.on("response", (upstreamResponse) => {
    let body = "";
    upstreamResponse.setEncoding("utf8");
    upstreamResponse.on("data", (chunk) => {
      body += chunk;
    });
    upstreamResponse.on("end", () => {
      rejectUpgrade(downstreamSocket, upstreamResponse.statusCode || 502, body || "upstream rejected");
    });
  });

  upstreamRequest.on("error", (error) => {
    rejectUpgrade(downstreamSocket, 502, error.message);
  });

  upstreamRequest.end();
});

server.listen(listenPort, listenHost, () => {
  console.log(
    JSON.stringify(
      {
        ok: true,
        listen: `ws://${listenHost}:${listenPort}`,
        readyz: `http://${listenHost}:${listenPort}/readyz`,
        upstream: upstreamUrl.toString(),
        relayTokenRequired: Boolean(relayToken),
      },
      null,
      2,
    ),
  );
});

function acceptUpgrade(socket, key) {
  const accept = crypto.createHash("sha1").update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
  socket.write(
    [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${accept}`,
      "\r\n",
    ].join("\r\n"),
  );
}

function rejectUpgrade(socket, statusCode, message) {
  socket.write(
    [
      `HTTP/1.1 ${statusCode} Error`,
      "Content-Type: text/plain; charset=utf-8",
      `Content-Length: ${Buffer.byteLength(message)}`,
      "Connection: close",
      "",
      message,
    ].join("\r\n"),
  );
  socket.destroy();
}
