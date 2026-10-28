import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Routes, Route, useLocation, useParams } from 'react-router-dom';
import { useAuth } from './contexts/auth-api';
import { loginDestination } from './contexts/auth-session';
import { SerialProvider } from './contexts/SerialContext';
import { TelemetryProvider } from './contexts/TelemetryContext';
import TelemetryControls from './components/groundstation/TelemetryControls';
import Header from './components/layout/Header';
import LoadingScreen from './components/common/LoadingScreen';
import NotFoundPage from './pages/NotFoundPage';
import LmsLayout from './components/classes/LmsLayout';
import LabEntry from './components/classes/LabEntry';

const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'));
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage'));
const AdminSignUpPage = lazy(() => import('./pages/AdminSignUpPage'));
const ClassesPage = lazy(() => import('./pages/ClassesPage'));
const ClassDetailPage = lazy(() => import('./pages/ClassDetailPage'));
const ClassCurriculumPage = lazy(() => import('./pages/ClassCurriculumPage'));
const ClassLearningPage = lazy(() => import('./pages/ClassLearningPage'));
const LearningPathPage = lazy(() => import('./pages/LearningPathPage'));
const QuestionBankPage = lazy(() => import('./pages/QuestionBankPage'));
const ClassProgressPage = lazy(() => import('./pages/ClassProgressPage'));
const ClassReportPage = lazy(() => import('./pages/ClassReportPage'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));

const HomePage = lazy(() => import('./pages/HomePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignUpPage = lazy(() => import('./pages/SignUpPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const labLoaders = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => () => import(`./pages/Lab${i}.jsx`));
const labComponents = labLoaders.map((load) => lazy(load));
// Warm the legacy Lab chunks so changing Labs does not show the route-level fallback.
labLoaders.forEach(load => load());

const AUTH_ROUTES = ['/login', '/signup'];
const APP_ROUTES = ['/', '/profile', ...Array.from({ length: 9 }, (_, index) => `/lab${index}`)];

function AuthPage({ children }) {
  const { loading, isAuthenticated, user } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingScreen />;
  if (isAuthenticated) {
    if (user?.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
    return <Navigate to={loginDestination(location.state?.from)} replace />;
  }
  return children;
}

function ProtectedServices() {
  const { loading, user } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingScreen />;
  if (!user && location.pathname !== '/lab0') return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}${location.hash}` }} />;
  return <SerialProvider key={user?.id || 'guest'}><TelemetryProvider><ServiceLayout /></TelemetryProvider></SerialProvider>;
}

function PublicLayout() {
  const location = useLocation();
  const normalizedPath = location.pathname.length > 1 ? location.pathname.replace(/\/+$/, '') : location.pathname;
  const isPreview = normalizedPath === '/preview';
  return <SerialProvider>
    <div className="app-container">
      {!isPreview && <Header />}
      <main id="main-content" className="main-content">
        <Outlet />
      </main>
    </div>
  </SerialProvider>;
}

function LegacyLabGate({ labId, children }) {
  const { classMode } = useAuth();
  if (classMode === null) return <LoadingScreen />;
  return classMode ? <LabEntry labId={labId}>{children}</LabEntry> : children;
}

function LegacyLabRoute({ labId }) {
  const { user } = useAuth();
  const Component = Number.isInteger(labId) ? labComponents[labId] : null;
  if (!Component) return <NotFoundPage />;
  if (!user && labId === 0) return <ClassLearningPage experience />;
  return <LegacyLabGate labId={labId}><Component /></LegacyLabGate>;
}

function LegacyLabAliasRedirect() {
  const { labId } = useParams();
  return <Navigate to={`/lab${labId}`} replace />;
}

function ServiceLayout() {
  const location = useLocation();
  const normalizedPath = location.pathname.length > 1 ? location.pathname.replace(/\/+$/, '') : location.pathname;
  const isAuthRoute = AUTH_ROUTES.includes(normalizedPath);
  const isClassRoute = /^\/classes(?:\/\d+(?:\/(?:curriculum|learn|path|progress|report|labs\/[0-8]\/questions))?)?$/.test(normalizedPath) || ['/admin/users', '/admin/dashboard'].includes(normalizedPath) || normalizedPath === '/preview';
  const isNotFoundRoute = !isAuthRoute && !isClassRoute && !APP_ROUTES.includes(normalizedPath);
  const isLabRoute = /^\/lab[0-8]$/.test(normalizedPath);

  return (
    <>
      <Suspense fallback={<LoadingScreen />}>
        <div className="app-container">
          {!isAuthRoute && !isNotFoundRoute && <a className="skip-link" href="#main-content">Bỏ qua đến nội dung chính</a>}
          {!isAuthRoute && !isNotFoundRoute && <Header />}
          <main id="main-content" className={isAuthRoute || isNotFoundRoute ? '' : `main-content${isLabRoute ? ' is-lab-route' : ''}`}>
            {!isAuthRoute && !isNotFoundRoute && !isLabRoute && !isClassRoute && <TelemetryControls />}
            <Outlet />
          </main>
        </div>
      </Suspense>
    </>
  );
}

export default function App() {
  return <Suspense fallback={<LoadingScreen />}><Routes>
    <Route path="/login" element={<AuthPage><LoginPage /></AuthPage>} />
    <Route path="/signup" element={<AuthPage><SignUpPage /></AuthPage>} />
    <Route path="/admin/login" element={<AdminLoginPage />} />
    <Route path="/admin/signup" element={<AdminSignUpPage />} />
    <Route element={<PublicLayout />}>
      <Route path="/" element={<HomePage />} />
      <Route element={<LmsLayout publicPreview />}>
        <Route path="/preview" element={<ClassLearningPage experience />} />
      </Route>
    </Route>
    <Route element={<ProtectedServices />}>
      <Route path="/profile" element={<ProfilePage />} />
      <Route element={<LmsLayout />}>
        <Route path="/classes" element={<ClassesPage />} />
        <Route path="/classes/lab:labId" element={<LegacyLabAliasRedirect />} />
        <Route path="/classes/:classId" element={<ClassDetailPage />} />
        <Route element={<LmsLayout roles={['admin', 'teacher']} />}>
          <Route path="/classes/:classId/curriculum" element={<ClassCurriculumPage />} />
          <Route path="/classes/:classId/labs/:labId/questions" element={<QuestionBankPage />} />
          <Route path="/classes/:classId/progress" element={<ClassProgressPage />} />
          <Route path="/classes/:classId/report" element={<ClassReportPage />} />
        </Route>
        <Route path="/classes/:classId/learn" element={<ClassLearningPage experience={false} />} />
        <Route path="/classes/:classId/path" element={<LearningPathPage />} />
      </Route>
      <Route element={<LmsLayout roles={['admin']} />}>
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
      </Route>
      {labComponents.map((_, labId) => (
        <Route key={labId} path={`/lab${labId}`} element={<LegacyLabRoute labId={labId} />} />
      ))}
      <Route path="*" element={<NotFoundPage />} />
    </Route>
  </Routes></Suspense>;
}
