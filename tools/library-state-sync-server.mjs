import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const host = "127.0.0.1";
const port = Number(process.env.LIBRARY_STATE_PORT ?? 3210);
const projectRoot = process.cwd();
const libraryStatePath = path.join(projectRoot, "artifacts", "common", "library-state.json");
const ALL_TRACKS_SENTINEL = "__ALL__";

const sendJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
};

const readLibraryState = () => {
  if (!fs.existsSync(libraryStatePath)) {
    return {
      nickname: "CleanKsen",
      selectedPlaylistId: "all",
      likedTrackIds: [],
      customPlaylists: [],
    };
  }

  return JSON.parse(fs.readFileSync(libraryStatePath, "utf-8"));
};

const normalizeTrackIds = (trackIds) => {
  if (trackIds === ALL_TRACKS_SENTINEL) {
    return ALL_TRACKS_SENTINEL;
  }

  if (!Array.isArray(trackIds)) {
    return [];
  }

  return Array.from(
    new Set(trackIds.filter((trackId) => typeof trackId === "string" && trackId.trim().length > 0))
  );
};

const normalizeLibraryState = (payload) => {
  const current = readLibraryState();

  return {
    nickname: typeof payload?.nickname === "string" && payload.nickname.trim() ? payload.nickname.trim() : current.nickname ?? "CleanKsen",
    selectedPlaylistId:
      typeof payload?.selectedPlaylistId === "string" && payload.selectedPlaylistId.trim().length > 0
        ? payload.selectedPlaylistId
        : "all",
    likedTrackIds: Array.isArray(payload?.likedTrackIds)
      ? Array.from(new Set(payload.likedTrackIds.filter((trackId) => typeof trackId === "string" && trackId.trim().length > 0)))
      : [],
    customPlaylists: Array.isArray(payload?.customPlaylists)
      ? payload.customPlaylists
          .filter((playlist) => playlist && typeof playlist.id === "string" && typeof playlist.name === "string")
          .map((playlist) => ({
            id: playlist.id,
            name: playlist.name,
            trackIds: normalizeTrackIds(playlist.trackIds),
          }))
      : current.customPlaylists ?? [],
  };
};

const server = http.createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${host}:${port}`);

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    response.end();
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/library-state") {
    sendJson(response, 200, readLibraryState());
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, {ok: true});
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/library-state") {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk.toString("utf-8");
    });
    request.on("end", () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        const normalized = normalizeLibraryState(parsed);
        fs.writeFileSync(libraryStatePath, JSON.stringify(normalized, null, 2) + "\n", "utf-8");
        sendJson(response, 200, {ok: true, libraryStatePath});
      } catch (error) {
        sendJson(response, 400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
    return;
  }

  sendJson(response, 404, {ok: false, error: "Not found"});
});

server.listen(port, host, () => {
  process.stdout.write(`[library-state-sync] listening on http://${host}:${port}\n`);
});

server.on("error", (error) => {
  if (error && typeof error === "object" && "code" in error && error.code === "EADDRINUSE") {
    process.stdout.write(`[library-state-sync] already running on http://${host}:${port}\n`);
    process.exit(0);
  }

  throw error;
});

const shutdown = () => {
  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
