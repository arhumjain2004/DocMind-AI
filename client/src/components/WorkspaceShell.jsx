import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Bot,
  ClipboardList,
  Files,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Menu,
  MessageSquareText,
  X,
  Layers,
} from "lucide-react";

const workspaceRoutes = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/documents", label: "Documents", icon: Files },
  { to: "/chat", label: "AI Chat", icon: MessageSquareText },
  { to: "/insights", label: "Insights", icon: Lightbulb },
  { to: "/quiz", label: "Quiz", icon: ClipboardList },
  { to: "/flashcards", label: "Flashcards", icon: Layers },
];

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

function WorkspaceShell({ children, fullHeight = false }) {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuToggleRef = useRef(null);
  const user = getStoredUser();
  const userName = user?.name || "Your workspace";

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;

      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          '[role="dialog"], [role="alertdialog"], dialog[open], input, textarea, select, [contenteditable="true"]'
        )
      ) {
        return;
      }

      setMobileMenuOpen(false);
      mobileMenuToggleRef.current?.focus();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setMobileMenuOpen(false);
    navigate("/login");
  };

  const navLinkClass = ({ isActive }) =>
    `flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
      isActive
        ? "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    }`;

  const renderLinks = (closeMenu = false) =>
    workspaceRoutes.map(({ to, label, icon: Icon }) => (
      <NavLink
        key={to}
        to={to}
        end={to === "/dashboard"}
        className={navLinkClass}
        onClick={closeMenu ? () => setMobileMenuOpen(false) : undefined}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </NavLink>
    ));

  const renderAccountSection = () => (
    <div className="border-t border-slate-200 p-4">
      <div className="mb-3 flex min-w-0 items-center gap-3 px-1">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700"
          aria-hidden="true"
        >
          {userName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">{userName}</p>
          <p className="text-xs text-slate-500">Personal workspace</p>
        </div>
      </div>
      <button
        type="button"
        onClick={handleLogout}
        className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        aria-label="Log out"
      >
        <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
        <span>Log out</span>
      </button>
    </div>
  );

  return (
    <div
      className={`overflow-x-clip bg-[#F8F7F4] text-slate-900 ${
        fullHeight ? "h-dvh overflow-hidden" : "min-h-screen"
      }`}
    >
      <a
        href="#workspace-page-content"
        className="sr-only z-50 rounded-md bg-white px-4 py-2 text-sm font-semibold text-indigo-700 shadow focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:ring-2 focus:ring-indigo-500"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="border-b border-slate-100 px-5 py-5">
          <NavLink
            to="/dashboard"
            end
            aria-label="DocMind AI dashboard"
            className="flex min-h-11 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <Bot className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-base font-bold tracking-tight text-slate-900">
                DocMind <span className="text-indigo-600">AI</span>
              </span>
              <span className="block text-xs text-slate-500">Document workspace</span>
            </span>
          </NavLink>
        </div>

        <nav aria-label="Workspace navigation" className="flex-1 space-y-1 overflow-y-auto p-4">
          {renderLinks()}
        </nav>

        {renderAccountSection()}
      </aside>

      <div
        className={`min-w-0 lg:ml-64 ${
          fullHeight ? "flex h-full min-h-0 flex-col" : "min-h-screen"
        }`}
      >
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="relative flex min-h-10 items-center justify-between gap-3">
            <NavLink
              to="/dashboard"
              end
              aria-label="DocMind AI dashboard"
              className="flex min-h-10 min-w-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
                <Bot className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="truncate text-sm font-bold text-slate-900">
                DocMind <span className="text-indigo-600">AI</span>
              </span>
            </NavLink>

            <button
              ref={mobileMenuToggleRef}
              type="button"
              aria-label={mobileMenuOpen ? "Close workspace menu" : "Open workspace menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="workspace-mobile-menu"
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              {mobileMenuOpen ? (
                <X className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Menu className="h-4 w-4" aria-hidden="true" />
              )}
              <span className="sr-only">Menu</span>
            </button>

            {mobileMenuOpen && (
              <div
                id="workspace-mobile-menu"
                className="absolute left-0 right-0 top-full z-40 mt-3 max-h-[calc(100dvh-4.5rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-lg"
              >
                <nav
                  aria-label="Workspace navigation"
                  className="grid grid-cols-2 gap-1 p-3"
                >
                  {renderLinks(true)}
                </nav>
                {renderAccountSection()}
              </div>
            )}
          </div>
        </header>

        <div
          id="workspace-page-content"
          tabIndex="-1"
          className={`min-w-0 ${fullHeight ? "min-h-0 flex-1 overflow-hidden" : ""}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export default WorkspaceShell;
