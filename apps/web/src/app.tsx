import { Navigate, Route, Routes } from 'react-router';

import { AdminPage } from './admin/admin-page';
import { LoginPage } from './auth/login-page';
import { SignedInLayout } from './auth/signed-in-layout';
import { BookingsPage } from './bookings/bookings-page';
import { CourtPage } from './courts/court-page';
import { CourtsPage } from './courts/courts-page';

export function App(): React.JSX.Element {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<SignedInLayout role="user" />}>
        <Route path="/courts" element={<CourtsPage />} />
        <Route path="/courts/:courtId" element={<CourtPage />} />
        <Route path="/bookings" element={<BookingsPage />} />
      </Route>
      <Route element={<SignedInLayout role="admin" />}>
        <Route path="/admin" element={<AdminPage />} />
      </Route>
      {/* Any other path, including /: the login page sends a logged-in user on to their start page. */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
