document.getElementById("searchBtn").addEventListener("click", () => {
    const query = document.getElementById("query").value.trim();
    if (query) {
        document.getElementById("results").innerHTML = "Searching...";
        window.sageAPI.search(query);
    }
});

window.sageAPI.onResult((data) => {
    const resBox = document.getElementById("results");

    if (!data || !Array.isArray(data.results) || data.results.length === 0) {
        resBox.innerHTML = `<p>No results found.</p>`;
        return;
    }

    let html = "";

    for (const r of data.results) {
        // similarity is ALREADY 0–100 from Python
        const sim = (typeof r.similarity === "number")
            ? r.similarity.toFixed(2)
            : r.similarity;

        html += `
        <div class="result-card">
            <h3>${r.file} — ${sim}% match</h3>
            <p class="path">${r.path}</p>
            <ul>
                <li>${r.snippet}</li>
            </ul>
        </div>`;
    }

    resBox.innerHTML = html;
});
