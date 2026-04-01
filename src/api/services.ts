import api from "./axios";

// ── Auth ──
export const authService = {
    register: async (name: string, email: string, password: string) => {
        const res = await api.post("/auth/register", { name, email, password });
        return res.data;
    },
    login: async (email: string, password: string) => {
        const res = await api.post("/auth/login", { email, password });
        return res.data;
    },
    forgotPassword: async (email: string) => {
        const res = await api.post("/auth/forgot-password", { email });
        return res.data.data;
    },
    resetPassword: async (token: string, newPassword: string) => {
        const res = await api.post("/auth/reset-password", { token, newPassword });
        return res.data.data;
    },
};

// ── Projects ──
export const projectService = {
    getAll: async () => {
        const res = await api.get("/projects");
        return res.data.data;
    },
    create: async (name: string, description?: string) => {
        const res = await api.post("/projects", { name, description });
        return res.data.data;
    },
    getById: async (id: string) => {
        const res = await api.get(`/projects/${id}`);
        return res.data.data;
    },
    delete: async (id: string) => {
        const res = await api.delete(`/projects/${id}`);
        return res.data.data;
    },
};

// ── Modules ──
export const moduleService = {
    getByProject: async (projectId: string) => {
        const res = await api.get(`/modules/${projectId}`);
        return res.data.data;
    },
    create: async (name: string, projectId: string, description?: string) => {
        const res = await api.post("/modules", { name, projectId, description });
        return res.data.data;
    },
};

// ── Test Cases ──
export const testCaseService = {
    getByModule: async (moduleId: string) => {
        const res = await api.get(`/testcases/${moduleId}`);
        return res.data.data;
    },
    create: async (name: string, moduleId: string, description?: string) => {
        const res = await api.post("/testcases", { name, moduleId, description });
        return res.data.data;
    },
};

// ── Recordings ──
export const recordingService = {
    getByTestCase: async (testCaseId: string) => {
        const res = await api.get(`/recordings/${testCaseId}`);
        return res.data.data;
    },
    create: async (testCaseId: string, steps: object[], videoUrl?: string) => {
        const res = await api.post("/recordings", { testCaseId, steps, videoUrl });
        return res.data.data;
    },
};

// ── Admin ──
export const adminService = {
    // Roles
    getAvailableRoles: async () => {
        const res = await api.get("/api/admin/roles");
        return res.data.data;
    },

    // Users CRUD
    getUsers: async () => {
        const res = await api.get("/api/admin/users");
        return res.data.data;
    },
    getUserById: async (id: string) => {
        const res = await api.get(`/api/admin/users/${id}`);
        return res.data.data;
    },
    createUser: async (data: { email: string; password: string; name: string; roles?: string[] }) => {
        const res = await api.post("/api/admin/users", data);
        return res.data.data;
    },
    updateUser: async (id: string, data: { email?: string; name?: string; password?: string; isActive?: boolean }) => {
        const res = await api.put(`/api/admin/users/${id}`, data);
        return res.data.data;
    },
    deleteUser: async (id: string) => {
        const res = await api.delete(`/api/admin/users/${id}`);
        return res.data.data;
    },

    // Role assignment
    getUserRoles: async (userId: string) => {
        const res = await api.get(`/api/admin/users/${userId}/roles`);
        return res.data.data;
    },
    assignRoles: async (userId: string, roles: string[]) => {
        const res = await api.put(`/api/admin/users/${userId}/roles`, { roles });
        return res.data.data;
    },
    addRole: async (userId: string, role: string) => {
        const res = await api.post(`/api/admin/users/${userId}/roles`, { role });
        return res.data.data;
    },
    removeRole: async (userId: string, role: string) => {
        const res = await api.delete(`/api/admin/users/${userId}/roles`, { data: { role } });
        return res.data.data;
    },

    // Project-User mapping
    getUserProjects: async (userId: string) => {
        const res = await api.get(`/api/admin/users/${userId}/projects`);
        return res.data.data;
    },
    getProjectUsers: async (projectId: string) => {
        const res = await api.get(`/api/admin/projects/${projectId}/users`);
        return res.data.data;
    },
    mapUserToProject: async (projectId: string, userId: string) => {
        const res = await api.post(`/api/admin/projects/${projectId}/users`, { userId });
        return res.data.data;
    },
    unmapUserFromProject: async (projectId: string, userId: string) => {
        const res = await api.delete(`/api/admin/projects/${projectId}/users/${userId}`);
        return res.data.data;
    },
};