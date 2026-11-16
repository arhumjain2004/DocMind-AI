
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  LockKeyhole,
  Mail,
  Sparkles,
  User,
} from "lucide-react";
import api from "../services/api";

function Register() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
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
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await api.post("/auth/register", formData);

      const { token, user } = response.data;

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));

      navigate("/dashboard");
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Registration failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F7F4] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[2rem] border border-gray-200/80 bg-white shadow-[0_24px_80px_-32px_rgba(31,41,55,0.22)] lg:grid-cols-2">
          {/* Left branding panel */}
          <div className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-700 via-violet-700 to-purple-800 p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
            <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-indigo-300/20 blur-3xl" />

            <div className="relative z-10">
              <Link to="/" className="inline-flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/15 shadow-lg backdrop-blur">
                  <Bot size={24} />
                </div>
                <span className="text-xl font-bold tracking-tight">
                  DocMind <span className="text-indigo-200">AI</span>
                </span>
              </Link>

              <div className="mt-20 max-w-md">
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-indigo-100 backdrop-blur">
                  <Sparkles size={15} />
                  Your intelligent document workspace
                </div>

                <p className="text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
                  Turn your documents into
                  <span className="block text-indigo-200">
                    knowledge.
                  </span>
                </p>

                <p className="mt-6 max-w-sm text-base leading-7 text-indigo-100/90">
                  Ask questions, generate summaries, create quizzes, and
                  explore your documents with AI-powered assistance.
                </p>
              </div>
            </div>

            <div className="relative z-10 mt-14 space-y-4">
              {[
                "Chat with your uploaded PDFs",
                "Generate summaries and study materials",
                "Keep your documents organized in one place",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm text-indigo-50">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15">
                    <CheckCircle2 size={15} />
                  </span>
                  {item}
                </div>
              ))}

              <p className="pt-6 text-xs text-indigo-200/80">
                Intelligent document assistance, all in one workspace.
              </p>
            </div>
          </div>

          {/* Registration form */}
          <div className="flex items-center justify-center p-6 sm:p-10 lg:p-12 xl:p-16">
            <div className="w-full max-w-md">
              <div className="mb-9 lg:hidden">
                <Link to="/" className="inline-flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-200">
                    <Bot size={24} />
                  </div>
                  <span className="text-xl font-bold tracking-tight text-gray-900">
                    DocMind <span className="text-indigo-600">AI</span>
                  </span>
                </Link>
              </div>

              <div className="mb-8">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <User size={23} />
                </div>

                <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                  Create your account
                </h1>
                <p className="mt-2 text-sm leading-6 text-gray-500">
                  Sign up to start exploring your documents with DocMind AI.
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  <span className="mt-0.5 font-semibold">!</span>
                  <p>{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label
                    htmlFor="name"
                    className="mb-2 block text-sm font-semibold text-gray-700"
                  >
                    Full name
                  </label>
                  <div className="relative">
                    <User
                      size={18}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      id="name"
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Enter your name"
                      autoComplete="name"
                      required
                      className="w-full rounded-xl border border-gray-200 bg-gray-50/70 py-3.5 pl-11 pr-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-500 hover:border-gray-300 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-semibold text-gray-700"
                  >
                    Email address
                  </label>
                  <div className="relative">
                    <Mail
                      size={18}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      id="email"
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                      className="w-full rounded-xl border border-gray-200 bg-gray-50/70 py-3.5 pl-11 pr-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-500 hover:border-gray-300 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-semibold text-gray-700"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <LockKeyhole
                      size={18}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Create a password"
                      autoComplete="new-password"
                      required
                      minLength={6}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50/70 py-3.5 pl-11 pr-12 text-sm text-gray-900 outline-none transition placeholder:text-gray-500 hover:border-gray-300 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-gray-600">
                    Use at least 6 characters.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-200/70 transition hover:-translate-y-0.5 hover:from-indigo-700 hover:to-violet-700 hover:shadow-xl hover:shadow-indigo-200/80 focus:outline-none focus:ring-4 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  {loading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      Creating account...
                    </>
                  ) : (
                    <>
                      Create account
                      <ArrowRight
                        size={17}
                        className="transition-transform group-hover:translate-x-1"
                      />
                    </>
                  )}
                </button>
              </form>

              <div className="my-7 flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-xs font-medium text-gray-600">
                  ALREADY REGISTERED?
                </span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              <p className="text-center text-sm text-gray-500">
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="font-semibold text-indigo-600 transition hover:text-indigo-700 hover:underline"
                >
                  Login
                </Link>
              </p>

              <div className="mt-10 flex items-center justify-center gap-2 text-xs text-gray-600">
                <FileText size={14} />
                <span>DocMind AI · Intelligent document assistant</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;
