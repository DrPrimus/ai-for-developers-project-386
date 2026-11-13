import { BrowserRouter, Route, Routes } from 'react-router'

import { SiteHeader } from '@/components/layout/SiteHeader'
import { AdminPage } from '@/pages/AdminPage'
import { BookingPage } from '@/pages/BookingPage'
import { HomePage } from '@/pages/HomePage'

export function AppRoutes() {
  return (
    <div className="flex min-h-svh flex-col bg-muted/40">
      <SiteHeader />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/booking" element={<BookingPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

export default App
