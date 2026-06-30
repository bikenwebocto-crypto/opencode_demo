"use client";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/lib/supabase/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const syncedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false); // Loading for slow API

  const onAuth = useCallback(async () => {
    if (syncedRef.current || isSyncing) return;
    
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) return;

    syncedRef.current = true;
    setIsSyncing(true); // Show loading for slow API

    try {
      console.log('session token:', session.access_token)
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

        setTimeout(() => {
          setError("");
        }, 5000);
        
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
      
      setTimeout(() => {
        setError("");
      }, 5000);
    }
  }, [router, isSyncing]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        onAuth();
      }
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, [onAuth]);

  // Show loading overlay for the slow sync-admin API
  if (isSyncing) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-t-blue-600 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
            <Loader2 className="absolute inset-0 m-auto h-8 w-8 text-blue-600 animate-pulse" />
          </div>
          
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Verifying Your Account
          </h3>
          
          <p className="text-gray-600 text-sm mb-4">
            Please wait while we set up your dashboard access...
          </p>
          
          <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2 overflow-hidden">
            <div className="bg-blue-600 h-1.5 rounded-full animate-[progress_3s_ease-in-out_infinite]" 
                 style={{ width: '60%' }} />
          </div>
          
          <p className="text-xs text-gray-500">
            This may take a few seconds
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 420, margin: "100px auto" }}>
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      
      <Auth
        supabaseClient={supabase}
        appearance={{ theme: ThemeSupa }}
        providers={["google", "github"]}
      />
    </div>
  );
}

// Add custom animation for progress bar
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