
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  MessageSquare,
  Brain,
  ArrowUpRight,
  ClipboardList,
  Sparkles,
  Layers,
  Upload,
  ShieldCheck,
  ChevronRight,
  CheckCircle2,
  Clock3,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import api from "../services/api";

function Dashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [documentsError, setDocumentsError] = useState("");

  const fetchDocuments = useCallback(async () => {
    try {
      setDocumentsLoading(true);
      setDocumentsError("");
      const response = await api.get("/documents");
      const result = response.data?.documents;
      setDocuments(Array.isArray(result) ? result : []);
    } catch (error) {
      setDocumentsError(
        error.response?.data?.message ||
          "Unable to load document activity. Please try again."
      );
    } finally {
      setDocumentsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(fetchDocuments, 0);
    return () => window.clearTimeout(timer);
  }, [fetchDocuments]);

  const readyCount = documents.filter((document) => document.status === "ready").length;
  const processingCount = documents.filter(
    (document) => document.status === "processing"
  ).length;
  const attentionCount = documents.filter(
    (document) => document.status === "failed" || document.status === "deleting"
  ).length;
  const recentDocuments = documents.slice(0, 5);

  const formatDate = (value) => {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? ""
      : new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
        }).format(date);
  };

  const dashboardCards = [
    {
      title: "Documents",
      description: "Upload, organize, and manage your PDF documents in one place.",
      icon: FileText,
      path: "/documents",
              theme: "violet",
      label: "Manage files",
    },
    {
      title: "AI Chat",
      description: "Ask questions and get contextual answers with document citations.",
      icon: MessageSquare,
      path: "/chat",
      theme: "violet",
      label: "Start a conversation",
    },
    {
      title: "AI Insights",
      description: "Turn lengthy documents into concise summaries and key takeaways.",
      icon: Brain,
      path: "/insights",
              theme: "violet",
      label: "Explore insights",
    },
    {
      title: "AI Quiz",
      description: "Generate multiple-choice questions and test your understanding.",
      icon: ClipboardList,
      path: "/quiz",
              theme: "violet",
      label: "Practice now",
    },
    {
      title: "AI Flashcards",
      description: "Create interactive study cards and revise important concepts.",
      icon: Layers,
      path: "/flashcards",
              theme: "violet",
      label: "Start revising",
    },
  ];

  const themeStyles = {
    blue: {
      icon: "bg-blue-50 text-blue-600 ring-blue-100",
      hover: "group-hover:border-blue-200",
      arrow: "group-hover:bg-blue-600 group-hover:text-white",
      accent: "bg-blue-500",
    },
    violet: {
      icon: "bg-violet-50 text-violet-600 ring-violet-100",
      hover: "group-hover:border-violet-200",
      arrow: "group-hover:bg-violet-600 group-hover:text-white",
      accent: "bg-violet-500",
    },
    emerald: {
      icon: "bg-emerald-50 text-emerald-600 ring-emerald-100",
      hover: "group-hover:border-emerald-200",
      arrow: "group-hover:bg-emerald-600 group-hover:text-white",
      accent: "bg-emerald-500",
    },
    amber: {
      icon: "bg-amber-50 text-amber-600 ring-amber-100",
      hover: "group-hover:border-amber-200",
      arrow: "group-hover:bg-amber-500 group-hover:text-white",
      accent: "bg-amber-500",
    },
    pink: {
      icon: "bg-pink-50 text-pink-600 ring-pink-100",
      hover: "group-hover:border-pink-200",
      arrow: "group-hover:bg-pink-600 group-hover:text-white",
      accent: "bg-pink-500",
    },
  };

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[#F8F7F4] text-slate-800 lg:min-h-screen">
      <main className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6 sm:py-10 lg:px-10">
        {/* Welcome hero */}
        <section className="relative isolate overflow-hidden rounded-[28px] bg-gradient-to-br from-[#171b4b] via-[#29246c] to-[#4935a5] px-6 py-8 text-white shadow-xl shadow-indigo-950/10 sm:px-9 sm:py-10 lg:px-12 lg:py-12">
          <div className="pointer-events-none absolute -right-16 -top-28 h-80 w-80 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -right-2 -top-16 h-60 w-60 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -bottom-36 right-1/4 h-72 w-72 rounded-full bg-violet-400/10 blur-3xl" />

          <div className="relative z-10 flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-indigo-100 backdrop-blur-sm">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                Your AI-powered document workspace
              </div>

              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-[42px] lg:leading-[1.15]">
                Welcome back, {user?.name || "there"}!
                <span className="ml-2 inline-block">👋</span>
              </h1>

              <p className="mt-4 max-w-xl text-sm leading-7 text-indigo-100/80 sm:text-base">
                Make your documents work smarter. Upload PDFs, ask questions,
                uncover insights, and turn information into knowledge — all
                in one place.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/documents")}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-indigo-700 shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-800"
                >
                  <Upload className="h-4 w-4" />
                  Upload a document
                  <ArrowUpRight className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/chat")}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white"
                >
                  <MessageSquare className="h-4 w-4" />
                  Open AI Chat
                </button>
              </div>
            </div>

            <div className="hidden shrink-0 items-center justify-center lg:flex">
              <div className="relative flex h-48 w-48 items-center justify-center rounded-[32px] border border-white/15 bg-white/[0.07] shadow-2xl shadow-indigo-950/20 backdrop-blur-md xl:h-56 xl:w-56">
                <div className="absolute inset-4 rounded-[26px] border border-white/10" />
                <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-gradient-to-br from-white to-indigo-100 text-indigo-700 shadow-xl shadow-black/10 xl:h-28 xl:w-28">
                  <FileText className="h-12 w-12 xl:h-14 xl:w-14" />
                </div>
                <div className="absolute -right-3 top-7 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white text-violet-600 shadow-lg">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div className="absolute -bottom-3 -left-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white text-emerald-600 shadow-lg">
                  <Brain className="h-6 w-6" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Document overview */}
        <section className="mt-8 sm:mt-10" aria-labelledby="dashboard-documents-heading">
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">
                Your library
              </p>
              <h2 id="dashboard-documents-heading" className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                Document activity
              </h2>
            </div>
            <button
              type="button"
              onClick={fetchDocuments}
              disabled={documentsLoading}
              className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${documentsLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {documentsError && (
            <div role="alert" className="mb-4 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
              <span className="inline-flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" />{documentsError}</span>
              <button type="button" onClick={fetchDocuments} disabled={documentsLoading} className="w-fit font-bold text-red-800 underline underline-offset-2 disabled:opacity-50">Try again</button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Total documents", value: documents.length, icon: FileText },
              { label: "Ready for AI", value: readyCount, icon: CheckCircle2 },
              { label: "Processing", value: processingCount, icon: Clock3 },
              { label: "Need attention", value: attentionCount, icon: AlertCircle },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 sm:text-sm">
                  <Icon className="h-4 w-4 text-violet-600" aria-hidden="true" />
                  {label}
                </div>
                <p className="mt-3 text-2xl font-bold tabular-nums text-slate-900">
                  {documentsError && documents.length === 0 ? "—" : documentsLoading && documents.length === 0 ? <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-label="Loading statistics" /> : value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900">Recent documents</h3>
                <p className="mt-1 text-xs text-slate-500">Your latest uploaded files</p>
              </div>
              <button type="button" onClick={() => navigate("/documents")} className="text-xs font-bold text-violet-700 hover:text-violet-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                View library
              </button>
            </div>

            {documentsLoading && documents.length === 0 ? (
              <div className="flex items-center gap-2 py-5 text-sm text-slate-500" role="status"><Loader2 className="h-4 w-4 animate-spin text-violet-600" />Loading recent documents...</div>
            ) : documentsError ? (
              <p className="py-3 text-sm text-slate-500">Recent documents are unavailable until the library can be loaded.</p>
            ) : recentDocuments.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-7 text-center">
                <p className="text-sm font-semibold text-slate-700">No documents yet</p>
                <p className="mt-1 text-xs text-slate-500">Upload a PDF to start building your library.</p>
                <button type="button" onClick={() => navigate("/documents")} className="mt-3 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-700">Go to Documents</button>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentDocuments.map((document) => {
                  const title = document.title || document.originalName || "Untitled document";
                  const isReady = document.status === "ready";
                  return (
                    <li key={document._id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><FileText className="h-4 w-4" aria-hidden="true" /></span>
                        <div className="min-w-0">
                          <p className="break-words text-sm font-semibold text-slate-800">{title}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatDate(document.createdAt)}{document.pageCount != null ? ` · ${document.pageCount} pages` : ""}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:justify-end">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${isReady ? "bg-emerald-50 text-emerald-700" : document.status === "failed" ? "bg-red-50 text-red-700" : document.status === "deleting" ? "bg-orange-50 text-orange-700" : "bg-amber-50 text-amber-700"}`}>
                          {isReady ? "Ready for AI" : document.status === "failed" ? "Processing failed" : document.status === "deleting" ? "Deletion pending" : "Processing"}
                        </span>
                        <button type="button" onClick={() => isReady ? navigate("/chat", { state: { documentId: document._id } }) : navigate("/documents")} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-violet-700 hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                          {isReady ? "Ask AI" : "View"}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* Feature section */}
        <section className="mt-10 sm:mt-12">
          <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">
                Workspace tools
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-[27px]">
                Explore DocMind AI
              </h2>
              <p className="mt-1.5 text-sm leading-6 text-slate-500">
                Everything you need to understand and work with your documents.
              </p>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              Your personal workspace
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {dashboardCards.map((card) => {
              const Icon = card.icon;
              const theme = themeStyles[card.theme];

              return (
                <button
                  key={card.title}
                  type="button"
                  onClick={() => navigate(card.path)}
                  className={`group relative flex min-h-[218px] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 text-left shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/60 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:p-6 ${theme.hover}`}
                >
                  <div className={`absolute left-0 top-0 h-1 w-0 ${theme.accent} transition-all duration-300 group-hover:w-full`} />

                  <div className="flex items-start justify-between">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ring-1 transition duration-300 group-hover:scale-105 ${theme.icon}`}>
                      <Icon className="h-5.5 w-5.5" />
                    </div>
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition duration-300 ${theme.arrow}`}>
                      <ArrowUpRight className="h-4 w-4" />
                    </div>
                  </div>

                  <div className="mt-5 flex-1">
                    <h3 className="text-base font-bold tracking-tight text-slate-900">
                      {card.title}
                    </h3>
                    <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                      {card.description}
                    </p>
                  </div>

                  <div className="mt-5 flex items-center gap-1.5 text-xs font-semibold text-slate-600 transition group-hover:text-indigo-600">
                    {card.label}
                    <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-slate-200/80 py-5 text-center text-xs text-slate-600 sm:flex-row sm:text-left">
          <p>© {new Date().getFullYear()} DocMind AI. Your intelligent document workspace.</p>
          <p className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            Built for smarter document workflows
          </p>
        </footer>
      </main>
    </div>
  );
}

export default Dashboard;
