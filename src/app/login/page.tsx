"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const getErrorMessage = (code: string): string => {
    const errors: Record<string, string> = {
      "Configuration": "Server configuration error. Check server logs for details.",
      "AccessDenied": "Access denied. You may not have permission to sign in.",
      "Verification": "Verification token expired or already used.",
      "OAuthSignin": "Error starting the OAuth sign-in flow. Check provider configuration.",
      "OAuthCallback": "Error during OAuth callback. Check provider configuration.",
      "OAuthCreateAccount": "Could not create OAuth account. Check database/adapter configuration.",
      "EmailCreateAccount": "Could not create email account.",
      "Callback": "Error in the OAuth callback handler.",
      "OAuthAccountNotLinked": "This email is already associated with another account.",
      "MissingCSRF": "Missing CSRF token. This usually means the sign-in method is incorrect.",
      "Default": "An unexpected authentication error occurred.",
    };
    return errors[code] ?? `${errors["Default"]} (Code: ${code})`;
  };

  useEffect(() => {
    console.log("[Login] Page loaded");


    // Check URL for error params (Auth.js redirects here with ?error=...)
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get("error");
    if (errorParam) {
      console.error("[Login] Auth error from URL:", errorParam);
      console.error("[Login] Full URL:", window.location.href);
      requestAnimationFrame(() => {
        setError(getErrorMessage(errorParam));
        setDebug(`Auth error: ${errorParam}`);
      });
    }
  }, []);



  const handleSignIn = async (provider: "google" | "github") => {
    console.log(`[Login] Attempting sign in with ${provider}...`);
    setDebug(`Signing in with ${provider}...`);
    setError(null);
    setIsLoading(true);

    try {
      // Use signIn from next-auth/react - this handles CSRF token automatically
      // Auth.js v5 requires POST with CSRF token for provider signin
      console.log(`[Login] Calling signIn("${provider}", { callbackUrl: "/" })`);

      // signIn with redirect: true (default) will redirect the browser
      // and this function effectively never returns on success
      await signIn(provider, { callbackUrl: "/" });
    } catch (err) {
      console.error("[Login] Sign in exception:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setDebug(`Exception: ${err instanceof Error ? err.message : String(err)}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="aurora-bg min-h-screen flex items-center justify-center p-4">
      <div className="glass-card rounded-3xl shadow-2xl p-8 md:p-12 w-full max-w-md">
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-purple-500 flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"></path>
              </svg>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-500 to-purple-500 bg-clip-text text-transparent">
              Linkie Claw
            </h1>
          </div>
          <p className="text-gray-600 text-lg">
            AI-powered LinkedIn content studio
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-600 text-sm font-medium">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={() => handleSignIn("google")}
            disabled={isLoading}
            data-testid="login-btn-google"
            className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-white border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 hover:border-gray-300 group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            )}
            <span className="text-gray-700 font-medium group-hover:text-gray-900">
              {isLoading ? "Loading..." : "Continue with Google"}
            </span>
          </button>

          <button
            onClick={() => handleSignIn("github")}
            disabled={isLoading}
            data-testid="login-btn-github"
            className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-slate-900 text-white shadow-sm hover:shadow-md transition-all duration-200 hover:bg-slate-800 group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
            )}
            <span className="font-medium">
              {isLoading ? "Loading..." : "Continue with GitHub"}
            </span>
          </button>
        </div>

        {/* Debug output */}
        {debug && (
          <div className="mt-6 p-4 bg-gray-100 rounded-xl">
            <p className="text-xs text-gray-600 font-mono">Debug: {debug}</p>
          </div>
        )}

        <p className="text-center text-gray-500 text-sm mt-8">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
