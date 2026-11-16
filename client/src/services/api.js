import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api",
});

let unauthorizedRedirectStarted = false;

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    const requestUrl = response.config?.url || "";
    if (/(?:^|\/)auth\/(?:login|register)(?:$|[/?#])/i.test(requestUrl)) {
      unauthorizedRedirectStarted = false;
    }

    return response;
  },
  (error) => {
    const requestUrl = error.config?.url || "";
    const isAuthRequest = /(?:^|\/)auth\/(?:login|register)(?:$|[/?#])/i.test(
      requestUrl
    );

    if (
      error.response?.status === 401 &&
      !isAuthRequest &&
      !unauthorizedRedirectStarted
    ) {
      unauthorizedRedirectStarted = true;
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      if (window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }

    return Promise.reject(error);
  }
);

export default api;
