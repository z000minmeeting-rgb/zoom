import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import { SplashScreen } from './components/SplashScreen';
import { WelcomeScreen } from './components/WelcomeScreen';
import { LoginScreen } from './components/LoginScreen';
import { SignUpScreen } from './components/SignUpScreen';
import { AdminLoginScreen } from './components/AdminLoginScreen';
import { JoinMeetingScreen } from './components/JoinMeetingScreen';
import { SubscriptionPackagesScreen } from './components/SubscriptionPackagesScreen';
import { SubscriptionRegistrationScreen } from './components/SubscriptionRegistrationScreen';
import { UserVerificationChatScreen } from './components/UserVerificationChatScreen';
import { LoadingScreen } from './components/LoadingScreen';
import { DashboardScreen } from './components/DashboardScreen';
import { MeetingsScreen } from './components/MeetingsScreen';
import { TeamChatScreen } from './components/TeamChatScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { AdminDashboardScreen } from './components/AdminDashboardScreen';
import { AdminSubscriptionSettingsScreen } from './components/AdminSubscriptionSettingsScreen';
import { AdminVerificationChatsScreen } from './components/AdminVerificationChatsScreen';
import { AdminSubscribersScreen } from './components/AdminSubscribersScreen';
import { AdminMediaGalleryScreen } from './components/AdminMediaGalleryScreen';
import { Sidebar } from './components/Sidebar';
import { AIAssistantPanel } from './components/AIAssistantPanel';
import { MobileBottomNav } from './components/MobileBottomNav';
import { UserProvider, useUser } from './context/UserContext';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import { PlaceholderWorkspaceScreen } from './components/workspace/PlaceholderWorkspaceScreen';

const workspacePaths = ['/home', '/dashboard', '/meetings', '/team-chat', '/mail', '/calendar', '/whiteboards', '/contacts', '/settings'];

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useUser();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useUser();

  if (isAuthenticated) {
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
}

function WorkspaceRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      {children}
    </ProtectedRoute>
  );
}

function AdminRoute({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { isAdminAuthenticated, isCheckingAdmin } = useAdminAuth();

  if (isCheckingAdmin) {
    return <LoadingScreen />;
  }

  if (!isAdminAuthenticated) {
    return <Navigate to={`/admin/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  return <>{children}</>;
}

function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { isAuthenticated } = useUser();
  const { isAdminAuthenticated } = useAdminAuth();
  const isAdminPath = location.pathname.startsWith('/admin');
  const isAdminLoginPath = location.pathname === '/admin/login';
  const showLayout = (isAuthenticated && workspacePaths.includes(location.pathname))
    || (isAdminAuthenticated && isAdminPath && !isAdminLoginPath);

  if (!showLayout) {
    return <>{children}</>;
  }

  return (
    <div className="size-full flex overflow-hidden">
      <Sidebar />
      {children}
      {!isAdminPath && <AIAssistantPanel />}
      {!isAdminPath && <MobileBottomNav />}
    </div>
  );
}

function MeetingLinkRedirect() {
  const location = useLocation();
  const { meetingToken = '' } = useParams();
  const searchParams = new URLSearchParams(location.search);
  searchParams.set('meetingLink', meetingToken);

  return <Navigate to={`/join?${searchParams.toString()}`} replace />;
}

export default function App() {
  return (
    <UserProvider>
      <AdminAuthProvider>
        <BrowserRouter>
          <AppLayout>
            <Routes>
              <Route path="/" element={<Navigate to="/splash" replace />} />
              <Route path="/splash" element={<SplashScreen />} />
              <Route path="/welcome" element={<WelcomeScreen />} />
              <Route path="/login" element={<PublicOnlyRoute><LoginScreen /></PublicOnlyRoute>} />
              <Route path="/signup" element={<PublicOnlyRoute><SignUpScreen /></PublicOnlyRoute>} />
              <Route path="/admin/login" element={<AdminLoginScreen />} />
              <Route path="/call/:meetingToken" element={<MeetingLinkRedirect />} />
              <Route path="/join" element={<JoinMeetingScreen />} />
              <Route path="/subscription" element={<SubscriptionPackagesScreen />} />
              <Route path="/subscription/register" element={<SubscriptionRegistrationScreen />} />
              <Route path="/verification-chat/:threadId" element={<UserVerificationChatScreen />} />
              <Route path="/loading" element={<LoadingScreen />} />
              <Route path="/dashboard" element={<Navigate to="/home" replace />} />
              <Route path="/home" element={<WorkspaceRoute><DashboardScreen /></WorkspaceRoute>} />
              <Route path="/meetings" element={<WorkspaceRoute><MeetingsScreen /></WorkspaceRoute>} />
              <Route path="/team-chat" element={<WorkspaceRoute><TeamChatScreen /></WorkspaceRoute>} />
              <Route path="/mail" element={<WorkspaceRoute><PlaceholderWorkspaceScreen title="Mail" description="Manage workspace messages" /></WorkspaceRoute>} />
              <Route path="/calendar" element={<WorkspaceRoute><PlaceholderWorkspaceScreen title="Calendar" description="Review upcoming workspace events" /></WorkspaceRoute>} />
              <Route path="/whiteboards" element={<WorkspaceRoute><PlaceholderWorkspaceScreen title="Whiteboards" description="Create and review shared boards" /></WorkspaceRoute>} />
              <Route path="/contacts" element={<WorkspaceRoute><PlaceholderWorkspaceScreen title="Contacts" description="Browse people in your workspace" /></WorkspaceRoute>} />
              <Route path="/settings" element={<WorkspaceRoute><SettingsScreen /></WorkspaceRoute>} />
              <Route path="/admin" element={<AdminRoute><AdminDashboardScreen /></AdminRoute>} />
              <Route path="/admin/settings" element={<AdminRoute><AdminSubscriptionSettingsScreen /></AdminRoute>} />
              <Route path="/admin/chats" element={<AdminRoute><AdminVerificationChatsScreen /></AdminRoute>} />
              <Route path="/admin/chats/:threadId" element={<AdminRoute><AdminVerificationChatsScreen /></AdminRoute>} />
              <Route path="/admin/subscribers" element={<AdminRoute><AdminSubscribersScreen /></AdminRoute>} />
              <Route path="/admin/media" element={<AdminRoute><AdminMediaGalleryScreen /></AdminRoute>} />
              <Route path="/admin/clients/:clientId" element={<AdminRoute><AdminDashboardScreen /></AdminRoute>} />
              <Route path="*" element={<Navigate to="/splash" replace />} />
            </Routes>
          </AppLayout>
        </BrowserRouter>
      </AdminAuthProvider>
    </UserProvider>
  );
}
