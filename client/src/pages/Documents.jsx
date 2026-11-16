
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  FileText,
  Upload,
  MessageSquare,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Sparkles,
  ShieldCheck,
  Files,
  X,
  FileUp,
} from "lucide-react";
import api from "../services/api";

function Documents() {
  const navigate = useNavigate();

  const [documents, setDocuments] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [documentsError, setDocumentsError] = useState("");
  const [success, setSuccess] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const cancelDeleteRef = useRef(null);
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);
  const deletingIdRef = useRef(null);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setDocumentsError("");

      const response = await api.get("/documents");
      const data = response.data;

      setDocuments(
        Array.isArray(data)
          ? data
          : Array.isArray(data.documents)
            ? data.documents
            : []
      );
    } catch (err) {
      setDocumentsError(
        err.response?.data?.message ||
          "Unable to load your documents. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(fetchDocuments, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!pendingDelete) return undefined;

    previousFocusRef.current = document.activeElement;
    cancelDeleteRef.current?.focus();

    const handleDialogKeyDown = (event) => {
      if (event.key === "Escape" && !deletingIdRef.current) {
        event.preventDefault();
        setPendingDelete(null);
      }

      if (event.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable?.length) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleDialogKeyDown);
    return () => {
      window.removeEventListener("keydown", handleDialogKeyDown);
      if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus();
    };
  }, [pendingDelete]);

  const handleUpload = async (event) => {
    event.preventDefault();

    if (!selectedFile) {
      setUploadError("Please select a PDF file first.");
      return;
    }

    if (
      selectedFile.type !== "application/pdf" ||
      !selectedFile.name.toLowerCase().endsWith(".pdf")
    ) {
      setUploadError("Only PDF files are supported.");
      return;
    }

    const formData = new FormData();
    formData.append("document", selectedFile);

    try {
      setUploading(true);
      setUploadError("");
      setSuccess("");

      await api.post("/documents/upload", formData);

      setSuccess("Your document was uploaded successfully.");
      setSelectedFile(null);
      event.target.reset();

      await fetchDocuments();
    } catch (err) {
      setUploadError(
        err.response?.data?.message ||
          "Document upload failed. Please try again."
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    const { documentId } = pendingDelete;

    try {
      deletingIdRef.current = documentId;
      setDeletingId(documentId);
      setDeleteError("");
      setSuccess("");

      await api.delete(`/documents/${documentId}`);

      setSuccess("Document deleted successfully.");
      setPendingDelete(null);
      await fetchDocuments();
    } catch (err) {
      setDeleteError(
        err.response?.data?.message ||
          "Failed to delete document. Please try again."
      );
      setPendingDelete(null);
    } finally {
      deletingIdRef.current = null;
      setDeletingId(null);
    }
  };

  const readyDocuments = documents.filter(
    (document) => document.status === "ready"
  );

  const processingDocuments = documents.filter(
    (document) =>
      document.status !== "ready" &&
      document.status !== "failed" &&
      document.status !== "deleting"
  );

  const deletingDocuments = documents.filter(
    (document) => document.status === "deleting"
  );

  const failedDocuments = documents.filter(
    (document) => document.status === "failed"
  );

  const getStatusStyle = (status) => {
    if (status === "ready") {
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    }

    if (status === "failed") {
      return "border-red-200 bg-red-50 text-red-700";
    }

    if (status === "deleting") {
      return "border-orange-200 bg-orange-50 text-orange-800";
    }

    return "border-amber-200 bg-amber-50 text-amber-700";
  };

  const getStatusLabel = (status) => {
    if (status === "ready") return "Ready for AI";
    if (status === "failed") return "Processing failed";
    if (status === "deleting") return "Deletion pending";
    return "Processing";
  };

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[#F8F7F4] text-slate-900 lg:min-h-screen">
      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
        {/* Page heading */}
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-violet-700">
              <Sparkles className="h-3.5 w-3.5" />
              Your knowledge library
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              My Documents
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
              Upload, organize, and explore your PDFs. Turn your documents
              into answers and insights with DocMind AI.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchDocuments}
            disabled={loading}
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh library
          </button>
        </div>

        {/* Overview banner */}
        <section className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-[#19194b] via-[#30247d] to-[#5032a9] p-6 text-white shadow-xl shadow-indigo-950/10 sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-28 h-80 w-80 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -right-5 -top-16 h-64 w-64 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -bottom-36 right-1/3 h-64 w-64 rounded-full bg-violet-400/10 blur-3xl" />

          <div className="relative z-10 flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
            <div className="max-w-xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-violet-100 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                AI-powered document management
              </div>

              <h2 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
                Your documents,
                <br className="hidden sm:block" /> smarter with AI.
              </h2>

              <p className="mt-3 max-w-lg text-sm leading-6 text-indigo-100/80 sm:text-base">
                Keep your PDFs in one place, ask questions, and discover
                useful information without searching through pages manually.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-medium text-indigo-100/90">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                  Personal workspace
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
                  <FileText className="h-3.5 w-3.5 text-violet-200" />
                  PDF support
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3 sm:min-w-[350px]">
              <div className="min-w-0 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-violet-200">
                  <Files className="h-5 w-5" />
                </div>
                <p className="text-2xl font-extrabold tabular-nums">
                  {documents.length}
                </p>
                <p className="mt-1 break-words text-xs font-medium text-indigo-100/70">
                  Total files
                </p>
              </div>
              <div className="min-w-0 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <p className="text-2xl font-extrabold tabular-nums">
                  {readyDocuments.length}
                </p>
                <p className="mt-1 break-words text-xs font-medium text-indigo-100/70">
                  AI ready
                </p>
              </div>

              <div className="min-w-0 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/15 text-amber-300">
                  <Loader2 className="h-5 w-5" />
                </div>
                <p className="text-2xl font-extrabold tabular-nums">
                  {processingDocuments.length}
                </p>
                <p className="mt-1 break-words text-xs font-medium text-indigo-100/70">
                  Processing
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Upload section */}
        <section className="mb-10">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Upload a document
              </h2>
              <p className="text-sm text-slate-500">
                Add a PDF to your personal AI workspace.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7">
            <form onSubmit={handleUpload}>
              <label
                htmlFor="document-file"
                className={`group flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-8 text-center transition duration-200 focus-within:outline-none focus-within:ring-2 focus-within:ring-violet-500 focus-within:ring-offset-2 ${
                  selectedFile
                    ? "border-violet-300 bg-violet-50/70"
                    : "border-slate-200 bg-slate-50/70 hover:border-violet-300 hover:bg-violet-50/50"
                }`}
              >
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-violet-600 shadow-md shadow-violet-100 transition group-hover:-translate-y-1 group-hover:shadow-lg">
                  {selectedFile ? (
                    <FileText className="h-7 w-7" />
                  ) : (
                    <FileUp className="h-7 w-7" />
                  )}
                </div>

                <span className="max-w-full break-all text-sm font-bold text-slate-800 sm:text-base">
                  {selectedFile
                    ? selectedFile.name
                    : "Choose a PDF file to upload"}
                </span>

                <span className="mt-2 text-sm text-slate-500">
                  {selectedFile
                    ? "Your file is selected and ready to upload."
                    : "Drag and drop is not required — click here to browse your files."}
                </span>

                <span className="mt-4 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500">
                  PDF format · Maximum size 10 MiB
                </span>

                <input
                  id="document-file"
                  type="file"
                  accept=".pdf,application/pdf"
                  className="sr-only"
                  onChange={(event) => {
                    setSelectedFile(event.target.files?.[0] || null);
                    setUploadError("");
                    setSuccess("");
                  }}
                />
              </label>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="submit"
                  disabled={!selectedFile || uploading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-200 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-violet-200 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-lg"
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {uploading ? "Uploading..." : "Upload document"}
                  {!uploading && <ArrowUpRight className="h-4 w-4" />}
                </button>

                {selectedFile && (
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                  >
                    <X className="h-4 w-4" />
                    Clear selection
                  </button>
                )}

                <p className="text-xs leading-5 text-slate-600 sm:ml-auto sm:text-right">
                  Your document will be processed before AI features become
                  available.
                </p>
              </div>
            </form>

            {/* Error and success messages */}
            {uploadError && (
              <div
                role="alert"
                className="mt-5 flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700"
              >
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <p className="leading-5">{uploadError}</p>
              </div>
            )}

            {success && (
              <div
                role="status"
                className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700"
              >
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                <p className="leading-5">{success}</p>
              </div>
            )}
          </div>
        </section>

        {/* Document library */}
        <section>
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <Files className="h-5 w-5 text-violet-600" />
                <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
                  Your library
                </h2>
              </div>
              <p className="text-sm text-slate-500">
                Manage your uploaded files and open them with AI.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
                {documents.length} total
              </span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                {readyDocuments.length} ready
              </span>
              {deletingDocuments.length > 0 && (
                <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-800">
                  {deletingDocuments.length} deletion pending
                </span>
              )}
              {failedDocuments.length > 0 && (
                <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">
                  {failedDocuments.length} failed
                </span>
              )}
            </div>
          </div>

          {deleteError && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="leading-5">{deleteError}</p>
            </div>
          )}

          {loading ? (
            <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
              <p className="text-sm font-semibold text-slate-700">
                Loading your documents
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Please wait a moment...
              </p>
            </div>
          ) : documentsError ? (
            <div role="alert" className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3 text-red-700">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <h3 className="font-bold">Your library could not be loaded</h3>
                    <p className="mt-1 text-sm leading-6">{documentsError}</p>
                  </div>
                </div>
                <button type="button" onClick={fetchDocuments} disabled={loading} className="inline-flex w-fit items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-50">
                  <RefreshCw className="h-4 w-4" />Try again
                </button>
              </div>
            </div>
          ) : documents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                <FileText className="h-8 w-8" />
              </div>

              <h3 className="text-lg font-bold text-slate-900">
                Your library is empty
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Upload your first PDF to get started. Once it has been
                processed, you can ask questions and explore its content
                using DocMind AI.
              </p>

              <button
                type="button"
                onClick={() =>
                  document.getElementById("document-file")?.click()
                }
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-violet-200 transition hover:bg-violet-700"
              >
                <Upload className="h-4 w-4" />
                Select your first PDF
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {documents.map((document) => {
                const isReady = document.status === "ready";
                const isDeleting = deletingId === document._id;
                const title =
                  document.title ||
                  document.originalName ||
                  "Untitled document";
                const fileName =
                  document.originalName || document.fileName || "";

                return (
                  <article
                    key={document._id}
                    className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-xl hover:shadow-slate-200/60 sm:p-6"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-violet-100 bg-violet-50 text-violet-600 transition group-hover:bg-violet-100">
                        <FileText className="h-6 w-6" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="break-words text-base font-bold leading-6 text-slate-900">
                              {title}
                            </h3>
                            <p className="mt-1 break-all text-xs leading-5 text-slate-600">
                              {fileName}
                            </p>
                          </div>

                          <span
                            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${getStatusStyle(
                              document.status
                            )}`}
                          >
                            {isReady ? (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            ) : document.status === "failed" ? (
                              <AlertCircle className="h-3.5 w-3.5" />
                            ) : (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            )}
                            {getStatusLabel(document.status)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="my-5 h-px bg-slate-100" />

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            isReady
                              ? "bg-emerald-500"
                              : document.status === "failed"
                                ? "bg-red-500"
                                : document.status === "deleting"
                                  ? "bg-orange-500"
                                  : "bg-amber-400"
                          }`}
                        />
                        {isReady
                          ? "Available for AI features"
                          : document.status === "failed"
                            ? "Upload did not finish. Remove this entry and upload the PDF again if needed."
                            : document.status === "deleting"
                              ? "Deletion did not finish. Retry to continue removal."
                            : "AI features unlock after processing"}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={!isReady}
                          onClick={() =>
                            navigate("/chat", {
                              state: { documentId: document._id },
                            })
                          }
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-3.5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none"
                        >
                          <MessageSquare className="h-4 w-4" />
                          Ask AI
                          {isReady && <ArrowUpRight className="h-3.5 w-3.5" />}
                        </button>

                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => setPendingDelete({ documentId: document._id, title })}
                          aria-label={`Delete ${title}`}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-100 px-3.5 py-2.5 text-xs font-bold text-red-600 transition hover:border-red-200 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isDeleting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          {isDeleting
                            ? "Deleting..."
                            : document.status === "deleting"
                              ? "Retry deletion"
                              : "Delete"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Bottom note */}
        <div className="mt-10 flex flex-col items-start justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white/70 px-5 py-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">
                Your personal document workspace
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Your library is connected to your DocMind AI account.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center gap-2 text-xs font-bold text-violet-700 transition hover:text-violet-900"
          >
            Back to dashboard
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <footer className="py-8 text-center text-xs text-slate-600">
          DocMind AI · Intelligent document workspace
        </footer>
      </main>

      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deletingId) {
              setPendingDelete(null);
            }
          }}
        >
          <section
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            aria-describedby="delete-dialog-description"
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <Trash2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 id="delete-dialog-title" className="text-lg font-bold text-slate-900">Delete document?</h2>
                <p id="delete-dialog-description" className="mt-1 break-words text-sm leading-6 text-slate-600">
                  “{pendingDelete.title}” will be removed from your document library.
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                ref={cancelDeleteRef}
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={Boolean(deletingId)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={Boolean(deletingId)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
              >
                {deletingId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {deletingId ? "Deleting..." : "Delete document"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default Documents;
