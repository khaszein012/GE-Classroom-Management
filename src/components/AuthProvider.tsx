import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { getClassSettings } from "@/lib/storage";

interface AuthContextValue {
  session: Session | null;
  email: string | null;
  /** null = still checking the stored session */
  ready: boolean;
  /** true once a class_settings row exists */
  hasSettings: boolean | null;
  /** true when the settings check itself failed (distinct from "missing") */
  settingsError: boolean;
  /** true when the signed-in session belongs to a student (not the teacher) */
  isStudent: boolean;
  signOut: () => Promise<void>;
  recheckSettings: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [hasSettings, setHasSettings] = useState<boolean | null>(null);
  const [settingsError, setSettingsError] = useState(false);
  const [checkTick, setCheckTick] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Check for the single class_settings row once signed in. A network or
  // permission failure is tracked separately from "row missing" so a failed
  // request can never trigger the setup path.
  useEffect(() => {
    if (!session) {
      setHasSettings(null);
      setSettingsError(false);
      return;
    }
    let cancelled = false;
    getClassSettings()
      .then((s) => {
        if (cancelled) return;
        setHasSettings(s !== null);
        setSettingsError(false);
      })
      .catch(() => {
        if (cancelled) return;
        setHasSettings(false);
        setSettingsError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [session, checkTick]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const recheckSettings = useCallback(() => setCheckTick((t) => t + 1), []);

  // Student sessions carry an immutable app_metadata.student_id claim (set by
  // the student-login edge function). Teacher sessions never have it.
  const isStudent = session?.user?.app_metadata?.student_id != null;

  return (
    <AuthContext.Provider
      value={{
        session,
        email: session?.user?.email ?? null,
        ready,
        hasSettings,
        settingsError,
        isStudent,
        signOut,
        recheckSettings,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
