import React, { useRef } from "react";
import { Plus } from "lucide-react";

const QUICK_EMOJIS = ["👍", "❤️", "🔥", "👏", "😮", "😢", "📌"];

export default function EmojiReactionPicker({ onSelect, onClose, isOwn }) {
  const inputRef = useRef(null);

  const handlePlusClick = () => {
    // Trigger the hidden emoji-capable input
    if (inputRef.current) {
      inputRef.current.focus();
      // On mobile this opens the emoji keyboard; on desktop it still works via text
      inputRef.current.value = "";
    }
  };

  const handleInputChange = (e) => {
    // Grab the first emoji-like character entered
    const val = e.target.value;
    if (!val) return;
    // Extract the first grapheme cluster (handles multi-codepoint emoji)
    const seg = [...val.matchAll(/\p{Emoji}/gu)];
    const picked = seg.length > 0 ? seg[0][0] : val[0];
    if (picked) {
      onSelect(picked);
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      {/* Picker */}
      <div
        className={`absolute z-50 bottom-full mb-2 bg-card border border-border shadow-lg rounded-full px-3 py-1.5 flex items-center gap-2
          ${isOwn ? "right-0" : "left-0"}`}
      >
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => { onSelect(emoji); onClose(); }}
            className="text-xl hover:scale-125 transition-transform p-0.5 rounded-full hover:bg-surface"
          >
            {emoji}
          </button>
        ))}

        {/* + button to open emoji keyboard */}
        <button
          onClick={handlePlusClick}
          className="w-7 h-7 flex items-center justify-center rounded-lg bg-surface hover:bg-surface-hover border border-border text-muted-foreground hover:text-foreground transition-colors ml-0.5"
          title="More emojis"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>

        {/* Hidden input that captures emoji keyboard input */}
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          className="absolute opacity-0 w-px h-px pointer-events-none"
          onChange={handleInputChange}
          onBlur={onClose}
        />
      </div>
    </>
  );
}