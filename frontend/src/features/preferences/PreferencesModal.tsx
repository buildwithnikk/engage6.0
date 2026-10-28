"use client";

import { useEffect, useState } from "react";
import { usePreferences } from "./PreferencesContext";
import type { AreaType } from "@/types/api";

export function PreferencesModal() {
  const { preferences, states, isModalOpen, closeModal, updatePreferences, resetPreferences, t } =
    usePreferences();

  const [language, setLanguage] = useState<string>("en");
  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  const [areaType, setAreaType] = useState<AreaType>("skip");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isModalOpen) {
      setLanguage(preferences.language || "en");
      setSelectedState(preferences.state_code || "");
      setSelectedDistrict(preferences.district || "");
      setAreaType(preferences.area_type || "skip");
      setError(null);
    }
  }, [isModalOpen, preferences]);

  if (!isModalOpen) return null;

  const currentStateObj = states.find((s) => s.code === selectedState);
  const districts = currentStateObj?.districts || [];

  const handleStateChange = (newCode: string) => {
    setSelectedState(newCode);
    setSelectedDistrict(""); // Reset district on state change
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updatePreferences({
        language,
        state_code: selectedState || null,
        district: selectedDistrict || null,
        area_type: areaType,
      });
      closeModal();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save preferences.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    setError(null);
    try {
      await resetPreferences();
      closeModal();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to reset preferences.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="preferences-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-[var(--line)] bg-[var(--card)] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="preferences-modal-title" className="text-xl font-bold">
              {t("preferences_title")}
            </h2>
            <p className="mt-1 text-xs text-[var(--muted)] leading-relaxed">
              {t("preferences_desc")}
            </p>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--text)]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs text-red-800 border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="mt-5 space-y-4">
          {/* 1. Language Toggle */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text)]">
              {t("select_language")}
            </label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {[
                { code: "en", label: "English" },
                { code: "hi", label: "हिन्दी (Hindi)" },
              ].map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setLanguage(lang.code)}
                  className={`rounded-xl border py-2 px-3 text-xs font-semibold transition ${
                    language === lang.code
                      ? "border-indigo-600 bg-indigo-50/70 text-indigo-700 shadow-sm"
                      : "border-[var(--line)] hover:bg-[var(--bg)]"
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. State Selection */}
          <div>
            <label htmlFor="state-select" className="block text-xs font-semibold text-[var(--text)]">
              {t("select_state")}
            </label>
            <select
              id="state-select"
              value={selectedState}
              onChange={(e) => handleStateChange(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="">-- Choose State / UT --</option>
              {states.map((s) => (
                <option key={s.code} value={s.code}>
                  {language === "hi" ? `${s.name_hi} (${s.name})` : s.name}
                </option>
              ))}
            </select>
          </div>

          {/* 3. District Selection (Only when State is selected) */}
          <div>
            <label htmlFor="district-select" className="block text-xs font-semibold text-[var(--text)]">
              {t("select_district")}
            </label>
            <select
              id="district-select"
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              disabled={!selectedState}
              className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm disabled:opacity-50 focus:border-indigo-500 focus:outline-none"
            >
              <option value="">{t("all_districts")}</option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            {!selectedState && (
              <span className="mt-1 block text-[11px] text-[var(--muted)]">
                Select a state first to view its districts.
              </span>
            )}
          </div>

          {/* 4. Area Type */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text)]">
              {t("select_area")}
            </label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {(
                [
                  { key: "rural", label: t("area_rural") },
                  { key: "urban", label: t("area_urban") },
                  { key: "skip", label: t("area_skip") },
                ] as const
              ).map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => setAreaType(a.key)}
                  className={`rounded-lg border py-1.5 px-2 text-center text-xs font-medium transition ${
                    areaType === a.key
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm"
                      : "border-[var(--line)] hover:bg-[var(--bg)]"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* Domicile Disclaimer */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-[11px] text-amber-900 leading-normal">
            ℹ️ {t("domicile_disclaimer")}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--line)]">
            <button
              type="button"
              onClick={handleReset}
              disabled={saving}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {t("reset_preferences")}
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--text)] hover:bg-[var(--bg)]"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : t("save_preferences")}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
