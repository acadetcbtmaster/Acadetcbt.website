import type {
  ActiveExamQuestion,
  ActiveExamSession,
  ActivitySummary,
  AdminCourseItem,
  AdminOverview,
  AdminPaymentRecord,
  AdminQuestionItem,
  AdminRegistrationItem,
  AdminStudentProfile,
  AnnouncementItem,
  CourseCatalogueItem,
  DifficultyLevel,
  GradedExamQuestion,
  OptionLetter,
  PaymentInitializeResponse,
  PaymentStatus,
  PaymentVerifyOutcome,
  PublicationStatus,
  RegisteredCourseItem,
  ResultsOverview,
  SafeUser,
  StudentPaymentRecord,
  StudyMaterialItem,
  UserPreferences,
} from '../types/cbt';

export class ApiError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly data?: Record<string, unknown>;

  constructor(
    message: string,
    status: number,
    code?: string,
    data?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

const SESSION_TOKEN_KEY = 'acadet_session_token';

function readInitialToken(): string | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage.getItem(SESSION_TOKEN_KEY) : null;
  } catch {
    return null;
  }
}

let inMemoryAuthToken: string | null = readInitialToken();

export function setClientAuthToken(token: string | null): void {
  inMemoryAuthToken = token;
  try {
    if (typeof window !== 'undefined') {
      if (token) {
        window.sessionStorage.setItem(SESSION_TOKEN_KEY, token);
      } else {
        window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
      }
    }
  } catch {
    // Ignore restricted sessionStorage
  }
}

