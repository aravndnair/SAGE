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
