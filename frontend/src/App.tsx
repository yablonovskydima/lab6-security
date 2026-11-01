import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { GuestOnly, RequireAdmin, RequireAuth } from './auth/guards'
import { Layout } from './components/Layout'
import { ActivatePage } from './pages/ActivatePage'
import { AdminLoginLogPage } from './pages/admin/AdminLoginLogPage'
import { AdminOrdersPage } from './pages/admin/AdminOrdersPage'
import { AdminProductsPage } from './pages/admin/AdminProductsPage'
import { AdminUsersPage } from './pages/admin/AdminUsersPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { LoginPage } from './pages/LoginPage'
import { MyOrdersPage } from './pages/MyOrdersPage'
import { OAuthCallbackPage } from './pages/OAuthCallbackPage'
import { ProductsPage } from './pages/ProductsPage'
import { ProfilePage } from './pages/ProfilePage'
import { RegisterPage } from './pages/RegisterPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'

function Home() {
  const { user, loading } = useAuth()
  if (loading) return null
  return <Navigate to={user ? '/products' : '/login'} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="login" element={<GuestOnly><LoginPage /></GuestOnly>} />
            <Route path="register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="reset-password" element={<ResetPasswordPage />} />
            <Route path="activate" element={<ActivatePage />} />
            <Route path="oauth/callback" element={<OAuthCallbackPage />} />

            <Route path="profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
            <Route path="products" element={<RequireAuth><ProductsPage /></RequireAuth>} />
            <Route path="orders" element={<RequireAuth><MyOrdersPage /></RequireAuth>} />

            <Route path="admin/users" element={<RequireAdmin><AdminUsersPage /></RequireAdmin>} />
            <Route path="admin/login-log" element={<RequireAdmin><AdminLoginLogPage /></RequireAdmin>} />
            <Route path="admin/products" element={<RequireAdmin><AdminProductsPage /></RequireAdmin>} />
            <Route path="admin/orders" element={<RequireAdmin><AdminOrdersPage /></RequireAdmin>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
