
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Bot,
  FileText,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  User,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  BookOpen,
  ShieldCheck,
} from "lucide-react";
import api from "../services/api";

const suggestedQuestions = [
  "Summarize this document",
  "What are the main topics?",
  "Explain the key concepts",
  "Give me the important points",
];

const NO_EVIDENCE_ANSWERS = new Set([
  "I couldn't find relevant information in this document.",
  "I couldn't find this information in the provided document.",
]);

const getRequestErrorMessage = (error, fallback) => {
  const backendMessage = error?.response?.data?.message;
  if (typeof backendMessage === "string" && backendMessage.trim()) {
    return backendMessage;
  }

  if (!error?.response && error?.isAxiosError === true) {
    return "Unable to connect to the server. Check your connection and make sure the backend is running, then try again.";
  }

  return fallback;
};

const Chat = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [documents, setDocuments] = useState([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState(
    location.state?.documentId || ""
  );
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [documentsError, setDocumentsError] = useState("");

  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);
  const [expandedSources, setExpandedSources] = useState({});
  const [loading, setLoading] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const conversationRef = useRef(null);
  const shouldFollowConversationRef = useRef(true);
  const chatRequestInFlightRef = useRef(false);

  const selectedDocument = documents.find(
    (doc) => doc._id === selectedDocumentId
  );

  const busy = loading || summarizing;

  useEffect(() => {
    const conversation = conversationRef.current;
    if (!conversation || !shouldFollowConversationRef.current) return undefined;

    const frame = window.requestAnimationFrame(() => {
      conversation.scrollTop = conversation.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, busy]);

  // Fetch the user's ready documents
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setDocumentsLoading(true);
        setDocumentsError("");

        const response = await api.get("/documents");
        const allDocuments = response.data.documents || [];
        const readyDocuments = allDocuments.filter(
          (doc) => doc.status === "ready"
        );

        setDocuments(readyDocuments);

        const requestedDocumentId = location.state?.documentId;
        const requestedDocumentExists = readyDocuments.some(
          (doc) => doc._id === requestedDocumentId
        );

        if (requestedDocumentExists) {
          setSelectedDocumentId(requestedDocumentId);
        } else if (readyDocuments.length > 0) {
          setSelectedDocumentId(readyDocuments[0]._id);
        } else {
          setSelectedDocumentId("");
        }
      } catch (error) {
        console.error("Error fetching documents:", error);
        setDocumentsError(
          error.response?.data?.message ||
            "Unable to load your documents. Please try again."
        );
      } finally {
        setDocumentsLoading(false);
      }
    };

    fetchDocuments();
  }, [location.state?.documentId]);

  // Clear conversation when changing documents
  const handleDocumentChange = (event) => {
    setSelectedDocumentId(event.target.value);
    setMessages([]);
    setExpandedSources({});
    setQuery("");
  };

  // Start a fresh conversation
  const handleNewChat = () => {
    shouldFollowConversationRef.current = true;
    setMessages([]);
    setExpandedSources({});
    setQuery("");
  };

  // Ask or retry a question using the same document-specific RAG endpoint.
  const submitQuestion = async (userQuery, documentId, retryMessageIndex = null) => {
    if (!userQuery || !documentId || busy || chatRequestInFlightRef.current) {
      return;
    }

    chatRequestInFlightRef.current = true;
    shouldFollowConversationRef.current = true;

    if (retryMessageIndex === null) {
      setMessages((previous) => [
        ...previous,
        {
          role: "user",
          content: userQuery,
        },
      ]);
      setQuery("");
    } else {
      setMessages((previous) => previous.map((message, index) =>
        index === retryMessageIndex
          ? { ...message, isRetrying: true }
          : message
      ));
    }

    setLoading(true);

    try {
      const response = await api.post("/documents/ask", {
        query: userQuery,
        documentId,
      });

      const answer = response.data.answer || "I couldn't generate an answer for this question.";
      const assistantMessage = {
        role: "assistant",
        content: answer,
        sources: response.data.sources || [],
        noEvidence: NO_EVIDENCE_ANSWERS.has(answer.trim()),
      };

      setMessages((previous) => retryMessageIndex === null
        ? [...previous, assistantMessage]
        : previous.map((message, index) => index === retryMessageIndex
          ? assistantMessage
          : message
        )
      );
    } catch (error) {
      console.error("Chat request error:", error);

      const errorMessage = {
          role: "assistant",
          content: getRequestErrorMessage(
            error,
            "Sorry, I couldn't process your question. Please try again."
          ),
          sources: [],
          isError: true,
          retryQuery: userQuery,
          retryDocumentId: documentId,
          isRetrying: false,
      };

      setMessages((previous) => retryMessageIndex === null
        ? [...previous, errorMessage]
        : previous.map((message, index) => index === retryMessageIndex
          ? errorMessage
          : message
        )
      );
    } finally {
      chatRequestInFlightRef.current = false;
      setLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await submitQuestion(query.trim(), selectedDocumentId);
  };

  const handleRetryQuestion = (messageIndex, message) => {
    if (message.retryDocumentId !== selectedDocumentId) return;
    return submitQuestion(
      message.retryQuery,
      message.retryDocumentId,
      messageIndex
    );
  };

  // Summarize the selected document
  const handleSummarize = async () => {
    if (
      !selectedDocumentId ||
      busy ||
      documentsLoading
    ) {
      return;
    }

    shouldFollowConversationRef.current = true;

    setMessages((previous) => [
      ...previous,
      {
        role: "user",
        content: "Summarize this document",
      },
    ]);

    setSummarizing(true);

    try {
      const response = await api.post("/documents/summarize", {
        documentId: selectedDocumentId,
      });

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content:
            response.data.summary ||
            "No summary was returned for this document.",
          sources: [],
        },
      ]);
    } catch (error) {
      console.error("Summarization error:", error);

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: getRequestErrorMessage(
            error,
            "Unable to summarize this document. Please try again."
          ),
          sources: [],
          isError: true,
        },
      ]);
    } finally {
      setSummarizing(false);
    }
  };

  // Handle suggested questions
  const handleSuggestion = (suggestion) => {
    if (!selectedDocumentId || busy || documentsLoading) {
      return;
    }

    if (suggestion === "Summarize this document") {
      handleSummarize();
      return;
    }

    setQuery(suggestion);
  };

  const handleRetryDocuments = async () => {
    try {
      setDocumentsLoading(true);
      setDocumentsError("");

      const response = await api.get("/documents");
      const allDocuments = response.data.documents || [];
      const readyDocuments = allDocuments.filter(
        (doc) => doc.status === "ready"
      );

      setDocuments(readyDocuments);

      if (!readyDocuments.some((doc) => doc._id === selectedDocumentId)) {
        setSelectedDocumentId(readyDocuments[0]?._id || "");
      }
    } catch (error) {
      setDocumentsError(
        error.response?.data?.message ||
          "Unable to load your documents. Please try again."
      );
    } finally {
      setDocumentsLoading(false);
    }
  };

  const formatSourceScore = (score) => {
    if (typeof score !== "number") return null;
    return score.toFixed(3);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F8F7F4] text-slate-900">
      <header className="z-20 flex shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 py-2 backdrop-blur-xl [@media(max-height:700px)]:py-1.5 sm:px-6 sm:py-2.5">
        <h1 className="text-sm font-bold text-slate-900 sm:text-base">AI Chat</h1>
        <button
          type="button"
          onClick={handleNewChat}
          disabled={messages.length === 0 || busy}
          className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 sm:px-4 sm:text-sm"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>New chat</span>
        </button>
      </header>

      {/* Document selector */}
      <section className="z-10 shrink-0 border-b border-slate-200/70 bg-white/70 px-4 py-2 [@media(max-height:700px)]:py-1.5 sm:px-6 sm:py-3">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <FileText className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <label
                htmlFor="document-select"
                className="mb-1 block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500"
              >
                Chat with document
              </label>

              {documentsLoading ? (
                <div className="flex items-center gap-2 py-1 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
                  Loading your documents...
                </div>
              ) : documentsError ? (
                <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{documentsError}</span>
                  <button
                    type="button"
                    onClick={handleRetryDocuments}
                    className="font-bold text-violet-700 hover:underline"
                  >
                    Retry
                  </button>
                </div>
              ) : documents.length === 0 ? (
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                  <span>No ready documents available.</span>
                  <button
                    type="button"
                    onClick={() => navigate("/documents")}
                    className="font-bold text-violet-700 hover:underline"
                  >
                    Upload a PDF
                  </button>
                </div>
              ) : (
                <select
                  id="document-select"
                  value={selectedDocumentId}
                  onChange={handleDocumentChange}
                  disabled={busy}
                  className="w-full max-w-xl cursor-pointer appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  {documents.map((doc) => (
                    <option key={doc._id} value={doc._id}>
                      {doc.title || doc.originalName || "Untitled document"}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {selectedDocument && (
            <div className="flex shrink-0 items-center gap-2 self-start rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 sm:self-center">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-[11px] font-bold text-emerald-700">
                AI ready
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Chat area */}
      <main
        ref={conversationRef}
        onScroll={(event) => {
          const element = event.currentTarget;
          shouldFollowConversationRef.current =
            element.scrollHeight - element.scrollTop - element.clientHeight < 96;
        }}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-6 sm:py-5 [@media(max-height:700px)]:py-2"
      >
        <div className="mx-auto flex min-h-full max-w-5xl flex-col">
          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
              {/* Welcome illustration */}
              <div className="relative mb-6">
                <div className="flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-xl shadow-violet-200">
                  <Bot className="h-10 w-10" />
                </div>
                <div className="absolute -right-3 -top-3 flex h-9 w-9 items-center justify-center rounded-xl border border-violet-100 bg-white text-violet-600 shadow-md">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="absolute -bottom-2 -left-3 flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-100 bg-white text-emerald-600 shadow-md">
                  <FileText className="h-4 w-4" />
                </div>
              </div>

              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-violet-700">
                <Sparkles className="h-3.5 w-3.5" />
                AI document assistant
              </div>

              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                Ask your documents anything.
              </h2>

              <p className="mt-3 max-w-lg text-sm leading-6 text-slate-500 sm:text-base">
                Get clear answers from your PDFs. DocMind AI retrieves
                relevant information and provides source references to
                help you explore your documents.
              </p>

              {!selectedDocumentId && !documentsLoading && !documentsError && (
                <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
                  <AlertCircle className="h-5 w-5" />
                  <p className="font-semibold">
                    Select or upload a ready document to get started.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate("/documents")}
                    className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-violet-700"
                  >
                    Go to Documents
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Suggested prompts */}
              <div className="mt-8 w-full max-w-2xl">
                <div className="mb-3 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
                  <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                  Try asking
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {suggestedQuestions.map((suggestion, index) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => handleSuggestion(suggestion)}
                      disabled={
                        !selectedDocumentId ||
                        busy ||
                        documentsLoading
                      }
                      className="group flex min-h-[66px] items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-violet-200 hover:bg-violet-50/50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 transition group-hover:bg-violet-100">
                        {index === 0 ? (
                          <BookOpen className="h-4 w-4" />
                        ) : (
                          <MessageSquare className="h-4 w-4" />
                        )}
                      </div>

                      <span className="flex-1 text-sm font-semibold leading-5 text-slate-700 group-hover:text-violet-800">
                        {suggestion}
                      </span>

                      <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-violet-600" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-7 flex flex-wrap items-center justify-center gap-2 text-[11px] font-medium text-slate-600">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                  Personal document context
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5">
                  <FileText className="h-3.5 w-3.5 text-violet-500" />
                  Source-backed answers
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-5 pb-4 sm:space-y-6 sm:pb-5" role="log" aria-label="Chat conversation" aria-live="polite" aria-relevant="additions">
              <div className="mb-2 flex items-center gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-violet-600">
                    Conversation
                  </p>
                  <p className="mt-1 break-words text-xs text-slate-600">
                    {selectedDocument?.title ||
                      selectedDocument?.originalName ||
                      "Selected document"}
                  </p>
                </div>

              </div>

              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`flex items-start gap-3 ${
                    message.role === "user"
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-100">
                      <Bot className="h-5 w-5" />
                    </div>
                  )}

                  <div
                    className={`min-w-0 max-w-[88%] sm:max-w-[78%] ${
                      message.role === "user" ? "order-first" : ""
                    }`}
                  >
                    <div
                      className={`mb-1.5 flex items-center gap-2 text-[11px] font-bold ${
                        message.role === "user"
                          ? "justify-end text-slate-600"
                          : "text-slate-500"
                      }`}
                    >
                      {message.role === "user" ? "You" : "DocMind AI"}
                      {message.role === "assistant" && (
                        message.noEvidence ? (
                          <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                            <AlertCircle className="h-3 w-3" aria-hidden="true" />
                            No evidence found
                          </span>
                        ) : !message.isError ? (
                          <span className="inline-flex items-center gap-1 font-medium text-emerald-600">
                            <CheckCircle2 className="h-3 w-3" />
                            Response
                          </span>
                        ) : null
                      )}
                    </div>

                    <div
                      className={`whitespace-pre-wrap break-words rounded-2xl px-4 py-3.5 text-sm leading-7 shadow-sm ${
                        message.role === "user"
                          ? "rounded-tr-md bg-gradient-to-br from-violet-600 to-indigo-600 text-white"
                          : message.isError
                            ? "rounded-tl-md border border-red-200 bg-red-50 text-red-700"
                            : message.noEvidence
                              ? "rounded-tl-md border border-amber-200 bg-amber-50 text-amber-900"
                            : "rounded-tl-md border border-slate-200/80 bg-white text-slate-700"
                      }`}
                    >
                      {message.content}
                    </div>

                    {message.isError && message.retryQuery && (
                      <button
                        type="button"
                        onClick={() => handleRetryQuestion(index, message)}
                        disabled={busy || message.isRetrying || message.retryDocumentId !== selectedDocumentId}
                        aria-label={`Retry question: ${message.retryQuery}`}
                        className="mt-2 inline-flex min-h-10 items-center rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700 shadow-sm hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {message.isRetrying ? "Retrying…" : "Retry"}
                      </button>
                    )}

                    {/* Source citations */}
                    {message.role === "assistant" &&
                      message.sources?.length > 0 && (
                        <div className="mt-3">
                          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-600">
                            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                              <FileText className="h-3.5 w-3.5" />
                            </div>
                            Retrieved sources ({message.sources.length})
                          </div>

                          <div className="space-y-2">
                            {message.sources.map((source, sourceIndex) => {
                              const snippet = source.snippet || "";
                              const sourceKey = `${index}-${
                                source.chunkId ||
                                `${source.documentId || "source"}-${sourceIndex}`
                              }`;
                              const isExpanded = Boolean(
                                expandedSources[sourceKey]
                              );
                              const preview =
                                snippet.length > 400
                                  ? `${snippet.slice(0, 400)}...`
                                  : snippet;
                              const excerpt = isExpanded ? snippet : preview;
                              const canExpand = snippet.length > 400;
                              const score = formatSourceScore(source.score);

                              return (
                                <div
                                  key={
                                    source.chunkId ||
                                    `${source.documentId || "source"}-${sourceIndex}`
                                  }
                                  className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm"
                                >
                                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                    <span className="inline-flex items-center gap-2 text-xs font-bold text-slate-700">
                                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                                        <FileText className="h-3.5 w-3.5" />
                                      </span>
                                      Source {sourceIndex + 1}
                                      {source.pageNumber != null &&
                                        ` · Page ${source.pageNumber}`}
                                    </span>

                                    {score && (
                                      <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700">
                                        Score: {score}
                                      </span>
                                    )}
                                  </div>

                                  {excerpt ? (
                                    <p className="whitespace-pre-wrap break-words text-xs leading-5 text-slate-600">
                                      {excerpt}
                                    </p>
                                  ) : (
                                    <p className="text-xs text-slate-600">
                                      Source excerpt unavailable.
                                    </p>
                                  )}
                                  {canExpand && (
                                    <button
                                      type="button"
                                      aria-expanded={isExpanded}
                                      aria-label={`${isExpanded ? "Show less" : "Expand"} excerpt for source ${sourceIndex + 1}`}
                                      onClick={() =>
                                        setExpandedSources((previous) => ({
                                          ...previous,
                                          [sourceKey]: !previous[sourceKey],
                                        }))
                                      }
                                      className="mt-2 inline-flex min-h-11 items-center rounded px-2 text-xs font-semibold text-violet-700 underline decoration-violet-300 underline-offset-2 hover:text-violet-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                                    >
                                      {isExpanded ? "Show less" : "Expand"}
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                  </div>

                  {message.role === "user" && (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-600">
                      <User className="h-5 w-5" />
                    </div>
                  )}
                </div>
              ))}

              {/* AI response loading state */}
              {busy && (
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white">
                    <Bot className="h-5 w-5" />
                  </div>

                  <div className="rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
                      {summarizing
                        ? "Analyzing and summarizing your document..."
                        : "Searching your document and generating an answer..."}
                    </div>
                    <div className="mt-3 flex gap-1">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400 [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-500 [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Message composer */}
      <footer className="z-10 shrink-0 border-t border-slate-200/80 bg-white/95 px-4 pb-2 pt-2 backdrop-blur-xl [@media(max-height:700px)]:pb-1.5 [@media(max-height:700px)]:pt-1.5 sm:px-6 sm:pb-4 sm:pt-3">
        <div className="mx-auto max-w-5xl">
          <form
            onSubmit={handleSubmit}
            className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 shadow-sm transition focus-within:border-violet-300 focus-within:ring-4 focus-within:ring-violet-50 sm:gap-3 sm:p-2.5"
          >
            <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600 sm:flex">
              <MessageSquare className="h-5 w-5" />
            </div>

            <input
              aria-label="Ask a question about the selected document"
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              disabled={
                !selectedDocumentId ||
                busy ||
                documentsLoading ||
                Boolean(documentsError)
              }
              placeholder={
                selectedDocumentId
                  ? "Ask anything about your document..."
                  : "Select a ready document to start chatting..."
              }
              className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-500 disabled:cursor-not-allowed"
            />

            <button
              type="submit"
              aria-label={loading ? "Thinking" : "Send message"}
              disabled={
                !query.trim() ||
                !selectedDocumentId ||
                busy ||
                documentsLoading ||
                Boolean(documentsError)
              }
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-md shadow-violet-200 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-violet-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 sm:px-5"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {loading ? "Thinking..." : "Send"}
              </span>
            </button>
          </form>

          <div className="mt-1 flex flex-col items-center justify-between gap-1 text-[10px] text-slate-600 [@media(max-height:620px)]:hidden sm:flex-row sm:text-xs">
            <p className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              Answers are based on your selected document.
            </p>
            <p>Verify important details using the source excerpts.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Chat;
