import { Alert, AppShell, Button, Center, Group, Loader, Text } from '@mantine/core';
import { Link, matchPath, Navigate, Outlet, useLocation } from 'react-router';

import { errorMessage } from '../api';
import { homePath, type Role, useCurrentUser, useLogout } from './session';

/** The links in each role's header. */
const navigation: Record<Role, Array<{ path: string; label: string }>> = {
  user: [
    { path: '/courts', label: 'Courts' },
    { path: '/bookings', label: 'My bookings' },
  ],
  admin: [
    { path: '/admin/courts', label: 'Courts' },
    { path: '/admin/bookings', label: 'Day view' },
  ],
};

/**
 * The frame of every page behind the login, for one role. It sends visitors without a session to
 * the login page and users of the other role to their own start page. This is for the user
 * experience only: the API checks the session and the role on every request.
 */
export function SignedInLayout({ role }: Readonly<{ role: Role }>): React.JSX.Element {
  const currentUser = useCurrentUser();
  const logout = useLogout();
  const { pathname } = useLocation();

  if (currentUser.isPending) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  if (currentUser.isError) {
    return (
      <Center h="100vh" p="md">
        <Alert color="red">{errorMessage(currentUser.error)}</Alert>
      </Center>
    );
  }

  const user = currentUser.data;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== role) {
    return <Navigate to={homePath(user.role)} replace />;
  }

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            {/* A phone's header has room for the links and the logout only. */}
            <Text size="xl" fw={700} visibleFrom="xs">
              Courtly
            </Text>
            <nav>
              <Group gap={4} wrap="nowrap">
                {navigation[role].map(({ path, label }) => {
                  // A link stays current on the pages below it, such as one court's page.
                  const isCurrent = matchPath(`${path}/*`, pathname) !== null;

                  return (
                    <Button
                      key={path}
                      size="compact-md"
                      component={Link}
                      to={path}
                      variant={isCurrent ? 'light' : 'subtle'}
                      aria-current={isCurrent ? 'page' : undefined}
                    >
                      {label}
                    </Button>
                  );
                })}
              </Group>
            </nav>
          </Group>
          <Group wrap="nowrap">
            {logout.isError && (
              <Text c="red" size="sm">
                {errorMessage(logout.error)}
              </Text>
            )}
            <Text visibleFrom="sm">{user.name}</Text>
            <Button
              size="compact-md"
              variant="default"
              loading={logout.isPending}
              onClick={() => {
                logout.mutate();
              }}
            >
              Log out
            </Button>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
