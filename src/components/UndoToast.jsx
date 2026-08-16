// Shared undo toast — bottom-of-screen notification after a destructive or
// significant action, with a gold "Undo" button. Presentational only: the
// caller owns the { message, undoFn } state and the auto-dismiss timer (see
// ExhaleSection.jsx / App.jsx WavesSection for the showUndoToast pattern),
// this component just renders whatever it's handed.
export default function UndoToast({ toast, onUndo }) {
  if (!toast) return null;
  return (
    <div style={{
      position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)",
      zIndex: 10000, maxWidth: "calc(100vw - 32px)",
      display: "flex", alignItems: "center", gap: 14,
      background: "#2b3d52", color: "#fff", borderRadius: 8,
      padding: "10px 10px 10px 16px", boxShadow: "0 6px 20px rgba(0,0,0,0.28)",
      fontFamily: "var(--font-sans,sans-serif)", fontSize: 13,
    }}>
      <span>{toast.message}</span>
      <button onClick={onUndo} style={{
        background: "none", border: "none", color: "#c8a96e", fontWeight: 700,
        fontSize: 13, cursor: "pointer", padding: "4px 8px", flexShrink: 0,
      }}>Undo</button>
    </div>
  );
}
