import type {
  AccountStatus,
  ActiveExamQuestion,
  ActiveExamSession,
  ActivitySummary,
  AdminCourseItem,
  AdminEmailStatusOverview,
  AdminNotificationRecord,
  AdminOverview,
  AdminPaymentRecord,
  AdminPaymentVerificationLog,
  AdminQuestionItem,
  AdminRegistrationItem,
  AdminStudentProfile,
  AnnouncementItem,
  CourseCatalogueItem,
  DifficultyLevel,
  FounderProfileData,
  GradedExamQuestion,
  NotificationType,
  OptionLetter,
  PaymentBackupSummary,
  PaymentInitializeResponse,
  PaymentReceiptData,
  PaymentResetPreview,
  PaymentStatus,
  PaymentVerificationResult,
  PaymentVerifyOutcome,
  PublicSiteDataResponse,
  PublicationStatus,
  QuestionDifficulty,
  QuestionStatsResponse,
  RegisteredCourseItem,
  ResultsOverview,
  SafeUser,
  SiteBrandingData,
  StudentNotificationItem,
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

    if (
      response.status === 403 &&
      code === 'ACCOUNT_SUSPENDED' &&
      !path.includes('/api/auth/login')
    ) {
      setClientAuthToken(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('acadet:account-suspended', { detail: { message } })
        );
      }
    }

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
      email?: { configured: boolean };
    }>('/api/health'),

  public: {
    getSiteData: () => request<PublicSiteDataResponse>('/api/public/site-data'),
  },

  auth: {
    register: async (payload: {
      fullName: string;
      email: string;
      username: string;
      password: string;
      examTarget?: string;
    }) => {
      const data = await request<{
        token: string;
        user: SafeUser;
        verificationEmailSent?: boolean;
        verificationNotice?: string;
      }>('/api/auth/register', {
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

    forgotPassword: (email: string) =>
      request<{ ok: boolean; message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),

    validateResetToken: (token: string) =>
      request<{ valid: boolean; status: string; expiresAt?: string }>(
        `/api/auth/reset-password/validate?token=${encodeURIComponent(token)}`
      ),

    resetPassword: (payload: {
      token: string;
      newPassword: string;
      confirmPassword: string;
    }) =>
      request<{ ok: boolean; message: string; confirmationEmailSent?: boolean }>(
        '/api/auth/reset-password',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      ),

    verifyEmail: (token: string) =>
      request<{ ok: boolean; alreadyVerified?: boolean; emailVerified?: boolean; message: string }>(
        '/api/auth/verify-email',
        {
          method: 'POST',
          body: JSON.stringify({ token }),
        }
      ),

    resendVerification: (email?: string) =>
      request<{ ok: boolean; alreadyVerified?: boolean; message: string }>(
        '/api/auth/resend-verification',
        {
          method: 'POST',
          body: JSON.stringify(email ? { email } : {}),
        }
      ),
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
      request<{
        configured: boolean;
        publicKey: string | null;
        pricing?: {
          courseValue: number;
          totalAmountPayable: number;
          currency: string;
          feeAbsorbedBy: string;
        };
      }>('/api/payments/config'),

    initialize: (courseId: string, whatsappNumber: string) =>
      request<PaymentInitializeResponse>('/api/payments/initialize', {
        method: 'POST',
        body: JSON.stringify({ courseId, whatsappNumber }),
      }),

    verify: (reference: string, source: 'student_manual' | 'callback' = 'student_manual') =>
      request<PaymentVerifyOutcome>('/api/payments/verify', {
        method: 'POST',
        body: JSON.stringify({ reference, source }),
      }),

    getReceipt: (paymentId: string) =>
      request<{ receipt: PaymentReceiptData }>(`/api/payments/${encodeURIComponent(paymentId)}/receipt`),

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

  notifications: {
    list: () =>
      request<{ notifications: StudentNotificationItem[]; unreadCount: number }>(
        '/api/notifications'
      ),
    markRead: (id: string) =>
      request<{ notificationId: string; isRead: boolean; readAt: string }>(
        `/api/notifications/${id}/read`,
        { method: 'POST' }
      ),
    markAllRead: () =>
      request<{ ok: boolean; markedCount: number }>('/api/notifications/read-all', {
        method: 'POST',
      }),
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
      courseValue?: number;
      currency?: string;
      publicationStatus?: PublicationStatus;
      examCategory?: string;
      defaultDurationMinutes?: number;
      whatsappGroupLink?: string | null;
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
        courseValue: number;
        publicationStatus: PublicationStatus;
        examCategory: string;
        defaultDurationMinutes: number;
        whatsappGroupLink: string | null;
      }>
    ) =>
      request<{ course: AdminCourseItem }>(`/api/admin/courses/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    deleteCourse: (id: string) =>
      request<{ deletedId: string }>(`/api/admin/courses/${id}`, { method: 'DELETE' }),

    getQuestionStats: () => request<QuestionStatsResponse>('/api/admin/questions/stats'),
    listQuestions: (
      courseIdOrFilters?:
        | string
        | {
            courseId?: string;
            difficulty?: QuestionDifficulty | '';
            search?: string;
            status?: 'all' | 'active' | 'inactive';
            limit?: number;
          }
    ) => {
      const searchParams = new URLSearchParams();
      if (typeof courseIdOrFilters === 'string') {
        if (courseIdOrFilters) searchParams.set('courseId', courseIdOrFilters);
      } else if (courseIdOrFilters) {
        if (courseIdOrFilters.courseId) searchParams.set('courseId', courseIdOrFilters.courseId);
        if (courseIdOrFilters.difficulty) searchParams.set('difficulty', courseIdOrFilters.difficulty);
        if (courseIdOrFilters.search) searchParams.set('search', courseIdOrFilters.search);
        if (courseIdOrFilters.status) searchParams.set('status', courseIdOrFilters.status);
        if (courseIdOrFilters.limit) searchParams.set('limit', String(courseIdOrFilters.limit));
      }
      const qs = searchParams.toString();
      return request<{ questions: AdminQuestionItem[] }>(
        `/api/admin/questions${qs ? `?${qs}` : ''}`
      );
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
    updateQuestion: (
      id: string,
      payload: Partial<{
        courseId: string;
        questionText: string;
        optionA: string;
        optionB: string;
        optionC: string;
        optionD: string;
        correctOption: OptionLetter;
        explanation: string;
        difficulty: 'Easy' | 'Medium' | 'Hard';
        topic: string;
        examYear: number | null;
        isActive: boolean;
      }>
    ) =>
      request<{ question: AdminQuestionItem }>(`/api/admin/questions/${id}`, {
        method: 'PATCH',
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

    listVerificationLogs: (filters?: {
      result?: PaymentVerificationResult | '';
      courseId?: string;
      search?: string;
    }) => {
      const search = new URLSearchParams();
      if (filters?.result) search.set('result', filters.result);
      if (filters?.courseId) search.set('courseId', filters.courseId);
      if (filters?.search) search.set('search', filters.search);
      const qs = search.toString();
      return request<{
        logs: AdminPaymentVerificationLog[];
        summary: { total: number; counts: Record<string, number> };
      }>(`/api/admin/verification-logs${qs ? `?${qs}` : ''}`);
    },

    reverifyVerificationLog: (logId: string) =>
      request<{
        logId: string;
        paystackStatus: string;
        paystackAmountKobo: number | null;
        paystackCurrency: string | null;
        paystackCustomerEmail: string | null;
        paystackTransactionId: string | null;
        paystackPayload: Record<string, unknown>;
        message: string;
      }>(`/api/admin/verification-logs/${encodeURIComponent(logId)}/reverify`, {
        method: 'POST',
      }),

    resolveVerificationLog: (
      logId: string,
      payload: {
        action: 'approve_activate' | 'reject';
        studentId?: string;
        courseId?: string;
        resolutionNote: string;
        reverifyLive?: boolean;
      }
    ) =>
      request<{
        logId: string;
        verificationResult: PaymentVerificationResult;
        outcome: PaymentVerifyOutcome | null;
        message: string;
      }>(`/api/admin/verification-logs/${encodeURIComponent(logId)}/resolve`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    getPaymentResetPreview: () =>
      request<{ preview: PaymentResetPreview; backups: PaymentBackupSummary[] }>(
        '/api/admin/payments/reset-preview'
      ),

    createPaymentBackup: (label?: string) =>
      request<{
        backup: PaymentBackupSummary;
        preview: PaymentResetPreview;
        backups: PaymentBackupSummary[];
        message: string;
      }>('/api/admin/payments/backup', {
        method: 'POST',
        body: JSON.stringify({ label }),
      }),

    getPaymentBackupExportUrl: (backupId: string) =>
      `/api/admin/payments/backup/${encodeURIComponent(backupId)}/export`,

    resetTestPayments: () =>
      request<{
        removedCount: number;
        backupId: string;
        preview: PaymentResetPreview;
        backups: PaymentBackupSummary[];
        message: string;
      }>('/api/admin/payments/reset-test', { method: 'POST' }),

    resetAllPayments: (payload: {
      backupId: string;
      acknowledgeConsequences: boolean;
      confirmation: string;
    }) =>
      request<{
        deletedPaymentsCount: number;
        preservedRegistrationsCount: number;
        verifiedBackupId: string;
        preview: PaymentResetPreview;
        backups: PaymentBackupSummary[];
        message: string;
      }>('/api/admin/payments/reset-all', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    getBranding: () =>
      request<{
        branding: SiteBrandingData;
        founder: FounderProfileData;
        recentBackups: PaymentBackupSummary[];
      }>('/api/admin/branding'),

    updateBranding: (payload: Partial<SiteBrandingData>) =>
      request<{
        branding: SiteBrandingData;
        founder: FounderProfileData;
        message: string;
      }>('/api/admin/branding', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),

    updateFounder: (payload: Partial<FounderProfileData>) =>
      request<{
        branding: SiteBrandingData;
        founder: FounderProfileData;
        message: string;
      }>('/api/admin/founder', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),

    uploadBrandingAsset: (slot: 'logo' | 'favicon' | 'founder-photo', file: File) => {
      const fd = new FormData();
      fd.append('slot', slot);
      fd.append('file', file);
      return request<{
        slot: string;
        url: string;
        branding: SiteBrandingData;
        founder: FounderProfileData;
        message: string;
      }>('/api/admin/branding/upload', {
        method: 'POST',
        body: fd,
      });
    },

    listUsers: (filters?: { search?: string; status?: AccountStatus | '' }) => {
      const search = new URLSearchParams();
      if (filters?.search) search.set('search', filters.search);
      if (filters?.status) search.set('status', filters.status);
      const qs = search.toString();
      return request<{ users: SafeUser[] }>(`/api/admin/users${qs ? `?${qs}` : ''}`);
    },
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
    suspendUser: (id: string, reason?: string) =>
      request<{ user: SafeUser; message: string }>(`/api/admin/users/${id}/suspend`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    reactivateUser: (id: string) =>
      request<{ user: SafeUser; message: string }>(`/api/admin/users/${id}/reactivate`, {
        method: 'POST',
      }),
    deleteUser: (id: string, payload: { confirmation?: string; confirmEmail?: string }) =>
      request<{
        deletedId: string;
        deletedStudentRef: string;
        anonymizedPaymentsCount: number;
        message: string;
      }>(`/api/admin/users/${id}`, {
        method: 'DELETE',
        body: JSON.stringify(payload),
      }),
    sendUserNotification: (id: string, payload: { title: string; message: string }) =>
      request<{ notification: Record<string, unknown>; message: string }>(
        `/api/admin/users/${id}/notifications`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      ),
    listNotifications: (filters?: { search?: string; type?: NotificationType | '' }) => {
      const search = new URLSearchParams();
      if (filters?.search) search.set('search', filters.search);
      if (filters?.type) search.set('type', filters.type);
      const qs = search.toString();
      return request<{ notifications: AdminNotificationRecord[] }>(
        `/api/admin/notifications${qs ? `?${qs}` : ''}`
      );
    },

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

    getEmailStatus: (verify = false) =>
      request<AdminEmailStatusOverview>(
        `/api/admin/email/status${verify ? '?verify=true' : ''}`
      ),

    testEmailConnection: () =>
      request<{ ok: boolean; scopeNote?: string } & AdminEmailStatusOverview>(
        '/api/admin/email/test-connection',
        {
          method: 'POST',
        }
      ),

    sendTestEmail: (toEmail?: string) =>
      request<
        {
          ok: boolean;
          accepted?: boolean;
          deliveredConfirmed?: boolean;
          deliveryStatus?: string;
          message: string;
        } & AdminEmailStatusOverview
      >('/api/admin/email/send-test', {
        method: 'POST',
        body: JSON.stringify(toEmail ? { toEmail } : {}),
      }),
  },
};
