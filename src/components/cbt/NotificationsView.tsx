import {
  Bell,
  BookCheck,
  CheckCheck,
  Clock,
  ExternalLink,
  MailOpen,
  MessageCircle,
  Send,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import type { StudentNotificationItem } from '../../types/cbt';

interface NotificationsViewProps {
  notifications: StudentNotificationItem[];
  unreadCount: number;
  loading?: boolean;
  onMarkRead: (notificationId: string) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onStartCourseExam?: (courseId: string) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  notifications,
  unreadCount,
  loading = false,
  onMarkRead,
  onMarkAllRead,
  onStartCourseExam,
}) => {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(
    () => notifications[0]?.id ?? null
  );
  const [markingAll, setMarkingAll] = useState(false);

  const visibleItems = useMemo(() => {
    if (filter === 'unread') {
      return notifications.filter((n) => !n.isRead);
    }
    return notifications;
  }, [notifications, filter]);

  const activeNotification =
    visibleItems.find((n) => n.id === selectedId) ||
    notifications.find((n) => n.id === selectedId) ||
    visibleItems[0] ||
    null;

  const handleSelectNotification = async (item: StudentNotificationItem) => {
    setSelectedId(item.id);
    if (!item.isRead) {
      await onMarkRead(item.id);
    }
  };

  const handleMarkAll = async () => {
    setMarkingAll(true);
    try {
      await onMarkAllRead();
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="bg-[#0b337a] text-white px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <Bell className="w-5 h-5 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight leading-tight">
                Notification Centre
              </h2>
              <p className="text-xs text-blue-100 truncate">
                Course registration confirmations, tutorial group links, and admin messages.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-blue-100 tabular-nums">
              {unreadCount} unread
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                disabled={markingAll}
                onClick={handleMarkAll}
                className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold inline-flex items-center gap-1.5 min-h-[36px] disabled:opacity-60"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>{markingAll ? 'Updating...' : 'Mark all read'}</span>
              </button>
            )}
          </div>
        </div>

        <div className="p-3 sm:p-4 space-y-3">
          {/* Filter Controls */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#eff5ff] dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors tabular-nums ${
                  filter === 'all'
                    ? 'bg-[#0a58ed] text-white shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700'
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('unread')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors tabular-nums ${
                  filter === 'unread'
                    ? 'bg-[#0a58ed] text-white shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700'
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              Loading notifications...
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <MailOpen className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
              <div className="text-sm font-extrabold text-slate-800 dark:text-white">
                {filter === 'unread'
                  ? 'You have no unread notifications'
                  : 'No notifications yet'}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Course registration confirmations, tutorial group invites, and announcements from Acadet CBT administration will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
              {/* Notification List */}
              <div className="lg:col-span-5 divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-[460px] overflow-y-auto">
                {visibleItems.map((item) => {
                  const isSelected = activeNotification?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => void handleSelectNotification(item)}
                      className={`w-full text-left px-3.5 py-2.5 transition-colors flex flex-col gap-1 ${
                        isSelected
                          ? 'bg-[#eff5ff] dark:bg-blue-950/40'
                          : !item.isRead
                            ? 'bg-blue-50/40 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/70'
                            : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-bold text-[#0b337a] dark:text-blue-300 truncate">
                          {item.notificationType === 'payment_success'
                            ? 'Course Confirmation'
                            : 'Admin Message'}
                          {item.courseCode ? ` · ${item.courseCode}` : ''}
                        </span>
                        <span className="shrink-0 flex items-center gap-1 font-extrabold">
                          {!item.isRead ? (
                            <span className="inline-flex items-center gap-1 text-[#0a58ed] dark:text-blue-400">
                              <span className="w-2 h-2 rounded-full bg-[#0a58ed]" />
                              Unread
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500">Read</span>
                          )}
                        </span>
                      </div>

                      <div
                        className={`text-xs sm:text-sm leading-snug line-clamp-1 ${
                          !item.isRead
                            ? 'font-extrabold text-slate-900 dark:text-white'
                            : 'font-semibold text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {item.title}
                      </div>

                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="truncate">{item.senderName}</span>
                        <span className="shrink-0 tabular-nums">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Detail Reader Panel */}
              {activeNotification && (
                <div className="lg:col-span-7 rounded-xl border border-[#dce6f5] dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 p-3.5 sm:p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white leading-snug">
                        {activeNotification.title}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                          <Send className="w-3 h-3 text-[#0a58ed]" />
                          {activeNotification.senderName}
                        </span>
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Clock className="w-3 h-3" />
                          {new Date(activeNotification.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {!activeNotification.isRead ? (
                      <button
                        type="button"
                        onClick={() => void onMarkRead(activeNotification.id)}
                        className="px-2.5 py-1 rounded-lg bg-[#0a58ed] text-white text-xs font-bold shrink-0"
                      >
                        Mark as read
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                        <CheckCheck className="w-3.5 h-3.5" />
                        Read
                      </span>
                    )}
                  </div>

                  <div className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed">
                    {activeNotification.message}
                  </div>

                  {(activeNotification.actionUrl || activeNotification.courseId) && (
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-2">
                      {activeNotification.actionUrl && (
                        <a
                          href={activeNotification.actionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 min-h-[40px] shadow-xs transition-colors"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>
                            {activeNotification.actionLabel || 'Join Course Tutorial Group'}
                          </span>
                          <ExternalLink className="w-3.5 h-3.5 opacity-90" />
                        </a>
                      )}

                      {activeNotification.notificationType === 'payment_success' &&
                        activeNotification.courseId &&
                        onStartCourseExam && (
                          <button
                            type="button"
                            onClick={() => onStartCourseExam(activeNotification.courseId!)}
                            className="px-3.5 py-2 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 min-h-[40px]"
                          >
                            <BookCheck className="w-4 h-4" />
                            <span>Open Course CBT</span>
                          </button>
                        )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
