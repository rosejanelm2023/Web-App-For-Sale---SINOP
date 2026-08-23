(() => {
  const config = window.__SUPABASE_CONFIG__ || {};
  const storageKey = "ph-inventory-supabase-session";
  let session = null;
  try {
    session = JSON.parse(localStorage.getItem(storageKey) || "null");
  } catch {
    localStorage.removeItem(storageKey);
  }

  const configured = Boolean(config.url && config.publishableKey);
  const headers = () => ({
    apikey: config.publishableKey,
    Authorization: `Bearer ${session?.access_token || config.publishableKey}`,
    "Content-Type": "application/json",
  });

  async function parse(response) {
    const text = await response.text();
    let body = null;
    if (text) {
      try { body = JSON.parse(text); } catch { body = text; }
    }
    if (!response.ok) {
      const code = body?.code || body?.error_code || "";
      const friendlyMessages = {
        email_exists: "This email is already registered. Sign in instead, or ask the Super Admin to check your account.",
        user_already_exists: "This email is already registered. Sign in instead, or ask the Super Admin to check your account.",
        signup_disabled: "New registrations are currently disabled in Supabase.",
        email_address_invalid: "Enter a valid email address.",
        weak_password: "The password does not meet the required security rules.",
      };
      const weakPasswordDetails = Array.isArray(body?.weak_password?.reasons)
        ? body.weak_password.reasons.join(" ")
        : "";
      throw new Error(
        friendlyMessages[code]
        || body?.message
        || body?.msg
        || body?.error_description
        || body?.hint
        || body?.details
        || body?.error
        || weakPasswordDetails
        || `Request failed (${response.status})`
      );
    }
    return body;
  }

  async function auth(path, body) {
    return parse(await fetch(`${config.url}/auth/v1/${path}`, {
      method: "POST",
      headers: { apikey: config.publishableKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }));
  }

  async function signIn(email, password) {
    session = await auth("token?grant_type=password", { email, password });
    localStorage.setItem(storageKey, JSON.stringify(session));
    return session;
  }

  async function signUp(email, password, fullName = "") {
    const result = await auth("signup", {
      email,
      password,
      data: { full_name: fullName },
    });
    // Registration never grants immediate application access. The Super Admin
    // must first approve the Pending profile and assign a role.
    if (result?.access_token) {
      session = result;
      try { await signOut(); } catch {}
    }
    return result;
  }

  async function signOut() {
    if (session?.access_token) {
      try { await fetch(`${config.url}/auth/v1/logout`, { method: "POST", headers: headers() }); } catch {}
    }
    session = null;
    localStorage.removeItem(storageKey);
  }

  async function ensureSession() {
    if (!session) return null;
    if (Number(session.expires_at || 0) * 1000 < Date.now() + 60_000) {
      try {
        session = await auth("token?grant_type=refresh_token", { refresh_token: session.refresh_token });
        localStorage.setItem(storageKey, JSON.stringify(session));
      } catch {
        await signOut();
      }
    }
    return session;
  }

  async function request(path, options = {}) {
    await ensureSession();
    if (!session?.access_token) throw new Error("Please sign in first.");
    return parse(await fetch(`${config.url}/rest/v1/${path}`, {
      ...options,
      headers: { ...headers(), ...(options.headers || {}) },
    }));
  }

  async function publicRpc(name, value = {}) {
    return parse(await fetch(`${config.url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: config.publishableKey,
        Authorization: `Bearer ${config.publishableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(value),
    }));
  }

  async function uploadProfilePhoto(file) {
    await ensureSession();
    if (!session?.access_token) throw new Error("Please sign in first.");
    if (!file || !["image/png", "image/jpeg"].includes(file.type)) {
      throw new Error("Profile photo must be a PNG or JPG file.");
    }
    if (file.size > 3 * 1024 * 1024) throw new Error("Profile photo must be 3 MB or smaller.");
    const extension = file.type === "image/png" ? "png" : "jpg";
    const path = `${session.user.id}/profile.${extension}`;
    const response = await fetch(`${config.url}/storage/v1/object/profile-photos/${path}`, {
      method: "POST",
      headers: {
        apikey: config.publishableKey,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": file.type,
        "x-upsert": "true",
      },
      body: file,
    });
    await parse(response);
    return path;
  }

  async function signedProfilePhoto(path) {
    if (!path) return "";
    await ensureSession();
    const result = await parse(await fetch(`${config.url}/storage/v1/object/sign/profile-photos/${path}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ expiresIn: 3600 }),
    }));
    return result?.signedURL ? `${config.url}/storage/v1${result.signedURL}` : "";
  }

  window.supabaseApi = {
    configured,
    get session() { return session; },
    ensureSession,
    signIn,
    signUp,
    signOut,
    uploadProfilePhoto,
    signedProfilePhoto,
    publicRpc,
    select: (table, query = "select=*") => request(`${table}?${query}`),
    insert: (table, value) => request(table, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(value) }),
    update: (table, filter, value) => request(`${table}?${filter}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(value) }),
    remove: (table, filter) => request(`${table}?${filter}`, { method: "DELETE", headers: { Prefer: "return=representation" } }),
    rpc: (name, value) => request(`rpc/${name}`, { method: "POST", body: JSON.stringify(value) }),
  };
})();
