
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  AlertCircle,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Layers,
  Loader2,
  RotateCcw,
  Sparkles,
  Brain,
  GraduationCap,
  RefreshCw,
  Trophy,
} from "lucide-react";
import api from "../services/api";

function Flashcards() {
  const navigate = useNavigate();

  const [documents, setDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState("");
  const [cards, setCards] = useState([]);
  const [title, setTitle] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [documentsError, setDocumentsError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [completedCards, setCompletedCards] = useState([]);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoadingDocuments(true);
      setDocumentsError("");

      const response = await api.get("/documents");
      const readyDocuments = (response.data.documents || []).filter(
        (document) => document.status === "ready"
      );

      setDocuments(readyDocuments);
      setSelectedDocument((currentId) =>
        currentId && readyDocuments.some((document) => document._id === currentId)
          ? currentId
          : readyDocuments[0]?._id || ""
      );
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

  const resetStudySession = () => {
    setCards([]);
    setTitle("");
    setCurrentIndex(0);
    setIsFlipped(false);
    setCompletedCards([]);
  };

  const handleGenerate = async () => {
    if (!selectedDocument) {
      setError("Please select a document first.");
      return;
    }

    try {
      setGenerating(true);
      setError("");
      resetStudySession();

      const response = await api.post("/documents/flashcards", {
        documentId: selectedDocument,
      });

      const generatedCards =
        response.data.flashcards?.cards || [];

      if (generatedCards.length === 0) {
        throw new Error("No flashcards were returned.");
      }

      setCards(generatedCards);
      setTitle(
        response.data.flashcards?.title ||
          "Document Study Flashcards"
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to generate flashcards. Please try again."
      );
    } finally {
      setGenerating(false);
    }
  };

  const currentCard = cards[currentIndex];

  const handleFlip = () => {
    setIsFlipped((previous) => !previous);
  };

  const goToCard = (index) => {
    if (index < 0 || index >= cards.length) return;

    setCurrentIndex(index);
    setIsFlipped(false);
  };

  const handleMarkReviewed = () => {
    setCompletedCards((previous) =>
      previous.includes(currentIndex)
        ? previous
        : [...previous, currentIndex]
    );

    if (currentIndex < cards.length - 1) {
      goToCard(currentIndex + 1);
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setCompletedCards([]);
  };

  const handleDocumentChange = (event) => {
    setSelectedDocument(event.target.value);
    resetStudySession();
    setError("");
  };

  const selectedDocumentTitle =
    documents.find((doc) => doc._id === selectedDocument)?.title ||
    "Selected document";

  const progress =
    cards.length > 0
      ? Math.round((completedCards.length / cards.length) * 100)
      : 0;

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
                AI-powered active recall
              </div>

              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Learn smarter with
                <br className="hidden sm:block" /> AI Flashcards
              </h1>

              <p className="mt-3 max-w-xl text-sm leading-6 text-indigo-100 sm:text-base">
                Transform your uploaded documents into interactive
                study cards. Test your knowledge, reveal answers,
                and track your revision progress.
              </p>

              <div className="mt-6 flex flex-wrap gap-3 text-xs font-medium text-indigo-50 sm:text-sm">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2">
                  <Brain className="h-4 w-4" />
                  AI-generated concepts
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2">
                  <GraduationCap className="h-4 w-4" />
                  Interactive revision
                </span>
              </div>
            </div>

            <div className="hidden shrink-0 items-center justify-center md:flex">
              <div className="relative flex h-36 w-36 items-center justify-center rounded-[2rem] border border-white/20 bg-white/10 shadow-2xl backdrop-blur-sm">
                <div className="absolute -right-3 -top-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-lg">
                  <Sparkles className="h-5 w-5" />
                </div>
                <Layers className="h-16 w-16 text-white" strokeWidth={1.3} />
              </div>
            </div>
          </div>
        </section>

        {/* Document selection */}
        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">
                Choose your study material
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Select a processed document to generate a personalized
                flashcard set.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <FileText className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <select
                id="flashcard-document"
                value={selectedDocument}
                onChange={handleDocumentChange}
                disabled={loadingDocuments || generating}
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
                      {document.title || document.originalName || "Untitled document"}
                    </option>
                  ))
                )}
              </select>
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={
                loadingDocuments || generating || !selectedDocument
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Flashcards
                </>
              )}
            </button>
          </div>

          {documentsError && !loadingDocuments && (
            <div role="alert" className="mt-4 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-start gap-2 text-sm leading-5 text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {documentsError}
              </p>
              <button type="button" onClick={fetchDocuments} disabled={loadingDocuments || generating} className="inline-flex w-fit shrink-0 items-center gap-2 rounded-lg px-2 py-1 text-sm font-semibold text-red-800 underline underline-offset-2 disabled:opacity-50">
                <RefreshCw className={`h-4 w-4 ${loadingDocuments ? "animate-spin" : ""}`} />
                Retry loading documents
              </button>
            </div>
          )}

          {documents.length === 0 && !loadingDocuments && !documentsError && (
            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-5 text-amber-800">
                Upload and process a PDF before generating flashcards.
              </p>
              <button
                type="button"
                onClick={() => navigate("/documents")}
                className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-amber-900 hover:underline"
              >
                Upload document
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              <span className="mt-0.5 font-bold">!</span>
              <p>{error}</p>
            </div>
          )}
        </section>

        {/* Generating state */}
        {generating && (
          <section className="rounded-3xl border border-indigo-100 bg-white px-6 py-20 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
            <h2 className="mt-5 text-xl font-bold text-slate-900">
              Creating your flashcards
            </h2>
            <p className="mx-auto mt-2 max-w-md break-words text-sm leading-6 text-slate-500">
              AI is analyzing <span className="break-words font-semibold text-slate-700">{selectedDocumentTitle}</span> and preparing your study cards.
              This may take a moment.
            </p>
            <div className="mx-auto mt-6 h-1.5 max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
            </div>
          </section>
        )}

        {/* Study area */}
        {!generating && cards.length > 0 && currentCard && (
          <section>
            {/* Study header and stats */}
            <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div className="min-w-0">
                <div className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-600">
                  <Sparkles className="h-3.5 w-3.5" />
                  Your study session
                </div>
                <h2 className="break-words text-xl font-bold text-slate-900 sm:text-2xl">
                  {title}
                </h2>
                <p className="mt-1 flex min-w-0 items-start gap-1.5 text-sm text-slate-500">
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 break-words">{selectedDocumentTitle}</span>
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm shadow-sm">
                  <Layers className="h-4 w-4 text-indigo-500" />
                  <span className="font-semibold tabular-nums text-slate-800">
                    {cards.length}
                  </span>
                  <span className="text-slate-500">Cards</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm">
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span className="font-semibold tabular-nums text-emerald-700">
                    {completedCards.length}
                  </span>
                  <span className="text-emerald-700">Reviewed</span>
                </div>
              </div>
            </div>

            {/* Progress */}
            <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-700">
                  Revision progress
                </span>
                <span className="text-sm font-bold tabular-nums text-indigo-600">
                  {progress}%
                </span>
              </div>
              <div
                className="h-2.5 overflow-hidden rounded-full bg-slate-100"
                role="progressbar"
                aria-label="Flashcard review progress"
                aria-valuemin={0}
                aria-valuemax={cards.length}
                aria-valuenow={completedCards.length}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-500 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs text-slate-600">
                <span>{completedCards.length} completed</span>
                <span>{cards.length - completedCards.length} remaining</span>
              </div>
            </div>

            {/* Flashcard */}
            <div className="relative">
              <div className="absolute -inset-1 rounded-[2rem] bg-gradient-to-r from-indigo-200/50 to-violet-200/50 blur-xl" />
              <button
                type="button"
                onClick={handleFlip}
                aria-label={
                  isFlipped
                    ? "Show question"
                    : "Flip card to reveal answer"
                }
                className={`group relative block min-h-[340px] w-full overflow-hidden rounded-3xl border bg-white text-center shadow-lg transition duration-300 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-indigo-200 sm:min-h-[390px] ${isFlipped ? "border-emerald-200 shadow-emerald-100/60" : "border-indigo-100 shadow-indigo-100/50 hover:border-indigo-200"}`}
              >
                <div className="absolute left-0 top-0 h-1.5 w-full bg-gradient-to-r from-indigo-600 via-violet-500 to-fuchsia-500" />
                <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-50/80 blur-2xl transition group-hover:bg-violet-50" />
                <div className="absolute -bottom-20 -left-12 h-48 w-48 rounded-full bg-violet-50/70 blur-2xl" />

                <div className="relative flex min-h-[340px] flex-col items-center justify-center px-6 py-14 sm:min-h-[390px] sm:px-12">
                  <div className={`absolute right-5 top-5 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-bold tracking-widest sm:right-7 sm:top-7 sm:text-xs ${isFlipped ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-indigo-100 bg-indigo-50 text-indigo-700"}`}>
                    {isFlipped ? (
                      <>
                        <BookOpen className="h-3.5 w-3.5" />
                        ANSWER
                      </>
                    ) : (
                      <>
                        <Brain className="h-3.5 w-3.5" />
                        QUESTION
                      </>
                    )}
                  </div>

                  <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-100 text-indigo-600 shadow-sm ring-1 ring-indigo-100 transition duration-300 group-hover:scale-105">
                    {isFlipped ? (
                      <BookOpen className="h-7 w-7" />
                    ) : (
                      <Sparkles className="h-7 w-7" />
                    )}
                  </div>

                  <p className={`mb-4 text-xs font-bold uppercase tracking-[0.22em] ${isFlipped ? "text-emerald-700" : "text-indigo-600"}`}>
                    {isFlipped ? "Answer revealed" : "Think about it"}
                  </p>

                  <p className="max-w-2xl whitespace-pre-wrap break-words text-xl font-semibold leading-relaxed text-slate-800 sm:text-2xl">
                    {isFlipped ? currentCard.answer : currentCard.question}
                  </p>

                  <div className="mt-9 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-medium text-slate-500 shadow-sm transition group-hover:border-indigo-200 group-hover:text-indigo-700 sm:text-sm">
                    <RotateCcw className="h-4 w-4" />
                    Tap or press Enter to {isFlipped ? "see question" : "reveal answer"}
                  </div>
                </div>
              </button>
            </div>

            {/* Card navigation */}
            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => goToCard(currentIndex - 1)}
                aria-label="Previous flashcard"
                disabled={currentIndex === 0}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-600"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Previous</span>
              </button>

              <div className="flex flex-col items-center">
                <span className="text-sm font-bold tabular-nums text-slate-800">
                  {currentIndex + 1} <span className="font-medium text-slate-400">/</span> {cards.length}
                </span>
                <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                  Current card
                </span>
              </div>

              <button
                type="button"
                onClick={() => goToCard(currentIndex + 1)}
                aria-label="Next flashcard"
                disabled={currentIndex === cards.length - 1}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-600"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Study actions */}
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={handleMarkReviewed}
                disabled={completedCards.includes(currentIndex)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-0.5 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-emerald-600 disabled:shadow-none disabled:hover:translate-y-0"
              >
                <Check className="h-4 w-4" />
                {completedCards.includes(currentIndex)
                  ? "Reviewed"
                  : "Mark as reviewed"}
              </button>

              <button
                type="button"
                onClick={handleRestart}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
              >
                <RefreshCw className="h-4 w-4" />
                Restart session
              </button>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3.5 text-sm font-semibold text-violet-700 transition hover:border-violet-300 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                Generate new set
              </button>
            </div>

            {/* Completion state */}
            {completedCards.length === cards.length && (
              <div role="status" className="mt-8 overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 text-center shadow-sm sm:p-8">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <Trophy className="h-8 w-8" />
                </div>
                <h3 className="mt-4 text-xl font-bold text-emerald-900">
                  All flashcards reviewed!
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-emerald-700">
                  Great work! You have reviewed all {cards.length} flashcards
                  from this study set. Restart the session to revise again.
                </p>
                <button
                  type="button"
                  onClick={handleRestart}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-200 transition hover:bg-emerald-700"
                >
                  <RotateCcw className="h-4 w-4" />
                  Review again
                </button>
              </div>
            )}
          </section>
        )}

        {/* Initial empty state */}
        {!loadingDocuments && !documentsError && documents.length > 0 && !generating && cards.length === 0 && !error && (
          <section className="overflow-hidden rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm sm:py-20">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-50 to-violet-100 text-indigo-600 ring-1 ring-indigo-100">
              <Layers className="h-9 w-9" />
            </div>
            <div className="mx-auto mt-6 max-w-lg">
              <h2 className="text-xl font-bold text-slate-900">
                Ready to start learning?
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500 sm:text-base">
                Choose a processed document above and generate your
                first set of AI flashcards. Flip each card to reveal
                the answer and mark it reviewed as you go.
              </p>
            </div>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-700">
              <Sparkles className="h-4 w-4" />
              Your AI-powered revision space
            </div>
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

export default Flashcards;
