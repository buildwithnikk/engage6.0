"use client";

import { usePreferences } from "./PreferencesContext";

export function PreferencesHeaderControl() {
  const { preferences, openModal, updatePreferences, t } = usePreferences();

  const handleToggleLang = async () => {
    const next = preferences.language === "hi" ? "en" : "hi";
    await updatePreferences({ language: next });
  };

  return (
    <div className="flex items-center gap-2 text-xs">
      {/* State / Location Pill */}
      <button
        type="button"
        onClick={openModal}
        className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--bg)] px-2.5 py-1 text-[var(--text)] transition hover:border-indigo-400"
        title="Change Location & Preferences"
      >
        <span>📍</span>
        <span className="font-semibold">
          {preferences.state_code
            ? `${preferences.state_code}${preferences.district ? ` · ${preferences.district}` : ""}`
            : t("choose_state_btn")}
        </span>
      </button>

      {/* Language Toggle Pill */}
      <button
        type="button"
        onClick={() => void handleToggleLang()}
        className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-2.5 py-1 font-semibold text-indigo-700 hover:bg-indigo-50 transition"
        title="Switch Language"
      >
        {preferences.language === "hi" ? "English" : "हिन्दी"}
      </button>
    </div>
  );
}
