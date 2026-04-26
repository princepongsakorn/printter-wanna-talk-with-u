import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "./pages/Login";
import { FriendsPage } from "./pages/Friends";
import { ChatPage } from "./pages/Chat";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { useAuth } from "./contexts/AuthContext";
import { useMessageNotifications } from "./hooks/useMessageNotifications";

export default function App() {
  const { user } = useAuth();
  // Global notification listener. Hook is route-aware and no-ops when
  // user is null, so it's safe to mount here.
  useMessageNotifications(user);

  return (
    <div className="h-full max-w-2xl mx-auto bg-white dark:bg-slate-900 shadow-none md:shadow-lg md:my-4 md:rounded-2xl md:overflow-hidden md:h-[calc(100vh-2rem)]">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <FriendsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat/:pairId"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
