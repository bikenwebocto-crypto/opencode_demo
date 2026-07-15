"use client";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/lib/supabase/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { LoginLayoutRenderer } from "@/components/login-layouts";
import type { PublicBranding } from "@/features/admin/settings/login-branding/services/login-branding.service";

interface LoginClientProps {
  branding: PublicBranding;
}

export function LoginClient({ branding }: LoginClientProps) {
  const router = useRouter();
  const syncedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const onAuth = useCallback(async () => {
    if (syncedRef.current || isSyncing) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) return;
    console.log("User signed in, syncing with backend...", session.access_token);
    syncedRef.current = true;
    setIsSyncing(true);

    try {
      const res = await fetch("/api/auth/sync-admin", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const body = await res.json();

      if (!res.ok) {
        if (body?.error?.code === "EMAIL_ALREADY_EXISTS") {
          setError("This email is already assigned to another account.");
        } else {
          setError("You are not mapped to any role or account.");
        }
        setTimeout(() => setError(""), 5000);
        syncedRef.current = false;
        setIsSyncing(false);
        return;
      }

      const redirectPath = body.redirectTo || "/employee";
      router.push(redirectPath);
      router.refresh();
    } catch {
      setError("Failed to verify your account. Please try again.");
      syncedRef.current = false;
      setIsSyncing(false);
      setTimeout(() => setError(""), 5000);
    }
  }, [router, isSyncing]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") onAuth();
    });
    return () => subscription.unsubscribe();
  }, [onAuth]);

  if (isSyncing) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="mx-4 max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
          <div className="relative mx-auto mb-6 h-20 w-20">
            <div className="absolute inset-0 rounded-full border-4 border-blue-200" />
            <div className="absolute inset-0 animate-spin rounded-full border-4 border-t-blue-600 border-r-transparent border-b-transparent border-l-transparent" />
            <Loader2 className="absolute inset-0 m-auto h-8 w-8 animate-pulse text-blue-600" />
          </div>
          <h3 className="mb-2 text-xl font-semibold text-gray-900">Verifying Your Account</h3>
          <p className="mb-4 text-sm text-gray-600">Please wait while we set up your dashboard access...</p>
          <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-1.5 rounded-full bg-blue-600"
              style={{ width: "60%", animation: "progress 3s ease-in-out infinite" }}
            />
          </div>
          <p className="text-xs text-gray-500">This may take a few seconds</p>
        </div>
      </div>
    );
  }

  return (
    <LoginLayoutRenderer branding={branding}>
      {error && (
        <div className="mb-4 flex w-full items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <div className="w-full max-w-sm">
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={[]}
        />
      </div>
    </LoginLayoutRenderer>
  );
}

const styles = `
  @keyframes progress {
    0% { width: 10%; margin-left: 0; }
    50% { width: 80%; margin-left: 10%; }
    100% { width: 95%; margin-left: 5%; }
  }
`;

if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}
