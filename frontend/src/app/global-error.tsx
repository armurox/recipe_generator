"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100dvh",
          textAlign: "center",
          background: "#FAFAF8",
          color: "#1B1B1B",
          padding: "24px",
        }}
      >
        <div>
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>🚨</div>
          <h1 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>
            Critical Error
          </h1>
          <p style={{ fontSize: "14px", color: "#6B7280", marginBottom: "24px" }}>
            {error.message || "Something went very wrong."}
          </p>
          <button
            onClick={reset}
            style={{
              padding: "12px 24px",
              background: "#2D6A4F",
              color: "white",
              border: "none",
              borderRadius: "12px",
              fontSize: "16px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
