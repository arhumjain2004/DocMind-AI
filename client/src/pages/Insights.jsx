
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  ClipboardList,
  FileText,
  Layers,
  Loader2,
  RefreshCw,
  Sparkles,
  AlertCircle,
  Lightbulb,
  WandSparkles,
  MessageSquareText,
} from "lucide-react";
import api from "../services/api";

function Insights() {
  const navigate = useNavigate();

  const [documents, setDocuments] = useState([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [summary, setSummary] = useState("");
  const [summaryTitle, setSummaryTitle] = useState("");
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [documentsError, setDocumentsError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchDocuments = useCallback(async () => {
    try {
      setLoadingDocuments(true);
      setDocumentsError("");

      const response = await api.get("/documents");
      const data = response.data;

      const allDocuments = Array.isArray(data)
        ? data
        : Array.isArray(data.documents)
          ? data.documents
          : [];

      const readyDocuments = allDocuments.filter(
        (document) => document.status === "ready"
      );

      setDocuments(readyDocuments);

      setSelectedDocumentId((currentId) => {
        if (
          currentId &&
          readyDocuments.some((document) => document._id === currentId)
        ) {
          return currentId;
        }

        return readyDocuments[0]?._id || "";
      });
    } catch (err) {
      setDocumentsError(
        err.response?.data?.message ||
          "Unable to load documents. Please try again."
      );
    } finally {
      setLoadingDocuments(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(fetchDocuments, 0);
    return () => window.clearTimeout(timer);
  }, [fetchDocuments]);

  const handleDocumentChange = (event) => {
    setSelectedDocumentId(event.target.value);
    setSummary("");
    setSummaryTitle("");
    setError("");
    setSuccess("");
  };

  const handleGenerateSummary = async () => {
    if (!selectedDocumentId) {
      setError("Please select a ready document.");
      return;
    }

    try {
      setGenerating(true);
      setError("");
      setSuccess("");
      setSummary("");
      setSummaryTitle("");

      const response = await api.post("/documents/summarize", {
        documentId: selectedDocumentId,
      });

      const generatedSummary = response.data?.summary;
      if (
        typeof generatedSummary !== "string" ||
        generatedSummary.trim().length === 0
      ) {
        setError(
          "No usable summary was returned. Please try generating it again."
        );
        return;
      }

      setSummary(generatedSummary);
      setSummaryTitle(
        response.data.document?.title || "Document Summary"
      );
      setSuccess(
        response.data.message || "Summary generated successfully."
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to generate the summary. Please try again."
      );
    } finally {
      setGenerating(false);
    }
  };

  const selectedDocument = documents.find(
    (document) => document._id === selectedDocumentId
  );

  const renderSummary = () => {
    if (typeof summary !== "string") {
      return (
        <p role="alert" className="text-sm leading-6 text-red-700">
          This summary could not be displayed. Please generate it again.
        </p>
      );
    }

    const lines = summary.split(/\r?\n/);
    const blocks = [];

    for (let index = 0; index < lines.length;) {
      const text = lines[index].trim();
      if (!text) {
        blocks.push(
          <div key={`space-${index}`} className="h-3" aria-hidden="true" />
        );
        index += 1;
        continue;
      }

      const heading =
        text.match(/^#{1,4}\s+(.+)$/) ||
        text.match(/^([A-Z][^.!?]{2,60}):$/);
      if (heading) {
        blocks.push(
          <h4 key={`heading-${index}`} className="break-words pt-3 text-base font-bold text-slate-900 first:pt-0 sm:text-lg">
            {heading[1]}
          </h4>
        );
        index += 1;
        continue;
      }

      const firstItem = text.match(/^([-*•]|\d+[.)])\s+(.+)$/);
      if (firstItem) {
        const ordered = /^\d/.test(firstItem[1]);
        const items = [];
        const listStart = index;

        while (index < lines.length) {
          const item = lines[index].trim().match(/^([-*•]|\d+[.)])\s+(.+)$/);
          if (!item || /^\d/.test(item[1]) !== ordered) break;
          items.push(item[2]);
          index += 1;
        }

        const List = ordered ? "ol" : "ul";
        const listProps = ordered
          ? { start: Number.parseInt(firstItem[1], 10) }
          : {};
        blocks.push(
          <List
            key={`list-${listStart}`}
            {...listProps}
            className={`space-y-2 pl-6 text-slate-700 marker:text-indigo-600 ${ordered ? "list-decimal" : "list-disc"}`}
          >
            {items.map((item, itemIndex) => (
              <li key={`list-item-${listStart}-${itemIndex}`} className="break-words pl-1">
                {item}
              </li>
            ))}
          </List>
        );
        continue;
      }

      blocks.push(
        <p key={`paragraph-${index}`} className="break-words text-slate-700">
          {text}
        </p>
      );
      index += 1;
    }

    return blocks;
  };

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[#F8F7F4] text-slate-900 lg:min-h-screen">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {/* Hero */}
        <section className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 px-6 py-8 text-white shadow-xl shadow-indigo-200/50 sm:px-9 sm:py-10">
          <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-28 right-1/3 h-64 w-64 rounded-full bg-violet-300/20 blur-3xl" />

          <div className="relative z-10 flex flex-col justify-between gap-8 md:flex-row md:items-center">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-indigo-50 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" />
                AI-powered document analysis
              </div>

              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Discover insights
                <br className="hidden sm:block" /> from your documents
              </h1>

              <p className="mt-3 max-w-xl text-sm leading-6 text-indigo-100 sm:text-base">
                Generate AI-powered summaries from your uploaded PDFs
                and turn lengthy documents into concise, useful study
                material.
              </p>

              <div className="mt-6 flex flex-wrap gap-3 text-xs font-medium text-indigo-50 sm:text-sm">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2">
                  <Brain className="h-4 w-4" />
                  AI summaries
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2">
                  <Lightbulb className="h-4 w-4" />
                  Key concepts
                </span>
              </div>
            </div>

            <div className="hidden shrink-0 items-center justify-center md:flex">
              <div className="relative flex h-36 w-36 items-center justify-center rounded-[2rem] border border-white/20 bg-white/10 shadow-2xl backdrop-blur-sm">
                <div className="absolute -right-3 -top-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-lg">
                  <WandSparkles className="h-5 w-5" />
                </div>
                <Brain
                  className="h-16 w-16 text-white"
                  strokeWidth={1.3}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Summary generator */}
        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">
                Generate document summary
              </h2>
              <p className="mt-1 text-sm leading-5 text-slate-500">
                Select a processed PDF and let AI create a summary
                from its extracted content.
              </p>
            </div>
          </div>

          <label
            htmlFor="insights-document"
            className="mb-2 block text-sm font-semibold text-slate-700"
          >
            Select a document
          </label>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <FileText className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <select
                id="insights-document"
                value={selectedDocumentId}
                onChange={handleDocumentChange}
                disabled={loadingDocuments || Boolean(documentsError) || documents.length === 0 || generating}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingDocuments ? (
                  <option value="">Loading documents...</option>
                ) : documentsError ? (
                  <option value="">Documents could not be loaded</option>
                ) : documents.length === 0 ? (
                  <option value="">No ready documents available</option>
                ) : (
                  documents.map((document) => (
                    <option key={document._id} value={document._id}>
                      {document.title ||
                        document.originalName ||
                        "Untitled"}
                    </option>
                  ))
                )}
              </select>
            </div>

            <button
              type="button"
              onClick={handleGenerateSummary}
              disabled={
                !selectedDocumentId ||
                generating ||
                loadingDocuments
              }
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Summary
                </>
              )}
            </button>
          </div>

          <div className="mt-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <p className="text-xs text-slate-500">
              Only documents with ready status are shown.
            </p>
            <button
              type="button"
              onClick={fetchDocuments}
              disabled={loadingDocuments || generating}
              className="inline-flex items-center gap-1.5 self-start text-xs font-semibold text-indigo-600 transition hover:text-indigo-800 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  loadingDocuments ? "animate-spin" : ""
                }`}
              />
              {documentsError ? "Retry loading documents" : "Refresh documents"}
            </button>
          </div>

          {documentsError && !loadingDocuments && (
            <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-5 text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {documentsError}
            </div>
          )}

          {documents.length === 0 && !loadingDocuments && !documentsError && (
            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <p className="text-sm leading-5 text-amber-800">
                  No ready documents found. Upload a PDF and wait
                  until processing is complete.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/documents")}
                className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-amber-900 hover:underline"
              >
                Upload PDF
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {success && (
            <div
              role="status"
              className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{success}</p>
            </div>
          )}
        </section>

        {/* Generating state */}
        {generating && (
          <section role="status" aria-live="polite" className="rounded-3xl border border-indigo-100 bg-white px-6 py-20 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
            <h2 className="mt-5 text-xl font-bold text-slate-900">
              Preparing your insights
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              AI is analyzing{" "}
              <span className="font-semibold text-slate-700">
                {selectedDocument?.title || "your document"}
              </span>{" "}
              and generating a summary. This may take a moment.
            </p>
            <div className="mx-auto mt-6 h-1.5 max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
            </div>
          </section>
        )}

        {/* Generated summary */}
        {!generating && summary && (
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-50/80 via-white to-violet-50/60 p-5 sm:p-7">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-200">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="mb-1 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600">
                      <Sparkles className="h-3.5 w-3.5" />
                      AI-generated insights
                    </div>
                    <h2 className="break-words text-xl font-bold text-slate-900 sm:text-2xl">
                      {summaryTitle || "Document Summary"}
                    </h2>
                    <p className="mt-1 break-words text-sm text-slate-500">
                      {selectedDocument?.title || "Selected document"}
                    </p>
                  </div>
                </div>

                <span className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Summary ready
                </span>
              </div>
            </div>

            <div className="p-5 sm:p-7">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <Brain className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">
                  Summary overview
                </h3>
              </div>

              <div className="mx-auto max-w-3xl rounded-2xl border border-slate-100 bg-slate-50/80 p-5 sm:p-7">
                <div className="space-y-2 text-sm leading-7 sm:text-base">
                  {renderSummary()}
                </div>
                <p className="mt-6 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">
                  This summary is AI-generated. Verify important details against the original PDF; source citations are not included here.
                </p>
              </div>

              <div className="mt-6">
                <div className="mb-3">
                  <h3 className="text-sm font-bold text-slate-800">
                    Continue learning
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Explore your document with more AI-powered study tools.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() =>
                      navigate("/chat", {
                        state: { documentId: selectedDocumentId },
                      })
                    }
                    className="group flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-left transition hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-indigo-50 hover:shadow-md"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 transition group-hover:bg-indigo-600 group-hover:text-white">
                      <MessageSquareText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-800">
                        Ask questions
                      </p>
                      <p className="mt-1 text-xs leading-4 text-slate-500">
                        Chat with your document
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-indigo-400 transition group-hover:translate-x-1 group-hover:text-indigo-600" />
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate("/quiz")}
                    className="group flex items-center gap-3 rounded-2xl border border-orange-100 bg-orange-50/60 p-4 text-left transition hover:-translate-y-0.5 hover:border-orange-200 hover:bg-orange-50 hover:shadow-md"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600 transition group-hover:bg-orange-500 group-hover:text-white">
                      <ClipboardList className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-800">
                        Generate quiz
                      </p>
                      <p className="mt-1 text-xs leading-4 text-slate-500">
                        Test your understanding
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-orange-400 transition group-hover:translate-x-1 group-hover:text-orange-600" />
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate("/flashcards")}
                    className="group flex items-center gap-3 rounded-2xl border border-violet-100 bg-violet-50/60 p-4 text-left transition hover:-translate-y-0.5 hover:border-violet-200 hover:bg-violet-50 hover:shadow-md"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600 transition group-hover:bg-violet-600 group-hover:text-white">
                      <Layers className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-800">
                        Study flashcards
                      </p>
                      <p className="mt-1 text-xs leading-4 text-slate-500">
                        Revise key concepts
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-violet-400 transition group-hover:translate-x-1 group-hover:text-violet-600" />
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Empty state */}
        {!loadingDocuments &&
          documents.length === 0 &&
          !generating &&
          !summary &&
          !error &&
          !documentsError && (
            <section className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm sm:py-20">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-50 to-violet-100 text-indigo-600 ring-1 ring-indigo-100">
                <FileText className="h-9 w-9" />
              </div>
              <div className="mx-auto mt-6 max-w-lg">
                <h2 className="text-xl font-bold text-slate-900">
                  No ready documents found
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500 sm:text-base">
                  Upload a PDF and wait until processing is complete.
                  Once your document is ready, you can generate an
                  AI-powered summary here.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/documents")}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-0.5 hover:bg-indigo-700"
              >
                <FileText className="h-4 w-4" />
                Go to Documents
                <ArrowRight className="h-4 w-4" />
              </button>
            </section>
          )}

        {/* Footer */}
        <footer className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-slate-200 pt-5 text-center sm:flex-row sm:text-left">
          <p className="text-xs text-slate-600">
            DocMind AI · Intelligent RAG Document Assistant
          </p>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-indigo-600"
          >
            Back to workspace
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </footer>
      </main>
    </div>
  );
}

export default Insights;
