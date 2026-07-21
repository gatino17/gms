import { createBrowserRouter } from 'react-router-dom'
import AppLayout from './ui/AppLayout'
import DashboardPage from './routes/DashboardPage'
import StudentsPage from './routes/StudentsPage'
import StudentDetailPage from './routes/StudentDetailPage'
import StudentRenewPage from './routes/StudentRenewPage'
import CoursesPage from './routes/CoursesPage'
import PaymentsPage from './routes/PaymentsPage'
import PaymentsTeachers from './routes/PaymentsTeachers'
import CourseStatusPage from './routes/CourseStatusPage'
import CourseStatusByGenderPage from './routes/CourseStatusByGenderPage'
import TeachersPage from './routes/TeachersPage'
import CalendarPage from './routes/CalendarPage'
import CourseDetailPage from './routes/CourseDetailPage'
import StudiosPage from './routes/StudiosPage'
import SettingsPage from './routes/SettingsPage'
import AnnouncementsPage from './routes/AnnouncementsPage'
import { PrivateRoute } from './components/PrivateRoute'
import { RequireSuperuser } from './components/RequireSuperuser'
import { LoginPage } from './routes/LoginPage'
import AttendanceKioskPage from './routes/AttendanceKioskPage'
import LandingPage from './routes/LandingPage'
import MobileLayout from './mobile/MobileLayout'
import { MobileIndexRedirect, MobileRequireSession } from './mobile/MobileApp'
import MobileLogin from './mobile/routes/MobileLogin'
import MobileHome from './mobile/routes/MobileHome'
import StudentPortal from './mobile/routes/StudentPortal'
import TeacherPortal from './mobile/routes/TeacherPortal'
import MobileAnnouncements from './mobile/routes/MobileAnnouncements'
import MobilePayments from './mobile/routes/MobilePayments'
import StaffLogin from './mobile/routes/StaffLogin'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/mobile',
    element: <MobileIndexRedirect />,
  },
  {
    path: '/mobile/login',
    element: <MobileLogin />,
  },
  {
    path: '/mobile/:studioSlug',
    element: <MobileLogin />,
  },
  {
    path: '/mobile/staff',
    element: <StaffLogin />,
  },
  {
    path: '/mobile/staff/:studioSlug',
    element: <StaffLogin />,
  },
  {
    element: <MobileRequireSession />,
    children: [
      {
        element: <MobileLayout />,
        children: [
          { path: '/mobile/home', element: <MobileHome /> },
          { path: '/mobile/student', element: <StudentPortal /> },
          { path: '/mobile/teacher', element: <TeacherPortal /> },
          { path: '/mobile/announcements', element: <MobileAnnouncements /> },
          { path: '/mobile/payments', element: <MobilePayments /> },
        ],
      },
    ],
  },
  {
    element: <PrivateRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/dashboard', element: <DashboardPage /> },
          { path: 'students', element: <StudentsPage /> },
          { path: 'students/:id', element: <StudentDetailPage /> },
          { path: 'students/:id/renew', element: <StudentRenewPage /> },
          { path: 'courses', element: <CoursesPage /> },
          { path: 'teachers', element: <TeachersPage /> },
          { path: 'course-status', element: <CourseStatusPage /> },
          { path: 'course-status-gender', element: <CourseStatusByGenderPage /> },
          { path: 'courses/:id', element: <CourseDetailPage /> },
          { path: 'calendar', element: <CalendarPage /> },
          { path: 'payments', element: <PaymentsPage /> },
          { path: 'payments-teachers', element: <PaymentsTeachers /> },
          { path: 'studios', element: <RequireSuperuser><StudiosPage /></RequireSuperuser> },
          { path: 'announcements', element: <AnnouncementsPage /> },
          { path: 'settings', element: <SettingsPage /> },
        ],
      },
      {
        path: '/asistencia',
        element: <AttendanceKioskPage />,
      },
    ],
  },
])
