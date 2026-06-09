import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000",
});

const clearAuthAndRedirect = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
  localStorage.removeItem("accessTokenExpiresAt");
  window.dispatchEvent(new CustomEvent("auth:forced-logout"));
  window.location.href = "/login";
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = "Bearer " + token;
  }

  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  } else {
    config.headers["Content-Type"] = "application/json";
  }

  return config;
});

let isRefreshing = false;
let pendingQueue: Array<(token: string | null) => void> = [];

const flushQueue = (token: string | null) => {
  pendingQueue.forEach((cb) => cb(token));
  pendingQueue = [];
};

const isPublicAuthEndpoint = (url?: string) =>
  !!url &&
  [
    "/auth/login",
    "/auth/register",
    "/auth/forgot-password",
    "/auth/reset-password",
  ].some((path) => url.includes(path));

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = (error.config || {}) as RetryableRequestConfig;
    const status = error.response?.status;

    if (status !== 401) {
      return Promise.reject(error);
    }

    if (isPublicAuthEndpoint(originalRequest.url)) {
      return Promise.reject(error);
    }

    if (originalRequest.url?.includes("/auth/refresh")) {
      clearAuthAndRedirect();
      return Promise.reject(error);
    }

    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) {
      clearAuthAndRedirect();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push((newToken) => {
          if (!newToken) {
            reject(error);
            return;
          }

          originalRequest.headers.Authorization = "Bearer " + newToken;
          resolve(api(originalRequest));
        });
      });
    }

    if (originalRequest._retry) {
      clearAuthAndRedirect();
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshRes = await axios.post(
        (api.defaults.baseURL || "") + "/auth/refresh",
        { refreshToken },
        { headers: { "Content-Type": "application/json" } },
      );

      const newToken =
        (refreshRes.data &&
          (refreshRes.data.token || refreshRes.data.data?.token)) ||
        "";
      const newRefreshToken =
        (refreshRes.data &&
          (refreshRes.data.refreshToken ||
            refreshRes.data.data?.refreshToken)) ||
        "";

      if (!newToken || !newRefreshToken) {
        flushQueue(null);
        clearAuthAndRedirect();
        return Promise.reject(error);
      }

      localStorage.setItem("token", newToken);
      localStorage.setItem("refreshToken", newRefreshToken);

      flushQueue(newToken);

      originalRequest.headers.Authorization = "Bearer " + newToken;
      return api(originalRequest);
    } catch (refreshErr) {
      flushQueue(null);
      clearAuthAndRedirect();
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;
