import React from 'react'
import { Navigate, createBrowserRouter, RouterProvider } from 'react-router-dom'
import Login from './pages/auth/Login'
import DashboardLayout from './pages/dashboard/DashboardLayout'
import DashboardHome from './pages/dashboard/DashboardHome'
import CameraManagement from './pages/management/camera/CameraManagement'
import Reports from './pages/reports/Reports'
import FaceManagement from './pages/management/face/FaceManagement'
import LiveMonitoring from './pages/management/live/LiveMonitoring'
import Playback from './pages/management/playback/Playback'
import SystemSettings from './pages/settings/SystemSettings'
import ProtectedRoute from './middleware/auth/ProtectedRoute'
import SecurityLogs from './pages/settings/SecurityLogs'
import UserManagement from './pages/management/user/UserManagement'

const routes = createBrowserRouter([
  {
    path: "/login",
    element: <Login />
  },
  {
    path: "/",
    element: <Navigate to="/dashboard" replace /> 
  },
  {
    
    element: <ProtectedRoute />, 
    children: [
      {
        path: "/dashboard",
        element: <DashboardLayout />,
        children: [
          {
            index: true,
            element: <DashboardHome />
          },
          {
            path: "camera",
            element: <CameraManagement />
          },
          {
            path: "reports",
            element: <Reports />
          },
          {
            path: "face",
            element: <FaceManagement />
          },
          {
            path: "users",
            element: <UserManagement />
          },
          {
            path: "live",
            element: <LiveMonitoring />
          },
          {
            path: "playback",
            element: <Playback />
          },
          {
            path: "system-settings",
            element: <SystemSettings />
          },
          {
            path: "security-logs",
            element: <SecurityLogs />
          }
        ]
      }
    ]
  }
]);

function App() {
    return (
        <RouterProvider router={routes} />
    )
}

export default App
