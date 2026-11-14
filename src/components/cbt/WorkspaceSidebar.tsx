import {
  BarChart3,
  Bell,
  BookCheck,
  BookOpen,
  CreditCard,
  FileText,
  HelpCircle,
  History,
  Home,
  LogOut,
  Settings,
  Shield,
  ShieldCheck,
  X,
} from 'lucide-react';
import React from 'react';
import type { UserRole } from '../../types/cbt';

export type WorkspaceTab =
  | 'home'
  | 'catalogue'
  | 'my-courses'
  | 'payment-verification'
  | 'payment-history'
  | 'notifications'
  | 'results'
  | 'materials'
  | 'practice'
  | 'help'
  | 'admin';

interface WorkspaceSidebarProps {
  activeTab: WorkspaceTab;
  role: UserRole;
  mobileOpen: boolean;
  mobileOnly?: boolean;
  unreadNotifications?: number;
  onCloseMobile: () => void;
  onSelectTab: (tab: WorkspaceTab) => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
  activeTab,
  role,
  mobileOpen,
  mobileOnly = false,
  unreadNotifications = 0,
  onCloseMobile,
  onSelectTab,
  onOpenSettings,
  onLogout,
}) => {
  const isAdmin = role === 'admin' || role === 'super_admin';

  const navItems: Array<{
    id: WorkspaceTab | 'settings';
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }> = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'catalogue', label: 'Course Registration', icon: CreditCard },
    { id: 'my-courses', label: 'My Registered Courses', icon: BookCheck },
    { id: 'payment-verification', label: 'Payment Verification', icon: ShieldCheck },
    { id: 'payment-history', label: 'My Payment History', icon: History },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      badge: unreadNotifications > 0 ? unreadNotifications : undefined,
    },
    { id: 'practice', label: 'Course Examinations', icon: FileText },
    { id: 'results', label: 'Course Results', icon: BarChart3 },
    { id: 'materials', label: 'Study Materials', icon: BookOpen },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'help', label: 'Help & Support', icon: HelpCircle },
    ...(isAdmin ? [{ id: 'admin' as const, label: 'Admin Console', icon: Shield }] : []),
  ];

  const renderLinks = (afterClick?: () => void) => (
    <div className="flex flex-col h-full justify-between py-4 px-3">
      <nav className="space-y-1.5" aria-label="Workspace navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.id !== 'settings' && activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id === 'settings') {
                  onOpenSettings();
                } else {
                  onSelectTab(item.id);
                }
                afterClick?.();
              }}
              className={`w-full flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl text-sm font-bold transition-colors min-h-[42px] ${
                isActive
                  ? 'bg-[#0a58ed] text-white shadow-sm'
                  : 'text-blue-100/90 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon className="w-5 h-5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </span>
              {item.badge !== undefined && (
                <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[11px] font-extrabold tabular-nums leading-none shrink-0">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="pt-4 border-t border-white/15">
        <button
          type="button"
          onClick={() => {
            afterClick?.();
            onLogout();
          }}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold text-blue-100 hover:bg-red-500/20 hover:text-white transition-colors min-h-[44px]"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {!mobileOnly && (
        <aside className="hidden lg:flex w-60 shrink-0 bg-[#072661] text-white flex-col border-r border-white/10">
          {renderLinks()}
        </aside>
      )}

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-[1px]"
            onClick={onCloseMobile}
          />
          <aside className="relative z-10 w-68 bg-[#072661] text-white flex flex-col h-full shadow-2xl">
            <div className="px-4 py-3.5 border-b border-white/15 flex items-center justify-between">
              <span className="font-extrabold text-base">Acadet Menu</span>
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Close navigation menu"
                className="p-2 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{renderLinks(onCloseMobile)}</div>
          </aside>
        </div>
      )}
    </>
  );
};
