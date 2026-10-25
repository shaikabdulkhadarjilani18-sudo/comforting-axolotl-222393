import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { createApp } from "./index.js";

const origin = "http://127.0.0.1:5173";
const password = "FreshFarmPass123";

async function withServer(run, { mailer = null } = {}) {
  const db = new Database(":memory:");
  const { app } = createApp({ db, appOrigin: origin, mailer });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await run({
      db,
      async request(route, { method = "GET", body, cookie, requestOrigin = origin } = {}) {
        const headers = { Origin: requestOrigin };
        if (body !== undefined) headers["Content-Type"] = "application/json";
        if (cookie) headers.Cookie = cookie;
        const response = await fetch(`${baseUrl}${route}`, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        const text = await response.text();
        return {
          response,
          data: text ? JSON.parse(text) : null,
          cookie: response.headers.get("set-cookie")?.split(";")[0],
        };
      },
    });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    db.close();
  }
}

const registration = (overrides = {}) => ({
  email: "grower@example.test",
  password,
  fullName: "Sample Grower",
  phone: "+91 98765 43210",
  role: "farmer",
  preferredLanguage: "en",
  businessName: "Green Field Farm",
  ...overrides,
});

test("registration creates an authenticated profile with a protected session cookie", async () => {
  await withServer(async ({ request, db }) => {
    const created = await request("/api/auth/register", { method: "POST", body: registration() });
    assert.equal(created.response.status, 201);
    assert.equal(created.data.profile.role, "farmer");
    assert.equal(created.data.user.email, "grower@example.test");
    assert.match(created.cookie, /^farmbridge_session=[A-Za-z0-9_-]+$/);
    assert.match(created.response.headers.get("set-cookie"), /HttpOnly/);
    assert.match(created.response.headers.get("set-cookie"), /SameSite=Lax/);

    const storedUser = db.prepare("select password_hash from users where email = ?").get("grower@example.test");
    assert.notEqual(storedUser.password_hash, password);
    assert.match(storedUser.password_hash, /^scrypt\$/);

    const restored = await request("/api/auth/me", { cookie: created.cookie });
    assert.equal(restored.data.profile.full_name, "Sample Grower");
    assert.equal(restored.data.user.id, created.data.user.id);

    const changed = await request("/api/profile", {
      method: "PUT",
      cookie: created.cookie,
      body: { fullName: "Updated Grower", phone: "", businessName: "", role: "administrator" },
    });
    assert.equal(changed.response.status, 200);
    assert.equal(changed.data.profile.full_name, "Updated Grower");
    assert.equal(changed.data.profile.role, "farmer");
  });
});

test("registration rejects invalid data and never accepts administrator as a signup role", async () => {
  await withServer(async ({ request }) => {
    const invalidEmail = await request("/api/auth/register", {
      method: "POST",
      body: registration({ email: "not-an-email" }),
    });
    assert.equal(invalidEmail.response.status, 400);

    const weakPassword = await request("/api/auth/register", {
      method: "POST",
      body: registration({ password: "weak" }),
    });
    assert.equal(weakPassword.response.status, 400);

    const administrator = await request("/api/auth/register", {
      method: "POST",
      body: registration({ role: "administrator" }),
    });
    assert.equal(administrator.response.status, 400);

    const wrongOrigin = await request("/api/auth/register", {
      method: "POST",
      requestOrigin: "https://attacker.example",
      body: registration({ email: "other@example.test" }),
    });
    assert.equal(wrongOrigin.response.status, 403);
  });
});

test("login errors are generic, and logout invalidates a valid session", async () => {
  await withServer(async ({ request }) => {
    await request("/api/auth/register", { method: "POST", body: registration() });

    const wrongPassword = await request("/api/auth/login", {
      method: "POST",
      body: { email: "grower@example.test", password: "WrongPassword123" },
    });
    const missingAccount = await request("/api/auth/login", {
      method: "POST",
      body: { email: "other@example.test", password: "WrongPassword123" },
    });
    assert.equal(wrongPassword.response.status, 401);
    assert.equal(wrongPassword.data.error, missingAccount.data.error);

    const signedIn = await request("/api/auth/login", {
      method: "POST",
      body: { email: "grower@example.test", password },
    });
    assert.equal(signedIn.response.status, 200);
    const logout = await request("/api/auth/logout", { method: "POST", cookie: signedIn.cookie });
    assert.equal(logout.response.status, 204);
    assert.equal(logout.response.headers.get("set-cookie").includes("Max-Age=0"), true);
    const afterLogout = await request("/api/auth/me", { cookie: signedIn.cookie });
    assert.equal(afterLogout.data.user, null);
  });
});

test("password recovery uses a single-use expiring token and invalidates prior sessions", async () => {
  let recoveryEmail = null;
  const mailer = { sendMail: async (email) => { recoveryEmail = email; } };
  await withServer(async ({ request }) => {
    const created = await request("/api/auth/register", { method: "POST", body: registration() });

    const unknownEmail = await request("/api/auth/forgot-password", {
      method: "POST",
      body: { email: "unknown@example.test" },
    });
    const knownEmail = await request("/api/auth/forgot-password", {
      method: "POST",
      body: { email: "grower@example.test" },
    });
    assert.equal(unknownEmail.response.status, 200);
    assert.equal(knownEmail.response.status, 200);
    assert.equal(unknownEmail.data.message, knownEmail.data.message);
    assert.equal(recoveryEmail.to, "grower@example.test");

    const resetUrl = new URL(recoveryEmail.text.match(/http:\/\/[^\s]+/)[0]);
    const token = resetUrl.searchParams.get("token");
    assert.ok(token);
    const reset = await request("/api/auth/reset-password", {
      method: "POST",
      body: { token, password: "NewSecurePass456" },
    });
    assert.equal(reset.response.status, 200);

    const replay = await request("/api/auth/reset-password", {
      method: "POST",
      body: { token, password: "AnotherSecure789" },
    });
    assert.equal(replay.response.status, 400);

    const oldSession = await request("/api/auth/me", { cookie: created.cookie });
    assert.equal(oldSession.data.user, null);
    const oldLogin = await request("/api/auth/login", {
      method: "POST",
      body: { email: "grower@example.test", password },
    });
    assert.equal(oldLogin.response.status, 401);
    const newLogin = await request("/api/auth/login", {
      method: "POST",
      body: { email: "grower@example.test", password: "NewSecurePass456" },
    });
    assert.equal(newLogin.response.status, 200);
  }, { mailer });
});

test("password recovery reports missing SMTP configuration rather than faking success", async () => {
  await withServer(async ({ request }) => {
    const response = await request("/api/auth/forgot-password", {
      method: "POST",
      body: { email: "someone@example.test" },
    });
    assert.equal(response.response.status, 503);
    assert.equal(response.data.code, "EMAIL_NOT_CONFIGURED");
  });
});
