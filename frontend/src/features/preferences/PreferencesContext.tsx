"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  getLocationMetadata,
  getUserPreferences,
  resetUserPreferences,
  updateUserPreferences,
} from "@/lib/api-client";
import { t, type TranslationKey } from "@/lib/locale";
import type {
  StateItem,
  UserPreferences,
} from "@/types/api";

type PreferencesContextType = {
  preferences: UserPreferences;
  hasSetPreferences: boolean;
  states: StateItem[];
  loading: boolean;
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  updatePreferences: (payload: Partial<UserPreferences>) => Promise<void>;
  resetPreferences: () => Promise<void>;
  t: (key: TranslationKey) => string;
};

const defaultPreferences: UserPreferences = {
  language: "en",
  state_code: null,
  district: null,
  area_type: "skip",
};

const PreferencesContext = createContext<PreferencesContextType | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [hasSetPreferences, setHasSetPreferences] = useState(false);
  const [states, setStates] = useState<StateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Load preferences and metadata from server session
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [prefRes, metaRes] = await Promise.all([
        getUserPreferences().catch(() => null),
        getLocationMetadata().catch(() => null),
      ]);

      if (metaRes?.states) {
        setStates(metaRes.states);
      }

      if (prefRes) {
        setPreferences(prefRes.preferences);
        setHasSetPreferences(prefRes.has_set_preferences);
        // If first visit (no preferences set yet), open onboarding modal
        if (!prefRes.has_set_preferences) {
          setIsModalOpen(true);
        }
      }
    } catch {
      // Fallback gracefully
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const update = async (payload: Partial<UserPreferences>) => {
    try {
      const res = await updateUserPreferences(payload);
      setPreferences(res.preferences);
      setHasSetPreferences(res.has_set_preferences);
      setIsModalOpen(false);
    } catch (err) {
      throw err;
    }
  };

  const reset = async () => {
    try {
      const res = await resetUserPreferences();
      setPreferences(res.preferences);
      setHasSetPreferences(false);
      setIsModalOpen(false);
    } catch (err) {
      throw err;
    }
  };

  const translate = (key: TranslationKey): string => {
    return t(preferences.language, key);
  };

  return (
    <PreferencesContext.Provider
      value={{
        preferences,
        hasSetPreferences,
        states,
        loading,
        isModalOpen,
        openModal: () => setIsModalOpen(true),
        closeModal: () => setIsModalOpen(false),
        updatePreferences: update,
        resetPreferences: reset,
        t: translate,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error("usePreferences must be used within a PreferencesProvider");
  }
  return ctx;
}
