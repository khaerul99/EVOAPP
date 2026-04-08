import React from 'react'
import { HashRouter as Navigate, createBrowserRouter, RouterProvider } from 'react-router-dom'
import Login from './pages/auth/Login'
import DashboardLayout from './pages/dashboard/DashboardLayout'
import DashboardHome from './pages/dashboard/DashboardHome'
import CameraManagement from './pages/management/CameraManagement'
import Reports from './pages/reports/Reports'
import FaceManagement from './pages/management/FaceManagement'
import Playback from './pages/management/Playback'
import ProtectedRoute from './middleware/auth/ProtectedRoute'



const routes = createBrowserRouter([
  {
    path: "/auth/login",
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
            path: "playback",
            element: <Playback />
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
