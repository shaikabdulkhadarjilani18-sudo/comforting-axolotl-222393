import "dotenv/config";
import crypto from "node:crypto";
import { promisify } from "node:util";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import express from "express";
import nodemailer from "nodemailer";
import { accountRoles } from "./roles.js";

const scrypt = promisify(crypto.scrypt);
const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");
const sessionDurationMs = 7 * 24 * 60 * 60 * 1000;
const resetDurationMs = 30 * 60 * 1000;
const cookieName = "farmbridge_session";
const passwordPolicy = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,128}$/;
const dummySalt = Buffer.from("farmbridge-login-timing-salt");
const dummyHash = Buffer.alloc(64);

function createDatabase(databasePath = process.env.DATABASE_PATH || "./data/farmbridge.sqlite") {
  const resolvedPath = path.resolve(projectRoot, databasePath);
  mkdirSync(path.dirname(resolvedPath), { recursive: true });
  return initializeDatabase(new Database(resolvedPath));
}

function initializeDatabase(db) {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.exec(readFileSync(path.join(here, "schema.sql"), "utf8"));
  return db;
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function makeToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function getCookie(req, name) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const item = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return item ? item.slice(name.length + 1) : null;
}

function setSessionCookie(res, token, expiresAt) {
  const maxAge = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${cookieName}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`);
}

function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${cookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`);
}

function jsonError(res, status, message, code) {
  res.status(status).json({ error: message, code });
}

function safeProfile(row) {
  return {
    id: row.id,
    full_name: row.full_name,
    phone: row.phone,
    role: row.role,
    preferred_language: row.preferred_language,
    farm_or_business_name: row.farm_or_business_name,
    state: row.state,
    district: row.district,
  };
}

function validateEmail(value) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function validateRegistration(body) {
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const businessName = typeof body.businessName === "string" ? body.businessName.trim() : "";
  const role = body.role;
  const preferredLanguage = body.preferredLanguage;
  if (fullName.length < 2 || fullName.length > 120) return { error: "Enter a name between 2 and 120 characters." };
  if (phone && !/^\+?[0-9\s().-]{7,32}$/.test(phone)) return { error: "Enter a valid phone number." };
  if (businessName.length > 160) return { error: "Farm or business name must be 160 characters or fewer." };
  if (!accountRoles.includes(role)) return { error: "Choose a valid account type." };
  if (!["en", "te"].includes(preferredLanguage)) return { error: "Choose a valid preferred language." };
  return {
    value: {
      fullName,
      phone: phone || null,
      businessName: businessName || null,
      role,
      preferredLanguage,
    },
  };
}

function smtpTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD || !process.env.SMTP_FROM) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: SMTP_SECURE === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  });
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[character]);
}

