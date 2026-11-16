
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  FileText,
  Loader2,
  RotateCcw,
  Trophy,
  XCircle,
  Sparkles,
  Brain,
  ClipboardCheck,
  Target,
  GraduationCap,
  RefreshCw,
  AlertCircle,
  Lightbulb,
} from "lucide-react";
import api from "../services/api";

const Quiz = () => {
  const navigate = useNavigate();

  const [documents, setDocuments] = useState([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [documentsError, setDocumentsError] = useState("");

  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const fetchDocuments = useCallback(async () => {
    try {
      setDocumentsLoading(true);
      setDocumentsError("");

      const response = await api.get("/documents");
      const allDocuments = response.data.documents || [];
      const readyDocuments = allDocuments.filter(
        (document) => document.status === "ready"
      );

      setDocuments(readyDocuments);

      setSelectedDocumentId((currentId) =>
        currentId && readyDocuments.some((document) => document._id === currentId)
          ? currentId
          : readyDocuments[0]?._id || ""
      );
    } catch (err) {
      console.error("Failed to load documents:", err);
      setDocumentsError(
        err.response?.data?.message ||
          "Unable to load documents. Please try again."
      );
    } finally {
      setDocumentsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(fetchDocuments, 0);
    return () => window.clearTimeout(timer);
  }, [fetchDocuments]);

  const selectedDocument = documents.find(
    (document) => document._id === selectedDocumentId
  );

  const questions = quiz?.questions || [];
  const question = questions[currentQuestion];
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(answers).length;

  const score = questions.reduce((total, item, index) => {
    return total + (answers[index] === item.correctAnswer ? 1 : 0);
  }, 0);

  const resetQuiz = () => {
    setQuiz(null);
    setAnswers({});
    setCurrentQuestion(0);
    setSubmitted(false);
    setError("");
  };

  const handleDocumentChange = (event) => {
    setSelectedDocumentId(event.target.value);
    resetQuiz();
  };

  // Generate quiz using the existing backend endpoint
  const handleGenerateQuiz = async () => {
    if (!selectedDocumentId || generating) return;

    setGenerating(true);
    setError("");
    resetQuiz();

    try {
      const response = await api.post("/documents/quiz", {
        documentId: selectedDocumentId,
      });

      const generatedQuiz = response.data.quiz;

      if (
        !generatedQuiz ||
        !Array.isArray(generatedQuiz.questions) ||
        generatedQuiz.questions.length === 0
      ) {
        throw new Error("The server returned an empty quiz.");
      }

      setQuiz(generatedQuiz);
    } catch (err) {
      console.error("Quiz generation error:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to generate a quiz. Please try again."
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleAnswerSelect = (optionIndex) => {
    if (submitted || !question) return;

    setAnswers((previous) => ({
      ...previous,
      [currentQuestion]: optionIndex,
    }));
  };

  const handleNext = () => {
    if (currentQuestion < totalQuestions - 1) {
      setCurrentQuestion((previous) => previous + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion((previous) => previous - 1);
    }
  };

  const handleSubmitQuiz = () => {
    if (answeredCount !== totalQuestions) return;
    setSubmitted(true);
  };

  const handleRetake = () => {
    setAnswers({});
    setCurrentQuestion(0);
    setSubmitted(false);
  };

  const questionProgress =
    totalQuestions > 0
      ? ((currentQuestion + 1) / totalQuestions) * 100
      : 0;
  const answeredProgress =
    totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

  const getOptionClass = (optionIndex) => {
    const selected = answers[currentQuestion] === optionIndex;

    if (!submitted) {
      return selected
        ? "border-indigo-500 bg-indigo-50 text-indigo-800 ring-2 ring-indigo-100"
        : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50";
    }

    if (optionIndex === question.correctAnswer) {
      return "border-emerald-500 bg-emerald-50 text-emerald-800";
    }

    if (selected && optionIndex !== question.correctAnswer) {
      return "border-red-400 bg-red-50 text-red-800";
    }

    return "border-slate-200 bg-slate-50 text-slate-500";
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
                AI-powered learning
              </div>

              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Test your knowledge
                <br className="hidden sm:block" /> with AI-generated quizzes
              </h1>

              <p className="mt-3 max-w-xl text-sm leading-6 text-indigo-100 sm:text-base">
                Turn your PDF documents into interactive quizzes.
                Practice concepts, track your score, and review
                explanations to strengthen your understanding.
              </p>

              <div className="mt-6 flex flex-wrap gap-3 text-xs font-medium text-indigo-50 sm:text-sm">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2">
                  <Brain className="h-4 w-4" />
                  AI-generated questions
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2">
                  <Target className="h-4 w-4" />
                  Instant scoring
                </span>
              </div>
            </div>

            <div className="hidden shrink-0 items-center justify-center md:flex">
              <div className="relative flex h-36 w-36 items-center justify-center rounded-[2rem] border border-white/20 bg-white/10 shadow-2xl backdrop-blur-sm">
                <div className="absolute -right-3 -top-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-lg">
                  <Sparkles className="h-5 w-5" />
                </div>
                <GraduationCap
                  className="h-16 w-16 text-white"
                  strokeWidth={1.3}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Document selection */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">
                Create your quiz
              </h2>
              <p className="mt-1 text-sm leading-5 text-slate-500">
                Select a processed PDF document to generate
                questions based on its content.
              </p>
            </div>
          </div>

          <label
            htmlFor="quiz-document"
            className="mb-2 block text-sm font-semibold text-slate-700"
          >
            Choose a document
          </label>

          {documentsLoading ? (
            <div role="status" className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-4 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
              Loading your documents...
            </div>
          ) : documentsError ? (
            <div
              role="alert"
              className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between"
            >
              <p className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{documentsError}</p>
              <button type="button" onClick={fetchDocuments} disabled={documentsLoading || generating} className="inline-flex w-fit shrink-0 items-center gap-2 rounded-lg px-2 py-1 font-semibold text-red-800 underline underline-offset-2 disabled:opacity-50">
                <RefreshCw className={`h-4 w-4 ${documentsLoading ? "animate-spin" : ""}`} />
                Retry loading documents
              </button>
            </div>
          ) : documents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-6 text-center">
              <FileText className="mx-auto mb-3 h-9 w-9 text-slate-400" />
              <p className="text-sm font-semibold text-slate-800">
                No ready documents found
              </p>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">
                Upload and process a PDF before generating a quiz.
              </p>
              <button
                type="button"
                onClick={() => navigate("/documents")}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition hover:-translate-y-0.5 hover:bg-indigo-700"
              >
                <FileText className="h-4 w-4" />
                Go to Documents
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <FileText className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  id="quiz-document"
                  value={selectedDocumentId}
                  onChange={handleDocumentChange}
                  disabled={generating}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {documents.map((document) => (
                    <option key={document._id} value={document._id}>
                      {document.title ||
                        document.originalName ||
                        "Untitled document"}
                    </option>
                  ))}
                </select>
              </div>

              <p className="mt-2 text-xs text-slate-500">
                Only processed, ready documents are available.
              </p>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-2 text-xs text-slate-500">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  <span className="min-w-0 flex-1 break-words">
                    {selectedDocument?.title ||
                      selectedDocument?.originalName ||
                      "Document selected"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateQuiz}
                  disabled={!selectedDocumentId || generating}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-indigo-300 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating quiz...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      {quiz ? "Generate New Quiz" : "Generate Quiz"}
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </section>

        {/* Error message */}
        {error && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Generating state */}
        {generating && (
          <section role="status" aria-live="polite" className="rounded-3xl border border-indigo-100 bg-white px-6 py-16 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
            <h2 className="mt-5 text-xl font-bold text-slate-900">
              Creating your quiz
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              DocMind AI is analyzing your document and preparing
              questions. This may take a moment.
            </p>
            <div className="mx-auto mt-6 h-1.5 max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
            </div>
          </section>
        )}

        {/* Quiz results */}
        {quiz && !generating && submitted && (
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="bg-gradient-to-br from-indigo-50 via-white to-violet-50 px-5 py-8 text-center sm:px-8">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50">
                <Trophy className="h-8 w-8 text-amber-500" />
              </div>

              <div className="mt-4">
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Quiz completed
                </div>
                <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                  Your results are ready!
                </h2>
                <p className="mt-2 break-words text-sm text-slate-500">
                  Here's your performance for{" "}
                  {selectedDocument?.title || "the document"}.
                </p>
              </div>

              <div className="mx-auto mt-6 grid max-w-lg grid-cols-2 gap-3">
                <div className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                    Your score
                  </p>
                  <p className="mt-2 text-4xl font-bold text-slate-900">
                    {score}
                    <span className="text-xl text-slate-600">
                      {" "}/ {totalQuestions}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {score} correct · {totalQuestions - score} to review
                  </p>
                </div>
                <div className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
                    Accuracy
                  </p>
                  <p className="mt-2 text-4xl font-bold text-slate-900">
                    {totalQuestions
                      ? Math.round((score / totalQuestions) * 100)
                      : 0}
                    <span className="text-xl text-slate-600">%</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-8">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <ClipboardCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">
                    Answer review
                  </h3>
                  <p className="text-xs text-slate-500">
                    Review your answers and explanations.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {questions.map((item, index) => {
                  const isCorrect =
                    answers[index] === item.correctAnswer;

                  return (
                    <div
                      key={index}
                      className="rounded-2xl border border-slate-200 p-4 transition hover:border-indigo-100 sm:p-5"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                            isCorrect
                              ? "bg-emerald-100 text-emerald-600"
                              : "bg-red-100 text-red-500"
                          }`}
                        >
                          {isCorrect ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                              Question {index + 1}
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                isCorrect
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-red-50 text-red-700"
                              }`}
                            >
                              {isCorrect ? "Correct" : "Incorrect"}
                            </span>
                          </div>

                          <p className="text-sm font-semibold leading-6 text-slate-900">
                            {item.question}
                          </p>

                          <div className="mt-3 space-y-2 text-sm">
                            <p className="text-slate-600">
                              <span className="font-semibold text-slate-700">
                                Your answer:{" "}
                              </span>
                              <span
                                className={
                                  isCorrect
                                    ? "font-medium text-emerald-700"
                                    : "font-medium text-red-600"
                                }
                              >
                                {Number.isInteger(answers[index])
                                  ? item.options[answers[index]]
                                  : "Not answered"}
                              </span>
                            </p>

                            <p className="text-slate-600">
                              <span className="font-semibold text-slate-700">
                                Correct answer:{" "}
                              </span>
                              <span className="font-medium text-emerald-700">
                                {item.options[item.correctAnswer]}
                              </span>
                            </p>
                          </div>

                          {item.explanation && (
                            <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
                              <div className="mb-1.5 flex items-center gap-2 text-xs font-bold text-indigo-700">
                                <Lightbulb className="h-4 w-4" />
                                Explanation
                              </div>
                              <p className="text-sm leading-6 text-slate-600">
                                {item.explanation}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleRetake}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  <RotateCcw className="h-4 w-4" />
                  Retake Quiz
                </button>

                <button
                  type="button"
                  onClick={handleGenerateQuiz}
                  disabled={generating}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-0.5 hover:bg-indigo-700 disabled:opacity-50"
                >
                  <RefreshCw className="h-4 w-4" />
                  Generate Another Quiz
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Active quiz */}
        {quiz && !generating && !submitted && question && (
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-50/70 via-white to-violet-50/50 p-5 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-200">
                    <Brain className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                      {quiz.title || "Document Knowledge Quiz"}
                    </p>
                    <h2 className="mt-1 text-lg font-bold text-slate-900">
                      Question {currentQuestion + 1} of {totalQuestions}
                    </h2>
                  </div>
                </div>

                <div className="rounded-full border border-indigo-100 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700">
                  {answeredCount} / {totalQuestions} answered
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500">
                    <span>Question position</span>
                    <span>{currentQuestion + 1} of {totalQuestions}</span>
                  </div>
                  <div role="progressbar" aria-valuenow={currentQuestion + 1} aria-valuemin={1} aria-valuemax={totalQuestions} aria-label="Question position" className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-indigo-500 transition-all duration-300" style={{ width: `${questionProgress}%` }} />
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500">
                    <span>Questions answered</span>
                    <span>{answeredCount} of {totalQuestions}</span>
                  </div>
                  <div role="progressbar" aria-valuenow={answeredCount} aria-valuemin={0} aria-valuemax={totalQuestions} aria-label="Questions answered" className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-500 transition-all duration-300" style={{ width: `${answeredProgress}%` }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-8">
              <div className="mb-6 flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 sm:p-5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm font-bold text-indigo-600">
                  {currentQuestion + 1}
                </span>
                <h3 className="pt-1 text-lg font-semibold leading-7 text-slate-900 sm:text-xl">
                  {question.question}
                </h3>
              </div>

              <div className="space-y-3">
                {question.options.map((option, optionIndex) => {
                  const selected =
                    answers[currentQuestion] === optionIndex;

                  return (
                    <button
                      key={`${currentQuestion}-${optionIndex}`}
                      type="button"
                      onClick={() => handleAnswerSelect(optionIndex)}
                      aria-pressed={selected}
                      className={`group flex w-full items-center gap-3 rounded-2xl border p-4 text-left text-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 sm:p-5 ${getOptionClass(
                        optionIndex
                      )}`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-xs font-bold transition ${
                          selected
                            ? "border-indigo-600 bg-indigo-600 text-white"
                            : "border-slate-200 bg-slate-50 text-slate-600 group-hover:border-indigo-300 group-hover:text-indigo-600"
                        }`}
                      >
                        {String.fromCharCode(65 + optionIndex)}
                      </span>

                      <span className="flex-1 font-medium leading-6">
                        {option}
                      </span>

                      {selected && (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-indigo-600" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Navigation */}
              <div className="mt-8 flex flex-col-reverse justify-between gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handlePrevious}
                  disabled={currentQuestion === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>

                {currentQuestion < totalQuestions - 1 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-0.5 hover:bg-indigo-700"
                  >
                    Next Question
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmitQuiz}
                    disabled={answeredCount !== totalQuestions}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition hover:-translate-y-0.5 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                  >
                    Submit Quiz
                    <CheckCircle2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              {answeredCount !== totalQuestions && (
                <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-slate-500">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Answer all {totalQuestions} questions to submit the quiz.
                </p>
              )}
            </div>
          </section>
        )}

        {/* Initial state */}
        {!quiz &&
          !generating &&
          !error &&
          !documentsLoading &&
          documents.length > 0 && (
            <section className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm sm:py-16">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-100 text-indigo-600 ring-1 ring-indigo-100">
                <GraduationCap className="h-8 w-8" />
              </div>
              <div className="mx-auto mt-5 max-w-lg">
                <h2 className="text-xl font-bold text-slate-900">
                  Ready to test your knowledge?
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Choose a document above and generate your first
                  AI-powered quiz. Your score and explanations will
                  appear after submission.
                </p>
              </div>
              <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-700">
                <Sparkles className="h-4 w-4" />
                Select a document to get started
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
};

export default Quiz;
