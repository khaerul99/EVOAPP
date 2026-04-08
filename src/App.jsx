import React from 'react'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/auth/Login'
import DashboardLayout from './pages/dashboard/DashboardLayout'
import DashboardHome from './pages/dashboard/DashboardHome'
import CameraManagement from './pages/management/CameraManagement'
import Reports from './pages/reports/Reports'
import FaceManagement from './pages/management/FaceManagement'
import Playback from './pages/management/Playback'
import ProtectedRoute from './middleware/auth/ProtectedRoute'

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/login" element={<Login />} />

                <Route element={<ProtectedRoute />}>
                    <Route path="/dashboard" element={<DashboardLayout />}>
                        <Route index element={<DashboardHome />} />
                        <Route path="camera" element={<CameraManagement />} />
                        <Route path="reports" element={<Reports />} />
                        <Route path="face" element={<FaceManagement />} />
                        <Route path="playback" element={<Playback />} />
                    </Route>
                </Route>

                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        </Router>
    )
}

export default App
