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
  refresh: async (refreshToken: string) => {
    const res = await api.post("/auth/refresh", { refreshToken });
    return res.data;
  },
  logout: async (refreshToken?: string) => {
    const res = await api.post("/auth/logout", {
      refreshToken: refreshToken || null,
    });
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
  update: async (
    id: string,
    payload: { name?: string; description?: string | null },
  ) => {
    const res = await api.patch(`/projects/${id}`, payload);
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
    const res = await api.get("/modules/" + projectId);
    return res.data.data;
  },
  getById: async (moduleId: string) => {
    const res = await api.get("/modules/id/" + moduleId);
    return res.data.data;
  },
  create: async (name: string, projectId: string, description?: string) => {
    const res = await api.post("/modules", { name, projectId, description });
    return res.data.data;
  },
  update: async (
    moduleId: string,
    payload: { name?: string; description?: string | null },
  ) => {
    const res = await api.patch(`/modules/${moduleId}`, payload);
    return res.data.data;
  },
  delete: async (moduleId: string) => {
    const res = await api.delete("/modules/" + moduleId);
    return res.data.data;
  },
};

// ── Test Cases ──
export const testCaseService = {
  getByModule: async (moduleId: string) => {
    const res = await api.get("/testcases/" + moduleId);
    return res.data.data;
  },
  getMeta: async (testCaseId: string) => {
    const res = await api.get("/testcases/" + testCaseId + "/meta");
    return res.data.data;
  },
  create: async (name: string, moduleId: string, description?: string) => {
    const res = await api.post("/testcases", { name, moduleId, description });
    return res.data.data;
  },
  updateMeta: async (
    testCaseId: string,
    payload: { name?: string; description?: string | null },
  ) => {
    const res = await api.patch(`/testcases/${testCaseId}`, payload);
    return res.data.data;
  },
  delete: async (testCaseId: string) => {
    const res = await api.delete("/testcases/" + testCaseId);
    return res.data.data;
  },
  getScripts: async (testCaseId: string) => {
    const res = await api.get("/testcases/" + testCaseId + "/scripts");
    return res.data.data;
  },
  saveBaseScript: async (
    testCaseId: string,
    baseScript: string,
    contextMeta?: any,
  ) => {
    const res = await api.put("/testcases/" + testCaseId + "/base-script", {
      baseScript,
      contextMeta: contextMeta || null,
    });
    return res.data.data;
  },
  generateFinalScript: async (
    testCaseId: string,
    payload: {
      assertions: {
        logic: string;
        rules: Array<{
          id: number;
          left: string;
          label: string;
          operator: string;
          right_type?: "constant" | "variable" | null;
          right_value?: string | number | boolean | string[] | null;
          regex_value?: string | null;
        }>;
        contextMeta?: any;
      };
      baseScript?: string;
    },
  ) => {
    const res = await api.post(
      "/testcases/" + testCaseId + "/final-script/generate",
      payload,
    );
    return res.data.data;
  },
  saveFinalScript: async (
    testCaseId: string,
    finalScript: string,
    assertions?: {
      logic: string;
      rules: Array<{
        id: number;
        left: string;
        label: string;
        operator: string;
        right_type?: "constant" | "variable" | null;
        right_value?: string | number | boolean | string[] | null;
        regex_value?: string | null;
      }>;
      contextMeta?: any;
    },
  ) => {
    const res = await api.put("/testcases/" + testCaseId + "/final-script", {
      finalScript,
      assertions,
    });
    return res.data.data;
  },
  getAssertionVariables: async (testCaseId: string) => {
    const res = await api.get(
      "/testcases/" + testCaseId + "/assertion-variables",
    );
    return res.data.data.variables || [];
  },
  getAssertionOperators: async () => {
    const res = await api.get("/testcases/assertions/operators");
    return res.data.data.operators || [];
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
  getAvailableRoles: async () => {
    const res = await api.get("/api/admin/roles");
    return res.data.data;
  },
  getUsers: async () => {
    const res = await api.get("/api/admin/users");
    return res.data.data;
  },
  getUserById: async (id: string) => {
    const res = await api.get(`/api/admin/users/${id}`);
    return res.data.data;
  },
  createUser: async (data: {
    email: string;
    password: string;
    name: string;
    roles?: string[];
  }) => {
    const res = await api.post("/api/admin/users", data);
    return res.data.data;
  },
  updateUser: async (
    id: string,
    data: {
      email?: string;
      name?: string;
      password?: string;
      isActive?: boolean;
    },
  ) => {
    const res = await api.put(`/api/admin/users/${id}`, data);
    return res.data.data;
  },
  deleteUser: async (id: string) => {
    const res = await api.delete(`/api/admin/users/${id}`);
    return res.data.data;
  },
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
    const res = await api.delete(`/api/admin/users/${userId}/roles`, {
      data: { role },
    });
    return res.data.data;
  },
  getUserProjects: async (userId: string) => {
    const res = await api.get(`/api/admin/users/${userId}/projects`);
    return res.data.data;
  },
  getProjectUsers: async (projectId: string) => {
    const res = await api.get(`/api/admin/projects/${projectId}/users`);
    return res.data.data;
  },
  mapUserToProject: async (projectId: string, userId: string) => {
    const res = await api.post(`/api/admin/projects/${projectId}/users`, {
      userId,
    });
    return res.data.data;
  },
  unmapUserFromProject: async (projectId: string, userId: string) => {
    const res = await api.delete(
      `/api/admin/projects/${projectId}/users/${userId}`,
    );
    return res.data.data;
  },
};

//Execution Service
export const executionService = {
  downloadTemplate: async (testCaseId: string) => {
    const res = await api.get(`/executions/templates/${testCaseId}`, {
      responseType: "blob",
    });

    const cd = res.headers?.["content-disposition"] || "";
    const match = cd.match(/filename="([^"]+)"/i);
    const fileName = match?.[1] || `${testCaseId}.xlsx`;

    return { blob: res.data as Blob, fileName };
  },

  startExecution: async (payload: {
    executionId?: string;
    runConfig?: { timeoutSec?: number };
    testCaseIds: string[];
    filesByTestCaseId: Record<string, File | undefined>;
  }) => {
    const form = new FormData();
    form.append("testCaseIds", JSON.stringify(payload.testCaseIds));

    if (payload.executionId) {
      form.append("executionId", payload.executionId);
    }

    form.append(
      "runConfig",
      JSON.stringify(payload.runConfig || { timeoutSec: 300 }),
    );

    for (const testCaseId of payload.testCaseIds) {
      const file = payload.filesByTestCaseId[testCaseId];
      if (!file) continue;
      form.append("files", file);
      form.append("fileTestCaseIds", testCaseId);
    }

    const res = await api.post("/executions/start", form);
    return res.data.data;
  },

  getExecutionStatus: async (executionId: string) => {
    const res = await api.get(`/executions/${executionId}`);
    const payload = res.data?.data;

    if (typeof payload === "string") {
      try {
        const parsed = JSON.parse(payload);
        return parsed?.data ?? parsed;
      } catch {
        return { status: "unknown", raw: payload };
      }
    }

    return payload?.data ?? payload;
  },
};
