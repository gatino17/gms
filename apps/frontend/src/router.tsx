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
import { PrivateRoute } from './components/PrivateRoute'
import { RequireSuperuser } from './components/RequireSuperuser'
import { LoginPage } from './routes/LoginPage'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <PrivateRoute />,
    children: [
      {
        path: '/',
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
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
          { path: 'settings', element: <SettingsPage /> },
        ],
      },
    ],
  },
])
