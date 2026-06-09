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
import ForgotPasswordPage from "./pages/ForgotPassword";
import ProjectAccessMatrixPage from "./pages/ProjectAccessMatrix";

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { token, isAdmin, loading } = useAuth();
  if (loading)
    return <div style={{ minHeight: "100vh", backgroundColor: "#181825" }} />;
  if (!token) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const HomeRoute = () => {
  const { hasRole } = useAuth();

  const canAccessProjects =
    hasRole("DEFINE_PROJECTS") || hasRole("DEFINE_ASSIGNED_PROJECTS");

  return canAccessProjects ? (
    <Navigate to="/projects" replace />
  ) : (
    <Navigate to="/executions" replace />
  );
};

const ProjectAreaRoute = ({ children }: { children: React.ReactNode }) => {
  const { hasRole } = useAuth();

  const canAccessProjects =
    hasRole("DEFINE_PROJECTS") || hasRole("DEFINE_ASSIGNED_PROJECTS");

  if (!canAccessProjects) {
    return <Navigate to="/executions" replace />;
  }

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
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomeRoute />
              </ProtectedRoute>
            }
          />

          <Route
            path="/projects"
            element={
              <ProtectedRoute>
                <ProjectAreaRoute>
                  <ProjectsPage />
                </ProjectAreaRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/projects/:projectId"
            element={
              <ProtectedRoute>
                <ProjectAreaRoute>
                  <ProjectDetailPage />
                </ProjectAreaRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/modules/:moduleId"
            element={
              <ProtectedRoute>
                <ProjectAreaRoute>
                  <ModuleDetailPage />
                </ProjectAreaRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/testcases/:testCaseId"
            element={
              <ProtectedRoute>
                <ProjectAreaRoute>
                  <TestCaseDetailPage />
                </ProjectAreaRoute>
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
            <Route
              path="project-access"
              element={<ProjectAccessMatrixPage />}
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
