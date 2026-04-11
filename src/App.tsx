import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./router/ProtectedRoute";
import Navbar from "./components/Navbar";
import LoginPage from "./pages/Login";
import RegisterPage from "./pages/Register";
import ProjectsPage from "./pages/Projects";
import ProjectDetailPage from "./pages/ProjectDetail";
import ModuleDetailPage from "./pages/ModuleDetail";
import TestCaseDetailPage from "./pages/TestCaseDetail";
import ExecutionPage from "./pages/ExecutionPage";
import AdminLayout from "./components/AdminLayout";
import UsersPage from "./pages/UserManagement";
import RolesPage from "./pages/RoleManagement";
import ProjectMappingPage from "./pages/ProjectMapping";

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { token, isAdmin, loading } = useAuth();
  if (loading)
    return <div style={{ minHeight: "100vh", backgroundColor: "#181825" }} />;
  if (!token) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <ProjectsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/:projectId"
            element={
              <ProtectedRoute>
                <ProjectDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/modules/:moduleId"
            element={
              <ProtectedRoute>
                <ModuleDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/testcases/:testCaseId"
            element={
              <ProtectedRoute>
                <TestCaseDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/executions"
            element={
              <ProtectedRoute>
                <ExecutionPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route index element={<Navigate to="users" replace />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="roles" element={<RolesPage />} />
            <Route path="project-mapping" element={<ProjectMappingPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
