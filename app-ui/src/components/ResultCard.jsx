export default function ResultCard({ title, snippet, score, path }) {
  const handleClick = () => {
    if (window.sage && path) {
      window.sage.openFile(path);
    }
  };

  return (
    <div
      onClick={handleClick}
      style={{
        background: "var(--surface-strong)",
        borderRadius: "14px",
        padding: "16px",
        marginBottom: "12px",
        cursor: "pointer",
        boxShadow: "var(--shadow-sm)",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.boxShadow = "var(--shadow-md)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "none";
        e.currentTarget.style.boxShadow = "var(--shadow-sm)";
      }}
    >
      <div
        style={{
          fontSize: "14px",
          fontWeight: 600,
          marginBottom: "6px",
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: "13px",
          color: "var(--text-secondary)",
          marginBottom: "6px",
        }}
      >
        {snippet}
      </div>

      <div
        style={{
          fontSize: "12px",
          color: "var(--text-secondary)",
        }}
      >
        Similarity: {(score * 100).toFixed(1)}%
      </div>
    </div>
  );
}