export function createApp({ db = createDatabase(), appOrigin = process.env.APP_ORIGIN || "http://127.0.0.1:5173", mailer = smtpTransport() } = {}) {
  initializeDatabase(db);
  const app = express();
  const trustedOrigin = new URL(appOrigin).origin;
  const limits = new Map();
  const selectUserBySession = db.prepare(`
    select u.id, u.email, u.full_name, u.phone, u.role, u.preferred_language,
      u.farm_or_business_name, u.state, u.district
    from sessions s join users u on u.id = s.user_id
    where s.token_hash = ? and s.expires_at > ?
  `);
  const publicProfileById = db.prepare(`
    select id, full_name, phone, role, preferred_language, farm_or_business_name, state, district
    from users where id = ?
  `);

  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "DENY");
    next();
  });
  app.use(express.json({ limit: "16kb", strict: true }));

  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      const origin = req.get("origin");
      if (!origin || origin !== trustedOrigin) {
        jsonError(res, 403, "Request origin is not allowed.", "ORIGIN_NOT_ALLOWED");
        return;
      }
    }
    next();
  });

  const rateLimit = (key, maxRequests, windowMs) => (req, res, next) => {
    const now = Date.now();
    for (const [entryKey, value] of limits) {
      if (value.resetAt <= now) limits.delete(entryKey);
    }
    const bucketKey = `${key}:${req.ip || req.socket.remoteAddress || "unknown"}`;
    const bucket = limits.get(bucketKey);
    if (!bucket || bucket.resetAt <= now) {
      limits.set(bucketKey, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    bucket.count += 1;
    if (bucket.count > maxRequests) {
      res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      jsonError(res, 429, "Too many requests. Please wait before trying again.", "RATE_LIMITED");
      return;
    }
    next();
  };

  const requireUser = (req, res, next) => {
    const token = getCookie(req, cookieName);
    if (!token || !/^[A-Za-z0-9_-]{40,50}$/.test(token)) {
      jsonError(res, 401, "Please sign in to continue.", "UNAUTHENTICATED");
      return;
    }
    const user = selectUserBySession.get(hashToken(token), Date.now());
    if (!user) {
      db.prepare("delete from sessions where token_hash = ?").run(hashToken(token));
      clearSessionCookie(res);
      jsonError(res, 401, "Your session has expired. Please sign in again.", "SESSION_EXPIRED");
      return;
    }
    req.authUser = user;
    req.sessionTokenHash = hashToken(token);
    next();
  };

  const createSession = (userId, res) => {
    const token = makeToken();
    const expiresAt = Date.now() + sessionDurationMs;
    db.prepare("delete from sessions where expires_at <= ?").run(Date.now());
    db.prepare("insert into sessions (token_hash, user_id, expires_at, created_at) values (?, ?, ?, ?)")
      .run(hashToken(token), userId, expiresAt, Date.now());
    setSessionCookie(res, token, expiresAt);
  };

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  app.get("/api/auth/me", (req, res) => {
    const token = getCookie(req, cookieName);
    if (!token || !/^[A-Za-z0-9_-]{40,50}$/.test(token)) {
      res.json({ user: null, profile: null });
      return;
    }
    const user = selectUserBySession.get(hashToken(token), Date.now());
    if (!user) {
      db.prepare("delete from sessions where token_hash = ?").run(hashToken(token));
      clearSessionCookie(res);
      res.json({ user: null, profile: null });
      return;
    }
    res.json({
      user: { id: user.id, email: user.email },
      profile: safeProfile(user),
    });
  });

  app.post("/api/auth/register", rateLimit("register", 8, 15 * 60 * 1000), async (req, res, next) => {
    const email = validateEmail(req.body?.email);
    const password = req.body?.password;
    if (!email) {
      jsonError(res, 400, "Enter a valid email address.", "INVALID_EMAIL");
      return;
    }
    if (typeof password !== "string" || !passwordPolicy.test(password)) {
      jsonError(res, 400, "Password must be 10–128 characters and contain uppercase, lowercase, and a number.", "INVALID_PASSWORD");
      return;
    }
    const registration = validateRegistration(req.body);
    if (registration.error) {
      jsonError(res, 400, registration.error, "INVALID_PROFILE");
      return;
    }
    try {
      const salt = crypto.randomBytes(16);
      const hash = await scrypt(password, salt, 64);
      const passwordHash = `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
      const userId = crypto.randomUUID();
      const info = registration.value;
      db.prepare(`
        insert into users (id, email, password_hash, full_name, phone, role, preferred_language, farm_or_business_name)
        values (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(userId, email, passwordHash, info.fullName, info.phone, info.role, info.preferredLanguage, info.businessName);
      createSession(userId, res);
      const user = publicProfileById.get(userId);
      res.status(201).json({ user: { id: userId, email }, profile: safeProfile(user) });
    } catch (error) {
      if (error?.code === "SQLITE_CONSTRAINT_UNIQUE") {
        jsonError(res, 409, "An account with this email already exists. Try signing in.", "EMAIL_EXISTS");
        return;
      }
      next(error);
    }
  });

  app.post("/api/auth/login", rateLimit("login", 10, 15 * 60 * 1000), async (req, res, next) => {
    const email = validateEmail(req.body?.email);
    const password = req.body?.password;
    if (!email || typeof password !== "string" || password.length > 128 || password.length === 0) {
      jsonError(res, 400, "Enter a valid email and password.", "INVALID_CREDENTIALS");
      return;
    }
    try {
      const user = db.prepare("select id, email, password_hash from users where email = ?").get(email);
      const [, encodedSalt, encodedHash] = user?.password_hash?.split("$") ?? [];
      const salt = encodedSalt ? Buffer.from(encodedSalt, "base64url") : dummySalt;
      const expectedHash = encodedHash ? Buffer.from(encodedHash, "base64url") : dummyHash;
      const actualHash = await scrypt(password, salt, expectedHash.length);
      if (!user || expectedHash.length !== actualHash.length || !crypto.timingSafeEqual(actualHash, expectedHash)) {
        jsonError(res, 401, "Email or password is incorrect.", "INVALID_CREDENTIALS");
        return;
      }
      createSession(user.id, res);
      const profile = publicProfileById.get(user.id);
      res.json({ user: { id: user.id, email: user.email }, profile: safeProfile(profile) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    const token = getCookie(req, cookieName);
    if (token && /^[A-Za-z0-9_-]{40,50}$/.test(token)) {
      db.prepare("delete from sessions where token_hash = ?").run(hashToken(token));
    }
    clearSessionCookie(res);
    res.status(204).end();
  });

  app.put("/api/profile", requireUser, (req, res) => {
    const fullName = typeof req.body?.fullName === "string" ? req.body.fullName.trim() : "";
    const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
    const businessName = typeof req.body?.businessName === "string" ? req.body.businessName.trim() : "";
    if (fullName.length < 2 || fullName.length > 120) {
      jsonError(res, 400, "Name must be between 2 and 120 characters.", "INVALID_NAME");
      return;
    }
    if (phone && !/^\+?[0-9\s().-]{7,32}$/.test(phone)) {
      jsonError(res, 400, "Enter a valid phone number.", "INVALID_PHONE");
      return;
    }
    if (businessName.length > 160) {
      jsonError(res, 400, "Farm or business name must be 160 characters or fewer.", "INVALID_BUSINESS_NAME");
      return;
    }
    db.prepare(`
      update users set full_name = ?, phone = ?, farm_or_business_name = ?, updated_at = CURRENT_TIMESTAMP
      where id = ?
    `).run(fullName, phone || null, businessName || null, req.authUser.id);
    res.json({ profile: safeProfile(publicProfileById.get(req.authUser.id)) });
  });

  app.post("/api/auth/forgot-password", rateLimit("forgot-password", 5, 15 * 60 * 1000), async (req, res, next) => {
    const email = validateEmail(req.body?.email);
    if (!email) {
      jsonError(res, 400, "Enter a valid email address.", "INVALID_EMAIL");
      return;
    }
    if (!mailer) {
      jsonError(res, 503, "Password recovery email is not configured on this server.", "EMAIL_NOT_CONFIGURED");
      return;
    }
    const user = db.prepare("select id, email, full_name from users where email = ?").get(email);
    if (!user) {
      res.json({ message: "If an account exists for that email, a password reset link is on its way." });
      return;
    }
    const token = makeToken();
    const expiresAt = Date.now() + resetDurationMs;
    db.prepare("delete from password_reset_tokens where expires_at <= ?").run(Date.now());
    db.prepare("delete from password_reset_tokens where user_id = ?").run(user.id);
    db.prepare("insert into password_reset_tokens (token_hash, user_id, expires_at, created_at) values (?, ?, ?, ?)")
      .run(hashToken(token), user.id, expiresAt, Date.now());
    try {
      const resetUrl = new URL("/reset-password", appOrigin);
      resetUrl.searchParams.set("token", token);
      await mailer.sendMail({
        from: process.env.SMTP_FROM,
        to: user.email,
        subject: "Reset your FarmBridge password",
        text: `Hello ${user.full_name},\n\nUse this one-time link within 30 minutes to reset your password:\n${resetUrl.href}\n\nIf you did not request this, you can ignore this email.`,
        html: `<p>Hello ${escapeHtml(user.full_name)},</p><p>Use this one-time link within 30 minutes to reset your password:</p><p><a href="${escapeHtml(resetUrl.href)}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
      });
    } catch (error) {
      db.prepare("delete from password_reset_tokens where token_hash = ?").run(hashToken(token));
      console.error("Could not deliver a password recovery email.", error instanceof Error ? error.message : "Unknown SMTP error");
      next(new Error("The password recovery email could not be sent."));
      return;
    }
    res.json({ message: "If an account exists for that email, a password reset link is on its way." });
  });

  app.post("/api/auth/reset-password", rateLimit("reset-password", 8, 15 * 60 * 1000), async (req, res, next) => {
    const token = req.body?.token;
    const password = req.body?.password;
    if (typeof token !== "string" || !/^[A-Za-z0-9_-]{40,50}$/.test(token)) {
      jsonError(res, 400, "This password reset link is invalid or expired.", "INVALID_RESET_TOKEN");
      return;
    }
    if (typeof password !== "string" || !passwordPolicy.test(password)) {
      jsonError(res, 400, "Password must be 10–128 characters and contain uppercase, lowercase, and a number.", "INVALID_PASSWORD");
      return;
    }
    const reset = db.prepare("select user_id from password_reset_tokens where token_hash = ? and expires_at > ?")
      .get(hashToken(token), Date.now());
    if (!reset) {
      jsonError(res, 400, "This password reset link is invalid or expired.", "INVALID_RESET_TOKEN");
      return;
    }
    try {
      const salt = crypto.randomBytes(16);
      const hash = await scrypt(password, salt, 64);
      const passwordHash = `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
      const update = db.transaction(() => {
        db.prepare("update users set password_hash = ?, updated_at = CURRENT_TIMESTAMP where id = ?")
          .run(passwordHash, reset.user_id);
        db.prepare("delete from password_reset_tokens where user_id = ?").run(reset.user_id);
        db.prepare("delete from sessions where user_id = ?").run(reset.user_id);
      });
      update();
      res.json({ message: "Your password has been updated. You can now sign in." });
    } catch (error) {
      next(error);
    }
  });

  app.use("/api", (_req, res) => jsonError(res, 404, "API route not found.", "NOT_FOUND"));

  const distPath = path.join(projectRoot, "dist");
  if (existsSync(distPath)) {
    app.use(express.static(distPath, { index: false, maxAge: process.env.NODE_ENV === "production" ? "1h" : 0 }));
    app.get(/.*/, (req, res, next) => {
      if (req.method !== "GET" || !req.accepts("html")) {
        next();
        return;
      }
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.use((error, _req, res, _next) => {
    if (res.headersSent) return;
    if (error?.type === "entity.parse.failed") {
      jsonError(res, 400, "Request body must contain valid JSON.", "INVALID_JSON");
      return;
    }
    if (error?.type === "entity.too.large") {
      jsonError(res, 413, "Request body is too large.", "BODY_TOO_LARGE");
      return;
    }
    console.error("Request failed.", error instanceof Error ? error.message : "Unknown server error");
    jsonError(res, 500, "The server could not complete this request.", "INTERNAL_ERROR");
  });

  return { app, db };
}

export function startServer() {
  if (process.env.NODE_ENV === "production" && !process.env.APP_ORIGIN) {
    throw new Error("APP_ORIGIN must be set when NODE_ENV=production.");
  }
  const port = Number(process.env.PORT || 3001);
  const { app } = createApp();
  const host = process.env.HOST || "127.0.0.1";
  return app.listen(port, host, () => {
    console.log(`FarmBridge API listening on ${host}:${port}`);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer();
}
