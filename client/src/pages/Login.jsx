
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bot,
  Mail,
  LockKeyhole,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  Sparkles,
  FileText,
  ShieldCheck,
  BrainCircuit,
} from "lucide-react";
import api from "../services/api";

function Login() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });

    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await api.post("/auth/login", formData);

      const { token, user } = response.data;

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));

      navigate("/dashboard");
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Login failed. Please check your credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden  bg-[#F8F7F4] px-4 py-10">
      {/* Background decorations */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-violet-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-[30rem] w-[30rem] rounded-full bg-indigo-200/40 blur-3xl" />

      {/* Main layout */}
      <div className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white bg-white shadow-2xl shadow-violet-100/70 lg:min-h-[610px] lg:grid-cols-2">
        {/* Left branding panel */}
        <section className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#17164b] via-[#30217f] to-[#4b2ba5] p-10 text-white lg:flex xl:p-12">
          {/* Decorative circles */}
          <div className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -bottom-36 -left-28 h-80 w-80 rounded-full border border-white/10" />

          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 shadow-lg ring-1 ring-white/20 backdrop-blur">
                <Bot className="h-6 w-6" />
              </div>
              <div>
                <span className="text-xl font-extrabold tracking-tight">
                  DocMind <span className="text-violet-300">AI</span>
                </span>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-200/80">
                  Intelligent document workspace
                </p>
              </div>
            </div>

            <div className="mt-20">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-violet-100 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                Your AI-powered knowledge space
              </div>

              <p className="max-w-md text-4xl font-extrabold leading-[1.15] tracking-tight xl:text-5xl">
                Turn your documents into{" "}
                <span className="text-violet-300">knowledge.</span>
              </p>

              <p className="mt-5 max-w-md text-sm leading-7 text-violet-100/80">
                Upload your PDFs, ask questions, generate summaries, and
                discover insights with your intelligent document assistant.
              </p>
            </div>

            {/* Feature illustration */}
            <div className="relative mx-auto mt-12 flex h-48 w-full max-w-sm items-center justify-center">
              <div className="absolute h-44 w-44 rounded-full border border-white/10 bg-white/[0.03]" />
              <div className="absolute h-36 w-36 rounded-full border border-white/10" />

              <div className="relative flex h-28 w-28 items-center justify-center rounded-[2rem] border border-white/20 bg-white/10 shadow-2xl shadow-indigo-950/30 backdrop-blur-xl">
                <FileText className="h-14 w-14 text-violet-100" />
                <div className="absolute -right-5 -top-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white text-violet-600 shadow-lg">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="absolute -bottom-4 -left-5 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white text-emerald-600 shadow-lg">
                  <BrainCircuit className="h-5 w-5" />
                </div>
              </div>

              <div className="absolute right-3 top-5 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-[10px] font-semibold text-violet-100 backdrop-blur">
                AI-powered answers
              </div>
              <div className="absolute bottom-2 left-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-[10px] font-semibold text-violet-100 backdrop-blur">
                Smart PDF insights
              </div>
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-2 text-xs text-violet-200/70">
            <ShieldCheck className="h-4 w-4" />
            Your personal document workspace
          </div>
        </section>

        {/* Right login form */}
        <section className="flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-12 xl:px-16">
          {/* Mobile brand */}
          <div className="mb-10 flex items-center justify-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-200">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-slate-900">
                DocMind <span className="text-violet-600">AI</span>
              </span>
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                Intelligent document workspace
              </p>
            </div>
          </div>

          <div className="mb-8">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-violet-700">
              <Sparkles className="h-3.5 w-3.5" />
              Welcome back
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Sign in to your
              <span className="block text-violet-600">workspace.</span>
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              Enter your credentials to continue working with your documents.
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100">
                <span className="text-xs font-bold">!</span>
              </div>
              <p className="leading-6">{error}</p>
            </div>
          )}

          {/* Login form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-bold text-slate-700"
              >
                Email address
              </label>

              <div className="group relative">
                <Mail className="absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400 transition group-focus-within:text-violet-600" />
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-3.5 pl-12 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-500 hover:border-slate-300 focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label
                  htmlFor="password"
                  className="block text-sm font-bold text-slate-700"
                >
                  Password
                </label>
              </div>

              <div className="group relative">
                <LockKeyhole className="absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400 transition group-focus-within:text-violet-600" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-3.5 pl-12 pr-12 text-sm text-slate-800 outline-none transition placeholder:text-slate-500 hover:border-slate-300 focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-violet-50 hover:text-violet-600"
                >
                  {showPassword ? (
                    <EyeOff className="h-[18px] w-[18px]" />
                  ) : (
                    <Eye className="h-[18px] w-[18px]" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-200 transition duration-200 hover:-translate-y-0.5 hover:from-violet-700 hover:to-indigo-700 hover:shadow-xl hover:shadow-violet-200 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          {/* Register link */}
          <div className="mt-7 text-center">
            <p className="text-sm text-slate-500">
              Don't have an account?{" "}
              <Link
                to="/register"
                className="font-bold text-violet-700 transition hover:text-indigo-700 hover:underline"
              >
                Create account
              </Link>
            </p>
          </div>

          {/* Security note */}
          <div className="mt-9 flex items-center justify-center gap-2 border-t border-slate-100 pt-6 text-center text-[11px] leading-5 text-slate-600">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
            Secure access to your personal document workspace
          </div>
        </section>
      </div>
    </div>
  );
}

export default Login;
