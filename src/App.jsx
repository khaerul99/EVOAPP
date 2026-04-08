import React from 'react'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/auth/Login'
import DashboardLayout from './pages/DashboardLayout'
import DashboardHome from './pages/DashboardHome'
import CameraManagement from './pages/CameraManagement'
import Reports from './pages/Reports'
import FaceManagement from './pages/FaceManagement'
import Playback from './pages/Playback'
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

                <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Routes>
        </Router>

)
}

export default App
