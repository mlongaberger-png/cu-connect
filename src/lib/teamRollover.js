// Shared helpers for rolling a team over to a new season with an advanced
// age bracket (e.g. 8U -> 10U). Team.age_group is declared as an enum in
// base44/entities/Team.jsonc, but Teams.jsx's own "Add Team" form has always
// used a free-text Input for it ("e.g. 10U, Junior Varsity..."), not a
// dropdown -- so real data in this app already contains values outside that
// declared enum (7U, Junior High, Junior Varsity). These helpers treat
// age_group as free text and only recognize the common bracket patterns;
// everything they produce is a pre-filled SUGGESTION the admin can edit
// before confirming a rollover, never something silently auto-applied.

export const AGE_BRACKET_ORDER = [
  "6U", "7U", "8U", "9U", "10U", "11U", "12U", "13U", "14U",
  "Junior High", "Junior Varsity", "Varsity", "Adult",
];

// Case-insensitive lookup of a bracket's index in the progression.
function bracketIndex(value) {
  if (!value) return -1;
  const norm = value.trim().toLowerCase();
  return AGE_BRACKET_ORDER.findIndex(b => b.toLowerCase() === norm);
}

// Returns the next bracket label, or null if the current value isn't a
// recognized bracket (custom/free text) or is already the last one.
export function getNextAgeBracket(currentAgeGroup) {
  const idx = bracketIndex(currentAgeGroup);
  if (idx === -1 || idx === AGE_BRACKET_ORDER.length - 1) return null;
  return AGE_BRACKET_ORDER[idx + 1];
}

// Suggests a new team name by swapping an old-bracket token found in the
// name for the new bracket. Handles the "8U"/"8u" numeric+U style (matching
// this app's real data, e.g. "8u Lions", "12U Gold") case-insensitively
// while preserving whatever u/U casing the original name used. Falls back
// to returning the name unchanged if no matching token is found -- the
// caller always shows this in an editable field, so an imperfect guess is
// fine.
export function suggestRolledOverName(oldName, oldAgeGroup, newAgeGroup) {
  if (!oldName) return oldName;
  const oldMatch = oldAgeGroup?.match(/^(\d{1,2})\s*U$/i);
  const newMatch = newAgeGroup?.match(/^(\d{1,2})\s*U$/i);

  if (oldMatch && newMatch) {
    const oldDigits = oldMatch[1];
    const newDigits = newMatch[1];
    // Replace e.g. "8U"/"8u" -> "10U"/"10u", preserving the found casing.
    const re = new RegExp(`\\b${oldDigits}\\s*(u|U)\\b`);
    const found = oldName.match(re);
    if (found) {
      const caseSample = found[1]; // "u" or "U"
      return oldName.replace(re, `${newDigits}${caseSample}`);
    }
  }

  // Textual brackets (Junior High / Junior Varsity / Varsity / Adult):
  // whole-word, case-insensitive replace of the OLD bracket text if present.
  if (oldAgeGroup && newAgeGroup && !oldMatch) {
    const escaped = oldAgeGroup.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`, "i");
    if (re.test(oldName)) {
      return oldName.replace(re, newAgeGroup);
    }
  }

  return oldName;
}

// Default "next" season/year suggestion: same term, next calendar year --
// the primary described use case is "the same team moves up next year."
// Always shown in editable fields, since some sports cycle term-to-term
// within the same year instead.
export function suggestNextSeasonYear(currentSeason, currentYear) {
  const yearNum = parseInt(currentYear, 10);
  return {
    season: currentSeason || "fall",
    year: Number.isFinite(yearNum) ? String(yearNum + 1) : currentYear,
  };
}
