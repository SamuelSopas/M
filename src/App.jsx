import React from 'react'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useAppContext } from './context/AppContext'
import Home from './pages/Home'
import Login from './pages/Login'
import Habits from './pages/Habits'
import Finance from './pages/Finance'
import Studies from './pages/Studies'
import Running from './pages/Running'
import Books from './pages/Books'
import Profile from './pages/Profile'
import Payment from './pages/Payment'
import MasterDashboard from './pages/MasterDashboard'
import './index.css'

const PrivateRoute = ({ children }) => {
  const { currentUser } = useAppContext()
  return currentUser ? children : <Navigate to="/login" />
}

const MasterRoute = ({ children }) => {
  const { currentUser } = useAppContext()
  return (currentUser === 'MASTER') ? children : <Navigate to="/dashboard" />
}

function AppContent() {
  const { currentUser } = useAppContext()

  React.useEffect(() => {
    // Forçar modo mobile-first por padrão conforme solicitado
    document.body.classList.add('is-mobile');
  }, [])

  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<PrivateRoute><Home /></PrivateRoute>} />
      <Route path="/habits" element={<PrivateRoute><Habits /></PrivateRoute>} />
      <Route path="/finance" element={<PrivateRoute><Finance /></PrivateRoute>} />
      <Route path="/studies" element={<PrivateRoute><Studies /></PrivateRoute>} />
      <Route path="/running" element={<PrivateRoute><Running /></PrivateRoute>} />
      <Route path="/books" element={<PrivateRoute><Books /></PrivateRoute>} />
      <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
      <Route path="/payment" element={<PrivateRoute><Payment /></PrivateRoute>} />
      <Route path="/master" element={<MasterRoute><MasterDashboard /></MasterRoute>} />
    </Routes>
  )
}

function App() {
  return (
    <AppProvider>
      <Router>
        <div className="hub-container">
          <AppContent />
        </div>
      </Router>
    </AppProvider>
  )
}

export default App
