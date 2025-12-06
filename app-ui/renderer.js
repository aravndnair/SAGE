async function doSearch() {
  const q = document.getElementById("query").value.trim();
  if (!q) return;

  const resBox = document.getElementById("results");
  resBox.innerHTML = "Searching...";

  try {
    const response = await fetch("http://127.0.0.1:8000/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query: q, snippets: 3 })
    });

    const data = await response.json();

    // New format: { results: [ { file, path, similarity, snippets }, ... ] }
    if (!data.results || data.results.length === 0) {
      resBox.innerHTML = "<p>No results.</p>";
      return;
    }

    let html = "";

    for (const result of data.results) {
      html += `
        <div class="result">
          <h3>${result.file} — <span>${result.similarity}% match</span></h3>
          <p><b>Path:</b> ${result.path}</p>
          <ul>
      `;

      for (const snip of result.snippets) {
        html += `<li>${snip.text}</li>`;
      }

      html += `
          </ul>
        </div>
      `;
    }

    resBox.innerHTML = html;

  } catch (err) {
    console.error(err);
    resBox.innerHTML = `<p style="color:red;">Error connecting to backend</p>`;
  }
}
