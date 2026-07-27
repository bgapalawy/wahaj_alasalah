/**
 * Simple "who built this" contact card — reuses the same
 * graph-modal-backdrop/graph-modal shell as every other modal in this
 * app (NcrReport, OutOfSequenceReport, the color settings panel, etc.)
 * so it needs no new CSS. Every contact method is a real clickable
 * link with its own value as the visible text (mailto: for email,
 * the site itself for the website, wa.me for WhatsApp) — same idea as
 * WhatsApp itself showing a saved contact's phone number as a tappable
 * link rather than a plain label next to a generic "WhatsApp" button.
 */
export function ContactDeveloperModal({ onClose }) {
  return (
    <div className="graph-modal-backdrop" onClick={onClose}>
      <div className="graph-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "380px" }}>
        <div className="graph-modal-header">
          <h3>Contact Developer</h3>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", padding: "0.25rem 0.5rem 0.75rem" }}>
          <div>
            <span className="file-status-hint">Developer</span>
            <p style={{ margin: "0.15rem 0 0", fontWeight: 600 }}>Moustafa Elgabalawy</p>
          </div>

          <div>
            <span className="file-status-hint">Email</span>
            <p style={{ margin: "0.15rem 0 0" }}>
              <a href="mailto:bgapalawy@gmail.com">bgapalawy@gmail.com</a>
            </p>
          </div>

          <div>
            <span className="file-status-hint">Website</span>
            <p style={{ margin: "0.15rem 0 0" }}>
              <a href="https://www.creativefulcrum.com/" target="_blank" rel="noopener noreferrer">
                creativefulcrum.com
              </a>
            </p>
          </div>

          <div>
            <span className="file-status-hint">WhatsApp</span>
            <p style={{ margin: "0.15rem 0 0" }}>
              <a href="https://wa.me/966581854860" target="_blank" rel="noopener noreferrer">
                +966 58 185 4860
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
