// Signaling discovers the other browser; game traffic uses one WebRTC data channel.
// Only the host simulates. Guests send bounded commands, never terrain or scores.
export const PROTOCOL = 3;
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const roomCode = () =>
  Array.from(
    crypto.getRandomValues(new Uint8Array(6)),
    (n) => alphabet[n % alphabet.length],
  ).join("");
export const cleanCode = (s) =>
  String(s)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
export function signalingOptions() {
  const host = import.meta.env.VITE_PEER_HOST;
  return host
    ? {
        host,
        port: Number(import.meta.env.VITE_PEER_PORT || 9000),
        path: import.meta.env.VITE_PEER_PATH || "/pocket-tanks",
        secure: import.meta.env.VITE_PEER_SECURE === "true",
      }
    : {};
}
export class Room {
  constructor(handlers) {
    Object.assign(this, handlers);
    this.role = null;
    this.code = "";
    this.status = "idle";
    this.reason = "";
    this.connected = false;
    this.peer = null;
    this.conn = null;
    this.closed = false;
    this.token = Array.from(crypto.getRandomValues(new Uint8Array(24)), (n) =>
      n.toString(16).padStart(2, "0"),
    ).join("");
    this.seat = null;
    this.lastSeen = 0;
  }
  statusChange(status, reason = "") {
    this.status = status;
    this.reason = reason;
    this.onStatus?.();
  }
  async start(role, code, name) {
    this.role = role;
    this.code = role === "host" ? roomCode() : cleanCode(code);
    this.name = String(name).trim().slice(0, 12) || "Player";
    if (this.code.length !== 6) {
      this.statusChange("error", "Enter the six-character room code.");
      return;
    }
    this.statusChange("connecting", "Contacting the room service…");
    try {
      const { Peer } = await import("peerjs");
      if (this.closed) return;
      // Explicit STUN, without pretending that public TURN credentials exist.
      this.peer = new Peer(
        role === "host" ? `pt-web-v${PROTOCOL}-${this.code}` : undefined,
        {
          ...signalingOptions(),
          config: {
            iceServers: [
              { urls: "stun:stun.l.google.com:19302" },
              { urls: "stun:global.stun.twilio.com:3478" },
            ],
          },
          debug: 0,
        },
      );
      this.deadline = setTimeout(
        () =>
          this.fail(
            "Room service did not respond. Retry or use the LAN setup in the README.",
          ),
        20000,
      );
      this.peer.on("open", () => {
        clearTimeout(this.deadline);
        if (role === "host")
          this.statusChange("waiting", "Share the code with your friend.");
        else this.connect();
      });
      this.peer.on("connection", (conn) => {
        if (role !== "host") {
          conn.close();
          return;
        }
        this.bind(conn);
      });
      this.peer.on("disconnected", () => {
        if (!this.peer.destroyed && !this.closed)
          this.reconnectTimer = setTimeout(() => {
            if (this.peer.disconnected && !this.peer.destroyed)
              this.peer.reconnect();
          }, 1500);
      });
      this.peer.on("error", (e) => {
        const messages = {
          "peer-unavailable":
            "Room not found. Ask the host to keep the room open and check the code.",
          "unavailable-id":
            "That room code is already taken. Create a new room.",
          "browser-incompatible":
            "This browser does not support WebRTC data connections.",
          network:
            "Cannot reach the room service. Check your connection and retry.",
          webrtc:
            "The browsers could not connect. Try the same Wi-Fi or the LAN setup.",
        };
        if (
          this.connected &&
          ["network", "disconnected", "socket-error"].includes(e.type)
        )
          return;
        // An unrelated extra peer must never interrupt an existing game.
        if (
          this.role === "host" &&
          (this.connected || this.seat) &&
          e.type === "peer-unavailable"
        )
          return;
        this.fail(
          messages[e.type] ||
            "Connection failed. Retry the room or use the LAN setup.",
        );
      });
      this.heartbeat = setInterval(() => {
        if (!this.connected) return;
        if (Date.now() - this.lastSeen > 15000) {
          this.conn?.close();
          this.lost();
          return;
        }
        this.send({ kind: "ping" });
      }, 2000);
    } catch {
      this.fail(
        "Could not load multiplayer. Check your connection, then retry.",
      );
    }
  }
  connect() {
    this.statusChange("connecting", "Connecting to the host…");
    this.bind(
      this.peer.connect(`pt-web-v${PROTOCOL}-${this.code}`, {
        reliable: true,
        // Binary mode chunks effects larger than PeerJS’s 16,300-byte JSON limit.
        serialization: "binary",
        metadata: { version: PROTOCOL },
      }),
    );
  }
  bind(conn) {
    const timeout = setTimeout(() => {
      if (!conn.open || !accepted) {
        conn.close();
        if (this.role === "guest")
          this.fail(
            "No direct connection. Try the same Wi-Fi or the LAN setup.",
          );
      }
    }, 15000);
    let accepted = false;
    conn.on("open", () => {
      if (this.role === "guest")
        conn.send({
          kind: "hello",
          version: PROTOCOL,
          name: this.name,
          token: this.token,
        });
    });
    conn.on("data", (data) => {
      if (!data || typeof data !== "object") return;
      if (!accepted) {
        if (this.role === "host" && data.kind === "hello") {
          let reason = "";
          if (data.version !== PROTOCOL)
            reason = "Versions differ. Reload both browsers.";
          else if (typeof data.token !== "string" || data.token.length > 80)
            reason = "Invalid connection.";
          else if (this.connected)
            reason = "This room already has two players.";
          else if (this.seat && this.seat !== data.token)
            reason = "A match is in progress. Its player can reconnect.";
          if (reason) {
            conn.send({ kind: "reject", reason });
            setTimeout(() => conn.close(), 200);
            clearTimeout(timeout);
            return;
          }
          this.seat = data.token;
          this.remoteName = String(data.name || "Player 2")
            .trim()
            .slice(0, 12);
          conn.send({ kind: "welcome", version: PROTOCOL });
        } else if (this.role === "guest" && data.kind === "reject") {
          clearTimeout(timeout);
          this.fail(String(data.reason).slice(0, 150));
          conn.close();
          return;
        } else if (!(
          this.role === "guest" &&
          data.kind === "welcome" &&
          data.version === PROTOCOL
        ))
          return;
        accepted = true;
        clearTimeout(timeout);
        this.conn = conn;
        this.connected = true;
        this.lastSeen = Date.now();
        this.statusChange("connected");
        this.onConnect?.();
        return;
      }
      if (conn !== this.conn) return;
      this.lastSeen = Date.now();
      if (data.kind === "ping") {
        this.send({ kind: "pong" });
        return;
      }
      if (data.kind === "pong") return;
      this.onData?.(data);
    });
    conn.on("close", () => {
      clearTimeout(timeout);
      if (conn === this.conn) this.lost();
    });
    conn.on("error", () => {
      clearTimeout(timeout);
      if (conn === this.conn) this.lost();
    });
  }
  send(data) {
    if (this.conn?.open) {
      try {
        this.conn.send(data);
      } catch {
        this.lost();
      }
    }
  }
  lost() {
    if (this.closed || !this.connected) return;
    this.connected = false;
    this.conn = null;
    this.statusChange(
      "disconnected",
      this.role === "host"
        ? "Your friend disconnected. The match is held while they rejoin."
        : "Host disconnected. Keep this tab open and retry when they return.",
    );
    this.onDisconnect?.();
  }
  retry() {
    if (this.role === "guest" && this.peer && !this.peer.destroyed) {
      if (this.peer.disconnected) this.peer.reconnect();
      this.connect();
    }
  }
  fail(reason) {
    clearTimeout(this.deadline);
    this.connected = false;
    this.statusChange("error", reason);
    this.onDisconnect?.();
  }
  close() {
    this.closed = true;
    clearTimeout(this.deadline);
    clearTimeout(this.reconnectTimer);
    clearInterval(this.heartbeat);
    this.conn?.close();
    this.peer?.destroy();
    this.connected = false;
  }
}
// Copy renderable state only: scheduled weapon closures stay on the host.
export function gamePacket(game) {
  if (!game) return null;
  return {
    seed: game.seed,
    type: game.type,
    practice: game.practice,
    wind: game.wind,
    windOn: game.windOn,
    phase: game.phase,
    turn: game.turn,
    time: game.time,
    tanks: structuredClone(game.tanks),
    history: game.history,
    ground: Array.from(game.ground, (n) => Math.round(n * 100) / 100),
    projectiles: game.projectiles.map((p) => ({
      serial: p.serial,
      id: p.id,
      kind: p.kind,
      color: p.color,
      x: Math.round(p.x * 100) / 100,
      y: Math.round(p.y * 100) / 100,
      vx: Math.round(p.vx * 100) / 100,
      vy: Math.round(p.vy * 100) / 100,
      // Simulation-only fields, including copied underground heightmaps, stay local.
      // Sample the entire visible trail rather than dropping its older arc.
      trail: sampleTrail(p.trail, 24),
    })),
    effects: game.effects,
    labels: game.labels,
  };
}
function sampleTrail(trail = [], limit) {
  if (!limit || !trail.length) return [];
  const n = Math.min(limit, trail.length);
  return Array.from({ length: n }, (_, i) => {
    const p = trail[Math.round((i * (trail.length - 1)) / Math.max(1, n - 1))];
    return { x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 };
  });
}
