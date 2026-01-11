const BASE_URL = "http://127.0.0.1:8000";

// =========================
// SEARCH
// =========================
export async function searchFiles(query, topK = 5) {
  const res = await fetch(`${BASE_URL}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      top_k: topK,
    }),
  });

  if (!res.ok) {
    throw new Error("Backend search failed");
  }

  const data = await res.json();
  return data.results || [];
}

// =========================
// ROOTS MANAGEMENT
// =========================
export async function getRoots() {
  const res = await fetch(`${BASE_URL}/roots`);
  if (!res.ok) {
    throw new Error("Failed to fetch roots");
  }
  const data = await res.json();
  return data.roots || [];
}

export async function addRoot(path) {
  const res = await fetch(`${BASE_URL}/roots/add`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path }),
  });

  if (!res.ok) {
    throw new Error("Failed to add root");
  }

  return res.json();
}

export async function removeRoot(path) {
  const res = await fetch(`${BASE_URL}/roots/remove`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path }),
  });

  if (!res.ok) {
    throw new Error("Failed to remove root");
  }

  return res.json();
}

// =========================
// INDEXING CONTROL
// =========================
export async function triggerIndexing() {
  const res = await fetch(`${BASE_URL}/index`, {
    method: "POST",
  });

  if (!res.ok) {
    throw new Error("Failed to trigger indexing");
  }

  return res.json();
}

export async function getStatus() {
  const res = await fetch(`${BASE_URL}/status`);
  if (!res.ok) {
    throw new Error("Failed to fetch status");
  }
  return res.json();
}

// =========================
// HEALTH CHECK
// =========================
export async function checkBackend() {
  try {
    const res = await fetch(`${BASE_URL}/`);
    return res.ok;
  } catch {
    return false;
  }
}

// =========================
// DEEPDIVE API
// =========================

export async function deepdiveCreate(filePath) {
  const res = await fetch(`${BASE_URL}/deepdive/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_path: filePath }),
  });
  if (!res.ok) throw new Error("Failed to create DeepDive session");
  return res.json();
}

export async function deepdiveGetSessions() {
  const res = await fetch(`${BASE_URL}/deepdive/sessions`);
  if (!res.ok) throw new Error("Failed to fetch DeepDive sessions");
  return res.json();
}

export async function deepdiveGetSession(sessionId) {
  const res = await fetch(`${BASE_URL}/deepdive/session/${sessionId}`);
  if (!res.ok) throw new Error("Failed to fetch DeepDive session");
  return res.json();
}

export async function deepdiveAddFile(sessionId, filePath) {
  const res = await fetch(`${BASE_URL}/deepdive/add-file`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, file_path: filePath }),
  });
  if (!res.ok) throw new Error("Failed to add file to DeepDive");
  return res.json();
}

export async function deepdiveRemoveFile(sessionId, filePath) {
  const res = await fetch(`${BASE_URL}/deepdive/remove-file`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, file_path: filePath }),
  });
  if (!res.ok) throw new Error("Failed to remove file from DeepDive");
  return res.json();
}

export async function deepdiveDelete(sessionId) {
  const res = await fetch(`${BASE_URL}/deepdive/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId }),
  });
  if (!res.ok) throw new Error("Failed to delete DeepDive session");
  return res.json();
}

export async function deepdiveChat(sessionId, message) {
  const res = await fetch(`${BASE_URL}/deepdive/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, message }),
  });
  if (!res.ok) throw new Error("Failed to send DeepDive message");
  return res.json();
}

export async function deepdiveSearchFiles(query, topK = 10) {
  const res = await fetch(`${BASE_URL}/deepdive/search-files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, top_k: topK }),
  });
  if (!res.ok) throw new Error("Failed to search files for DeepDive");
  return res.json();
}
