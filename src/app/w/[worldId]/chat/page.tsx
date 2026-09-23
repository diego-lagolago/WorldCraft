export default function ChatPage() {
  return (
    <div className="chat-page">
      <div className="msgs">
        <p className="empty">Der Chat dieser Welt erscheint hier.</p>
      </div>
      <div className="composer">
        <input disabled placeholder="Nachricht …" aria-label="Nachricht" />
      </div>
    </div>
  );
}
