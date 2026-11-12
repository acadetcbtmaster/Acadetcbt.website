import type {
  ActiveExamQuestion,
  ActiveExamSession,
  ActivitySummary,
  AdminOverview,
  AdminQuestionItem,
  AnnouncementItem,
  CourseSummary,
  DifficultyLevel,
  GradedExamQuestion,
  OptionLetter,
  ResultsOverview,
  SafeUser,
  StudyMaterialItem,
  SubjectSummary,
  UserPreferences,
} from '../types/cbt';

export class ApiError extends Error {
  public readonly status: number;
  public readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
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
    throw new ApiError(message, response.status, code);
  }

  return parsed as T;
}

export const api = {
  health: () =>
    request<{
      status: string;
      database: { configured: boolean; connected: boolean; error?: string };
      objectStorage: { configured: boolean };
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

    updateProfile: (payload: { fullName?: string; examTarget?: string }) =>
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
    getSubjects: () => request<{ subjects: SubjectSummary[] }>('/api/catalog/subjects'),
    getCourses: (subjectId: string) =>
      request<{ courses: CourseSummary[] }>(`/api/catalog/subjects/${subjectId}/courses`),
    getAnnouncements: () =>
      request<{ announcements: AnnouncementItem[] }>('/api/catalog/announcements'),
    getActivity: () => request<ActivitySummary>('/api/catalog/activity'),
  },

  exams: {
    start: (payload: {
      subjectId: string;
      courseId?: string | null;
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
    list: (subjectId?: string) => {
      const qs = subjectId ? `?subjectId=${encodeURIComponent(subjectId)}` : '';
      return request<ResultsOverview>(`/api/results${qs}`);
    },

    getDetail: (sessionId: string) =>
      request<{ session: ActiveExamSession; questions: GradedExamQuestion[] }>(
        `/api/results/${sessionId}`
      ),
  },

  materials: {
    list: (params?: { category?: string; subjectId?: string }) => {
      const search = new URLSearchParams();
      if (params?.category && params.category !== 'All') {
        search.set('category', params.category);
      }
      if (params?.subjectId) {
        search.set('subjectId', params.subjectId);
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
    listSubjects: () => request<{ subjects: SubjectSummary[] }>('/api/admin/subjects'),
    createSubject: (payload: {
      name: string;
      slug: string;
      code: string;
      examCategory?: string;
      description?: string;
      defaultDurationMinutes?: number;
    }) =>
      request<{ subject: SubjectSummary }>('/api/admin/subjects', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    deleteSubject: (id: string) =>
      request<{ deletedId: string }>(`/api/admin/subjects/${id}`, { method: 'DELETE' }),

    listQuestions: (subjectId?: string) => {
      const qs = subjectId ? `?subjectId=${encodeURIComponent(subjectId)}` : '';
      return request<{ questions: AdminQuestionItem[] }>(`/api/admin/questions${qs}`);
    },
    createQuestion: (payload: {
      subjectId: string;
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
      subjectId: string;
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

    listUsers: () => request<{ users: SafeUser[] }>('/api/admin/users'),
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
          subjectName: string;
          scorePercentage: number | null;
          correctCount: number | null;
          totalQuestions: number;
          timeSpentSeconds: number;
          submittedAt: string | null;
        }>;
      }>('/api/admin/results'),
  },
};
