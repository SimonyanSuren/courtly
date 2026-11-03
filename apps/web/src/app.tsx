import { Navigate, Route, Routes } from 'react-router';

import { CourtManagementPage } from './admin/court-management-page';
import { DayViewPage } from './admin/day-view-page';
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
        {/* Where admins land after logging in. */}
        <Route path="/admin" element={<Navigate to="/admin/courts" replace />} />
        <Route path="/admin/courts" element={<CourtManagementPage />} />
        <Route path="/admin/bookings" element={<DayViewPage />} />
      </Route>
      {/* Any other path, including /: the login page sends a logged-in user on to their start page. */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
