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
import CameraSettings from './pages/settings/CameraSettings'
import ProtectedRoute from './middleware/auth/ProtectedRoute'
import RoleRoute from './middleware/auth/RoleRoute'
import SecurityLogs from './pages/settings/SecurityLogs'
import UserManagement from './pages/management/user/UserManagement'
import SystemSettings from './pages/settings/SystemSettings'

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
            element: <RoleRoute requiredPermission="AuthRmtDevice"><CameraManagement /></RoleRoute>
          },
          {
            path: "reports",
            element: <RoleRoute requiredPermission="AuthSysInfo"><Reports /></RoleRoute>
          },
          {
            path: "face",
            element: <RoleRoute requiredPermission="AuthSecurity"><FaceManagement /></RoleRoute>
          },
          {
            path: "users",
            element: <RoleRoute requiredPermission="AuthUserMag"><UserManagement /></RoleRoute>
          },
          {
            path: "live",
            element: <RoleRoute requiredPrefix="monitor_"><LiveMonitoring /></RoleRoute>
          },
          {
            path: "playback",
            element: <RoleRoute requiredPrefix="replay_"><Playback /></RoleRoute>
          },
          {
            path: "camera-setting",
            element: <RoleRoute requiredAnyPermissions={["AuthSysCfg", "AuthNetCfg", "AuthRmtDevice"]}><CameraSettings /></RoleRoute>
          },
          {
            path: "system-setting",
            element: <RoleRoute requiredPermission="AuthSysCfg"><SystemSettings /></RoleRoute>
          },
          {
            path: "security-logs",
            element: <RoleRoute requiredPermission="AuthSecurity"><SecurityLogs /></RoleRoute>
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