export function getClientAuthToken(): string | null {
  return inMemoryAuthToken;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (!isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (inMemoryAuthToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${inMemoryAuthToken}`);
  }

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (response.status === 401 && !path.includes('/api/auth/login') && !path.includes('/api/auth/register')) {
    setClientAuthToken(null);
  }

  const text = await response.text();
  let parsed: Record<string, unknown> = {};
  if (text) {
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      parsed = { error: text };
    }
  }

  if (!response.ok) {
    const message =
      typeof parsed.error === 'string' && parsed.error
        ? parsed.error
        : `Request failed with status ${response.status}`;
    const code = typeof parsed.code === 'string' ? parsed.code : undefined;
    throw new ApiError(message, response.status, code, parsed);
  }

  return parsed as T;
}

export const api = {
  health: () =>
    request<{
      status: string;
      database: { configured: boolean; connected: boolean; error?: string };
      objectStorage: { configured: boolean };
      paystack: { configured: boolean };
    }>('/api/health'),

  auth: {
    register: async (payload: {
      fullName: string;
      email: string;
      username: string;
      password: string;
      examTarget?: string;
    }) => {
      const data = await request<{ token: string; user: SafeUser }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setClientAuthToken(data.token);
      return data;
    },

    login: async (payload: { identifier: string; password: string }) => {
      const data = await request<{ token: string; user: SafeUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setClientAuthToken(data.token);
      return data;
    },

    logout: async () => {
      try {
        await request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
      } finally {
        setClientAuthToken(null);
      }
    },

    me: () => request<{ user: SafeUser }>('/api/auth/me'),

    updateProfile: (payload: {
      fullName?: string;
      examTarget?: string;
      whatsappNumber?: string;
    }) =>
      request<{ user: SafeUser }>('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),

    updatePreferences: (payload: Partial<UserPreferences>) =>
      request<{ user: SafeUser }>('/api/auth/preferences', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
  },

  catalog: {
    getCourses: () => request<{ courses: CourseCatalogueItem[] }>('/api/catalog/courses'),
    getMyCourses: () =>
      request<{ registeredCourses: RegisteredCourseItem[] }>('/api/catalog/my-courses'),
    getAnnouncements: () =>
      request<{ announcements: AnnouncementItem[] }>('/api/catalog/announcements'),
    getActivity: () => request<ActivitySummary>('/api/catalog/activity'),
  },

  payments: {
    getConfig: () =>
      request<{ configured: boolean; publicKey: string | null }>('/api/payments/config'),

    initialize: (courseId: string, whatsappNumber: string) =>
      request<PaymentInitializeResponse>('/api/payments/initialize', {
        method: 'POST',
        body: JSON.stringify({ courseId, whatsappNumber }),
      }),

    verify: (reference: string) =>
      request<PaymentVerifyOutcome>(
        `/api/payments/verify/${encodeURIComponent(reference)}`
      ),

    myPayments: () => request<{ payments: StudentPaymentRecord[] }>('/api/payments/my'),
  },

  exams: {
    start: (payload: {
      courseId: string;
      difficulty: DifficultyLevel;
      questionCount: number;
      timeLimitMinutes?: number;
    }) =>
      request<{ session: ActiveExamSession; questions: ActiveExamQuestion[] }>(
        '/api/exams/start',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      ),

    getSession: (sessionId: string) =>
      request<{
        session: ActiveExamSession;
        questions: ActiveExamQuestion[] | GradedExamQuestion[];
      }>(`/api/exams/${sessionId}`),

    saveAnswer: (
      sessionId: string,
      payload: {
        questionOrder: number;
        selectedOption?: OptionLetter | null;
        isMarkedForReview?: boolean;
        timeSpentSeconds?: number;
      }
    ) =>
      request<{ ok: boolean }>(`/api/exams/${sessionId}/answer`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),

    submit: (
      sessionId: string,
      payload: {
        timeSpentSeconds: number;
        answers?: Array<{
          questionOrder: number;
          selectedOption: OptionLetter | null;
          isMarkedForReview?: boolean;
        }>;
      }
    ) =>
      request<{ session: ActiveExamSession; questions: GradedExamQuestion[] }>(
        `/api/exams/${sessionId}/submit`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      ),
  },

  results: {
    list: (courseId?: string) => {
      const qs = courseId ? `?courseId=${encodeURIComponent(courseId)}` : '';
      return request<ResultsOverview>(`/api/results${qs}`);
    },

    getDetail: (sessionId: string) =>
      request<{ session: ActiveExamSession; questions: GradedExamQuestion[] }>(
        `/api/results/${sessionId}`
      ),
  },

  materials: {
    list: (params?: { category?: string; courseId?: string }) => {
      const search = new URLSearchParams();
      if (params?.category && params.category !== 'All') {
        search.set('category', params.category);
      }
      if (params?.courseId) {
        search.set('courseId', params.courseId);
      }
      const qs = search.toString();
      return request<{ materials: StudyMaterialItem[] }>(
        `/api/materials${qs ? `?${qs}` : ''}`
      );
    },

    requestDownload: (id: string) =>
      request<{ downloadUrl: string; filename: string }>(
        `/api/materials/${id}/download`,
        { method: 'POST' }
      ),
  },

  admin: {
    getOverview: () => request<{ overview: AdminOverview }>('/api/admin/overview'),

    listCourses: () => request<{ courses: AdminCourseItem[] }>('/api/admin/courses'),
    createCourse: (payload: {
      code: string;
      title: string;
      level?: string;
      description?: string;
      registrationFee: number;
      currency?: string;
      publicationStatus?: PublicationStatus;
      examCategory?: string;
      defaultDurationMinutes?: number;
    }) =>
      request<{ course: AdminCourseItem }>('/api/admin/courses', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    updateCourse: (
      id: string,
      payload: Partial<{
        code: string;
        title: string;
        level: string;
        description: string;
        registrationFee: number;
        publicationStatus: PublicationStatus;
        examCategory: string;
        defaultDurationMinutes: number;
      }>
    ) =>
      request<{ course: AdminCourseItem }>(`/api/admin/courses/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    deleteCourse: (id: string) =>
      request<{ deletedId: string }>(`/api/admin/courses/${id}`, { method: 'DELETE' }),

    listQuestions: (courseId?: string) => {
      const qs = courseId ? `?courseId=${encodeURIComponent(courseId)}` : '';
      return request<{ questions: AdminQuestionItem[] }>(`/api/admin/questions${qs}`);
    },
    createQuestion: (payload: {
      courseId: string;
      questionText: string;
      optionA: string;
      optionB: string;
      optionC: string;
      optionD: string;
      correctOption: OptionLetter;
      explanation?: string;
      difficulty: 'Easy' | 'Medium' | 'Hard';
      topic?: string;
      examYear?: number | null;
    }) =>
      request<{ question: AdminQuestionItem }>('/api/admin/questions', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    generateQuestions: (payload: {
      courseId: string;
      topic: string;
      difficulty: 'Easy' | 'Medium' | 'Hard';
      count: number;
    }) =>
      request<{ questions: AdminQuestionItem[] }>('/api/admin/questions/generate', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    deleteQuestion: (id: string) =>
      request<{ deletedId: string }>(`/api/admin/questions/${id}`, { method: 'DELETE' }),

    uploadMaterial: (formData: FormData) =>
      request<{ material: StudyMaterialItem }>('/api/admin/materials/upload', {
        method: 'POST',
        body: formData,
      }),
    deleteMaterial: (id: string) =>
      request<{ deletedId: string }>(`/api/admin/materials/${id}`, { method: 'DELETE' }),

    listAnnouncements: () =>
      request<{ announcements: AnnouncementItem[] }>('/api/admin/announcements'),
    createAnnouncement: (payload: {
      title: string;
      body: string;
      isPinned?: boolean;
      isActive?: boolean;
    }) =>
      request<{ announcement: AnnouncementItem }>('/api/admin/announcements', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    deleteAnnouncement: (id: string) =>
      request<{ deletedId: string }>(`/api/admin/announcements/${id}`, {
        method: 'DELETE',
      }),

    listRegistrations: (filters?: {
      search?: string;
      courseId?: string;
      paymentStatus?: PaymentStatus | '';
      dateFrom?: string;
      dateTo?: string;
    }) => {
      const search = new URLSearchParams();
      if (filters?.search) search.set('search', filters.search);
      if (filters?.courseId) search.set('courseId', filters.courseId);
      if (filters?.paymentStatus) search.set('paymentStatus', filters.paymentStatus);
      if (filters?.dateFrom) search.set('dateFrom', filters.dateFrom);
      if (filters?.dateTo) search.set('dateTo', filters.dateTo);
      const qs = search.toString();
      return request<{ registrations: AdminRegistrationItem[] }>(
        `/api/admin/registrations${qs ? `?${qs}` : ''}`
      );
    },

    getRegistrationsExportUrl: (filters?: {
      search?: string;
      courseId?: string;
      paymentStatus?: PaymentStatus | '';
      dateFrom?: string;
      dateTo?: string;
    }) => {
      const search = new URLSearchParams();
      if (filters?.search) search.set('search', filters.search);
      if (filters?.courseId) search.set('courseId', filters.courseId);
      if (filters?.paymentStatus) search.set('paymentStatus', filters.paymentStatus);
      if (filters?.dateFrom) search.set('dateFrom', filters.dateFrom);
      if (filters?.dateTo) search.set('dateTo', filters.dateTo);
      const qs = search.toString();
      return `/api/admin/registrations/export${qs ? `?${qs}` : ''}`;
    },

    listPayments: (filters?: {
      status?: PaymentStatus | '';
      courseId?: string;
      studentId?: string;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
    }) => {
      const search = new URLSearchParams();
      if (filters?.status) search.set('status', filters.status);
      if (filters?.courseId) search.set('courseId', filters.courseId);
      if (filters?.studentId) search.set('studentId', filters.studentId);
      if (filters?.search) search.set('search', filters.search);
      if (filters?.dateFrom) search.set('dateFrom', filters.dateFrom);
      if (filters?.dateTo) search.set('dateTo', filters.dateTo);
      const qs = search.toString();
      return request<{ payments: AdminPaymentRecord[] }>(
        `/api/admin/payments${qs ? `?${qs}` : ''}`
      );
    },

    reverifyPayment: (paymentId: string) =>
      request<PaymentVerifyOutcome>(`/api/admin/payments/${paymentId}/reverify`, {
        method: 'POST',
      }),

    listUsers: () => request<{ users: SafeUser[] }>('/api/admin/users'),
    getStudentProfile: (studentId: string) =>
      request<AdminStudentProfile>(`/api/admin/users/${studentId}/profile`),
    updateUser: (
      id: string,
      payload: { isActive?: boolean; role?: SafeUser['role']; examTarget?: string }
    ) =>
      request<{ user: SafeUser }>(`/api/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),

    listResults: () =>
      request<{
        results: Array<{
          id: string;
          userId: string;
          studentName: string;
          studentEmail: string;
          courseCode: string | null;
          courseTitle: string | null;
          scorePercentage: number | null;
          correctCount: number | null;
          totalQuestions: number;
          timeSpentSeconds: number;
          submittedAt: string | null;
        }>;
      }>('/api/admin/results'),
  },
};
