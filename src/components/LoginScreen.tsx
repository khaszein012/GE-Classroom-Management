import { useEffect, useRef, useState } from "react";
import { KeyRound, User } from "lucide-react";
import { BrandLockup } from "@/components/Brand";
import { supabase } from "@/lib/supabase";
import { studentLogin, StudentLoginError } from "@/lib/studentAuth";

type Tab = "teacher" | "student";
type TeacherMode = "login" | "reset";

export function LoginScreen() {
  const [tab, setTab] = useState<Tab>("teacher");
  const [teacherMode, setTeacherMode] = useState<TeacherMode>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [lockSeconds, setLockSeconds] = useState(0);
  const lockTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (lockTimer.current) clearInterval(lockTimer.current);
    };
  }, []);

  const startLockCountdown = (seconds: number) => {
    if (seconds <= 0) return;
    setLockSeconds(seconds);
    if (lockTimer.current) clearInterval(lockTimer.current);
    lockTimer.current = setInterval(() => {
      setLockSeconds((s) => {
        if (s <= 1) {
          if (lockTimer.current) clearInterval(lockTimer.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const submit = async () => {
    if (busy || (tab === "student" && lockSeconds > 0)) return;

    if (tab === "teacher") {
      const mail = email.trim().toLowerCase();
      if (!mail) {
        setError("Enter your email");
        return;
      }
      setBusy(true);
      setError("");
      setNotice("");
      if (teacherMode === "login") {
        if (!password) {
          setError("Enter your password");
          setBusy(false);
          return;
        }
        const { error: err } = await supabase.auth.signInWithPassword({ email: mail, password });
        if (err) setError(err.message === "Invalid login credentials" ? "Incorrect email or password" : err.message);
      } else {
        const { error: err } = await supabase.auth.resetPasswordForEmail(mail);
        if (err) setError(err.message);
        else {
          setNotice("Reset link sent — check your email inbox.");
          setTeacherMode("login");
        }
      }
      setBusy(false);
      return;
    }

    // Student tab
    const user = username.trim().toLowerCase();
    if (!user || pin.length !== 6) {
      setError("Enter your username and 6-digit PIN");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await studentLogin(user, pin);
      // Session set — the auth listener in App routes to the student view.
    } catch (e) {
      if (e instanceof StudentLoginError && e.retryAfter) {
        setError(e.message);
        startLockCountdown(e.retryAfter);
      } else {
        setError(e instanceof Error ? e.message : "Wrong username or PIN");
      }
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 dark:bg-ink-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandLockup />
          <h1 className="brand-text mt-4 font-display text-3xl font-semibold">GENJI EDUCATOR</h1>
          <div className="gold-rule mx-auto mt-3 h-px w-28 animate-rule-in" aria-hidden />
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
            {tab === "teacher" ? "Teacher sign in" : "Student sign in"}
          </p>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-1 rounded-card bg-ink-100 p-1 dark:bg-ink-800">
          <TabButton active={tab === "teacher"} onClick={() => setTab("teacher")} icon={<KeyRound className="h-4 w-4" />}>
            Teacher
          </TabButton>
          <TabButton active={tab === "student"} onClick={() => setTab("student")} icon={<User className="h-4 w-4" />}>
            Student
          </TabButton>
        </div>

        <div className="rounded-card border border-ink-200/70 bg-warm-ivory p-6 shadow-soft dark:border-ink-800/70 dark:bg-ink-900">
          {tab === "teacher" ? (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200">Email</label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && void submit()}
                    placeholder="you@school.edu"
                    className="h-11 w-full rounded-button border border-ink-200 bg-warm-ivory pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-ink-400 focus:border-antique-gold focus:ring-2 focus:ring-antique-gold/20 dark:border-ink-700 dark:bg-ink-800 dark:focus:ring-antique-gold/20"
                  />
                </div>
              </div>

              {teacherMode === "login" && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200">Password</label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError("");
                      }}
                      onKeyDown={(e) => e.key === "Enter" && void submit()}
                      placeholder="••••••••"
                      className="h-11 w-full rounded-button border border-ink-200 bg-warm-ivory pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-ink-400 focus:border-antique-gold focus:ring-2 focus:ring-antique-gold/20 dark:border-ink-700 dark:bg-ink-800 dark:focus:ring-antique-gold/20"
                    />
                  </div>
                </div>
              )}

              {error && <p className="text-xs text-warm-brick">{error}</p>}
              {notice && <p className="text-xs text-deep-gold">{notice}</p>}

              <button
                onClick={() => void submit()}
                disabled={busy}
                className="flex h-11 w-full items-center justify-center rounded-button bg-obsidian dark:bg-antique-gold dark:text-obsidian text-sm font-semibold text-warm-ivory transition-colors hover:bg-ink-700 dark:hover:bg-deep-gold disabled:opacity-60"
              >
                {busy ? "Please wait…" : teacherMode === "login" ? "Sign in" : "Send reset link"}
              </button>

              <div className="flex items-center justify-between text-xs">
                <button
                  onClick={() => {
                    setTeacherMode(teacherMode === "login" ? "reset" : "login");
                    setError("");
                    setNotice("");
                  }}
                  className="font-medium text-deep-gold hover:text-deep-gold dark:text-antique-gold"
                >
                  {teacherMode === "login" ? "Forgot password?" : "Back to sign in"}
                </button>
                <span className="font-medium text-ink-400 dark:text-ink-500">Teacher access only</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200">Username</label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                  <input
                    autoComplete="username"
                    autoCapitalize="none"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value.toLowerCase().replace(/\s/g, ""));
                      setError("");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && void submit()}
                    placeholder="your username"
                    className="h-11 w-full rounded-button border border-ink-200 bg-warm-ivory pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-ink-400 focus:border-antique-gold focus:ring-2 focus:ring-antique-gold/20 dark:border-ink-700 dark:bg-ink-800 dark:focus:ring-antique-gold/20"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200">PIN</label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => {
                      setPin(e.target.value.replace(/\D/g, "").slice(0, 6));
                      setError("");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && void submit()}
                    placeholder="••••••"
                    className="h-11 w-full rounded-button border border-ink-200 bg-warm-ivory pl-9 pr-3 text-center text-lg font-bold tracking-widest tabular-nums outline-none transition-colors placeholder:text-ink-400 focus:border-antique-gold focus:ring-2 focus:ring-antique-gold/20 dark:border-ink-700 dark:bg-ink-800 dark:focus:ring-antique-gold/20"
                  />
                </div>
              </div>

              {lockSeconds > 0 && (
                <p className="text-xs font-medium text-deep-gold dark:text-antique-gold">
                  Too many attempts. Try again in {lockSeconds}s.
                </p>
              )}
              {error && <p className="text-xs text-warm-brick">{error}</p>}

              <button
                onClick={() => void submit()}
                disabled={busy || lockSeconds > 0}
                className="flex h-11 w-full items-center justify-center rounded-button bg-obsidian dark:bg-antique-gold dark:text-obsidian text-sm font-semibold text-warm-ivory transition-colors hover:bg-ink-700 dark:hover:bg-deep-gold disabled:opacity-60"
              >
                {busy ? "Please wait…" : "Sign in"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-9 items-center justify-center gap-1.5 rounded-button text-sm font-semibold transition-colors ${
        active
          ? "bg-warm-ivory text-ink-900 shadow-soft dark:bg-ink-900 dark:text-warm-ivory"
          : "text-ink-500 hover:text-ink-700 dark:text-ink-400 dark:hover:text-ink-200"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
