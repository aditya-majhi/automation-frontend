import api from "./axios";

// ── Auth ──
export const authService = {
    register: async (name: string, email: string, password: string) => {
        const res = await api.post("/auth/register", { name, email, password });
        return res.data.data;
    },
    login: async (email: string, password: string) => {
        const res = await api.post("/auth/login", { email, password });
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