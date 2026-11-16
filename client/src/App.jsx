
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Documents from "./pages/Documents";
import Chat from "./pages/Chat";
import Insights from "./pages/Insights";
import Quiz from "./pages/Quiz";
import Flashcards from "./pages/Flashcards";

import ProtectedRoute from "./components/ProtectedRoute";
import WorkspaceShell from "./components/WorkspaceShell";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Redirect root to dashboard */}
        <Route
          path="/"
          element={<Navigate to="/dashboard" replace />}
        />

        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <WorkspaceShell>
                <Dashboard />
              </WorkspaceShell>
            </ProtectedRoute>
          }
        />

        <Route
          path="/documents"
          element={
            <ProtectedRoute>
              <WorkspaceShell>
                <Documents />
              </WorkspaceShell>
            </ProtectedRoute>
          }
        />

        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <WorkspaceShell fullHeight>
                <Chat />
              </WorkspaceShell>
            </ProtectedRoute>
          }
        />

        <Route
          path="/insights"
          element={
            <ProtectedRoute>
              <WorkspaceShell>
                <Insights />
              </WorkspaceShell>
            </ProtectedRoute>
          }
        />

        <Route
          path="/quiz"
          element={
            <ProtectedRoute>
              <WorkspaceShell>
                <Quiz />
              </WorkspaceShell>
            </ProtectedRoute>
          }
        />

        <Route
          path="/flashcards"
          element={
            <ProtectedRoute>
              <WorkspaceShell>
                <Flashcards />
              </WorkspaceShell>
            </ProtectedRoute>
          }
        />

        {/* Fallback for unknown routes */}
        <Route
          path="*"
          element={<Navigate to="/dashboard" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
