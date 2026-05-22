import React from "react";

const EMOJIS = ["❤️", "👍", "😂", "😮", "😢", "🔥", "👏", "🙏"];

export default function EmojiReactionPicker({ onSelect, onClose, isOwn }) {
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      {/* Picker */}
      <div
        className={`absolute z-50 bottom-full mb-2 flex gap-1 bg-card border border-border rounded-2xl shadow-xl px-2 py-1.5
          ${isOwn ? "right-0" : "left-0"}`}
      >
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => { onSelect(emoji); onClose(); }}
            className="text-xl hover:scale-125 transition-transform p-0.5 rounded-lg hover:bg-surface"
          >
            {emoji}
          </button>
        ))}
      </div>
    </>
  );
}