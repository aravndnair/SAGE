function getFileTypeFromPath(filePath) {
  if (!filePath) return 'file';
  const idx = filePath.lastIndexOf('.');
  const ext = idx === -1 ? '' : filePath.slice(idx + 1).toLowerCase();

  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'spreadsheet';
  if (['pdf', 'doc', 'docx', 'txt', 'md', 'rtf'].includes(ext)) return 'document';
  return 'file';
}

function getBasename(filePath) {
  if (!filePath) return '';
  const parts = String(filePath).split(/[/\\]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : String(filePath);
}

function getFolderLabel(filePath) {
  if (!filePath) return '';
  const parts = String(filePath).split(/[/\\]/).filter(Boolean);
  if (parts.length < 2) return '';
  return parts[parts.length - 2] || '';
}

function ResultIcon({ type }) {
  if (type === 'image') {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M4 3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H4Zm0 2h12v7.25l-2.25-2.25a1.5 1.5 0 0 0-2.12 0l-3.63 3.63-1.38-1.38a1.5 1.5 0 0 0-2.12 0L4 14.25V5Zm2.5 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Z" />
      </svg>
    );
  }

  if (type === 'spreadsheet') {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M4 3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H4Zm2 3h8v2H6V6Zm0 3h3v2H6V9Zm0 3h3v2H6v-2Zm5-3h3v5h-3V9Z" />
      </svg>
    );
  }

  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M4 2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5a2 2 0 0 0-.586-1.414l-3.5-3.5A2 2 0 0 0 14.5 2H4Zm10 1.5V7h3.5L14 3.5Z" />
    </svg>
  );
}

function highlightTerms(text, matchedTerms) {
  if (!text || !matchedTerms || matchedTerms.length === 0) {
    return text;
  }

  // Create a regex pattern that matches any of the terms (case-insensitive)
  const escapedTerms = matchedTerms.map(term => 
    term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  const pattern = new RegExp(`(${escapedTerms.join('|')})`, 'gi');

  // Split text by matches and create highlighted spans
  const parts = text.split(pattern);
  
  return parts.map((part, index) => {
    const isMatch = matchedTerms.some(
      term => term.toLowerCase() === part.toLowerCase()
    );
    if (isMatch) {
      return <mark key={index} className="snippet-highlight">{part}</mark>;
    }
    return part;
  });
}

export default function ResultCard({ title, snippet, score, path, matchedTerms, onOpen }) {
  const type = getFileTypeFromPath(path);
  const scorePct = typeof score === 'number' ? Math.max(0, Math.min(100, Math.round(score * 100))) : null;
  const displayTitle = title ? String(title) : getBasename(path);
  const folderLabel = getFolderLabel(path);
  const strongMatch = scorePct !== null && scorePct >= 90;
  
  // Highlight matched terms in snippet
  const highlightedSnippet = highlightTerms(snippet, matchedTerms);

  return (
    <div
      className="search-result-item"
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.(path)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen?.(path);
        }
      }}
      title={path || title}
    >
      <div className={type === 'image' ? 'search-result-icon is-image' : type === 'spreadsheet' ? 'search-result-icon is-spreadsheet' : 'search-result-icon is-document'}>
        <ResultIcon type={type} />
      </div>

      <div className="search-result-body">
        <div className="search-result-title" title={displayTitle}>{displayTitle}</div>
        {snippet ? <div className="search-result-snippet line-clamp-3">{highlightedSnippet}</div> : null}
        <div className="search-result-meta">
          {folderLabel ? (
            <span className="search-result-chip" title={path}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3.5 6.5a2 2 0 0 1 2-2h3.6l2 2H16.5a2 2 0 0 1 2 2V14a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2V6.5Z" />
              </svg>
              {folderLabel}
            </span>
          ) : null}

          {scorePct !== null ? (
            <span className={strongMatch ? 'search-result-chip search-result-chip--match is-strong' : 'search-result-chip search-result-chip--match'}>
              {scorePct}% Match
            </span>
          ) : null}
        </div>
      </div>

      <div className="search-result-chevron" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 4l6 6-6 6" />
        </svg>
      </div>
    </div>
  );
}
