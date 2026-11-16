import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import api from "../services/api";

function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");
  const [status, setStatus] = useState(token ? "loading" : "missing");
  const [validatedToken, setValidatedToken] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const profileRequestRef = useRef(null);

  useEffect(() => {
    let active = true;

    if (!token) {
      return () => {
        active = false;
      };
    }

    setStatus("loading");

    const requestKey = `${token}:${retryCount}`;
    if (!profileRequestRef.current || profileRequestRef.current.key !== requestKey) {
      profileRequestRef.current = {
        key: requestKey,
        promise: api.get("/users/profile"),
      };
    }

    profileRequestRef.current.promise
      .then(() => {
        if (active) {
          setValidatedToken(token);
          setStatus("authenticated");
        }
      })
      .catch((error) => {
        if (!active) return;

        if (error.response?.status === 401) {
          // The shared API interceptor clears the session and redirects.
          setStatus("unauthorized");
          return;
        }

        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, [token, retryCount]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (status === "authenticated" && validatedToken === token) {
    return children;
  }

  if (status === "unauthorized") {
    return null;
  }

  if (status === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p role="alert" className="text-sm leading-6 text-slate-600">
            We couldn&apos;t verify your session. Check your connection and try again.
          </p>
          <button
            type="button"
            onClick={() => {
              setStatus("loading");
              setRetryCount((count) => count + 1);
            }}
            className="mt-5 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Retry
          </button>
        </section>
      </main>
    );
  }

  return (
    <main
      role="status"
      aria-live="polite"
      className="flex min-h-screen items-center justify-center bg-slate-50 px-4"
    >
      <p className="text-sm font-medium text-slate-600">Checking your session…</p>
    </main>
  );
}

export default ProtectedRoute;
