// frontend/lib/api.ts
import axios from 'axios'
import Cookies from 'js-cookie'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api'

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = Cookies.get('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refreshToken = Cookies.get('refreshToken')

      if (refreshToken) {
        try {
          const res = await axios.post(`${API_URL}/auth/refresh`, { refreshToken })
          const { accessToken } = res.data.data
          Cookies.set('accessToken', accessToken, { expires: 7, sameSite: 'strict' })
          original.headers.Authorization = `Bearer ${accessToken}`
          return api(original)
        } catch {
          // Refresh failed — clear tokens and let the page handle it
          Cookies.remove('accessToken')
          Cookies.remove('refreshToken')
        }
      } else {
        // No refresh token — clear access token and let the page handle it
        Cookies.remove('accessToken')
      }
    }

    return Promise.reject(error)
  }
)

// ─── Auth ─────────────────────────────────────────────
export const authApi: any = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  verifyAdminOtp: (email: string, otp: string) =>
    api.post('/auth/login/verify-otp', { email, otp }),
  resendAdminOtp: (email: string) => api.post('/auth/login/resend-otp', { email }),
  me: () => api.get('/auth/me'),
  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }),
  googleAuth: (idToken: string) =>
    api.post('/auth/google', { idToken }),
  visitorLogin: (email: string, password: string) =>
    api.post('/auth/visitor/login', { email, password }),
  visitorRegister: (name: string, email: string, password: string) =>
    api.post('/auth/visitor/register', { name, email, password }),
}

// ─── Properties ───────────────────────────────────────
export const propertyApi = {
  getAll: (params?: Record<string, any>) =>
    api.get('/properties', { params }),
  getAdminAll: (params?: Record<string, any>) =>
    api.get('/properties/admin', { params }),
  getBySlug: (slug: string) =>
    api.get(`/properties/slug/${slug}`),
  getById: (id: string) =>
    api.get(`/properties/${id}`),
  geocode: (params: { address?: string; city?: string; state?: string; country?: string }) =>
    api.get('/properties/geocode', { params }),
  create: (data: any) =>
    api.post('/properties', data),
  update: (id: string, data: any) =>
    api.put(`/properties/${id}`, data),
  patch: (id: string, data: any) =>
    api.patch(`/properties/${id}`, data),
  updateLocation: (id: string, data: { latitude: number; longitude: number; address?: string }) =>
    api.patch(`/properties/${id}/location`, data),
  delete: (id: string) =>
    api.delete(`/properties/${id}`),
}

// ─── Messages ─────────────────────────────────────────
export const messageApi = {
  getAll: (params?: Record<string, any>) =>
    api.get('/messages', { params }),
  create: (data: any) =>
    api.post('/messages', data),
  patch: (id: string, data: any) =>
    api.patch(`/messages/${id}`, data),
  delete: (id: string) =>
    api.delete(`/messages/${id}`),
}

// ─── Upload ───────────────────────────────────────────
export const uploadApi = {
  single: (formData: FormData) =>
    api.post('/upload/single', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  multiple: (formData: FormData) =>
    api.post('/upload/multiple', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  delete: (publicId: string) =>
    api.delete('/upload', { data: { publicId } }),
}

// ─── Dashboard ────────────────────────────────────────
export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
}

// ─── Staff ────────────────────────────────────────────
export const staffApi = {
  create: (data: { username: string; password: string; name?: string }) =>
    api.post('/staff', data),
  list: (params?: Record<string, any>) => api.get('/staff', { params }),
  get: (id: string) => api.get(`/staff/${id}`),
  update: (id: string, data: any) => api.patch(`/staff/${id}`, data),
  setStatus: (id: string, isActive: boolean) =>
    api.patch(`/staff/${id}/status`, { isActive }),
  delete: (id: string) => api.delete(`/staff/${id}`),
}

// ─── Activity ─────────────────────────────────────────
export const activityApi = {
  list: (params?: Record<string, any>) => api.get('/activity', { params }),
  staff: (staffId: string, params?: Record<string, any>) =>
    api.get(`/activity/staff/${staffId}`, { params }),
}

// ─── Videos (Bunny Stream) ────────────────────────────
export const videoApi = {
  getUploadAuth: (data: { title?: string; propertyId?: string; videoId?: string }) =>
    api.post('/videos/signature', data),
  complete: (data: {
    videoId: string
    propertyId: string
    title?: string
    order?: number
  }) => api.post('/videos/complete', data),
  delete: (id: string) => api.delete(`/videos/${id}`),
  list: (propertyId: string) => api.get(`/videos/property/${propertyId}`),
  reorder: (propertyId: string, videoIds: string[]) =>
    api.patch(`/videos/property/${propertyId}/reorder`, { videoIds }),
}

// ─── Auth extras ──────────────────────────────────────
authApi.changePassword = (data: {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}) => api.post('/auth/change-password', data)

authApi.staffLogin = (username: string, password: string) =>
  api.post('/auth/staff/login', { username, password })
