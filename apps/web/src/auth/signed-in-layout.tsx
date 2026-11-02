import { Alert, AppShell, Button, Center, Group, Loader, Text } from '@mantine/core';
import { Navigate, Outlet } from 'react-router';

import { errorMessage } from '../api';
import { homePath, type Role, useCurrentUser, useLogout } from './session';

/**
 * The frame of every page behind the login, for one role. It sends visitors without a session to
 * the login page and users of the other role to their own start page. This is for the user
 * experience only: the API checks the session and the role on every request.
 */
export function SignedInLayout({ role }: Readonly<{ role: Role }>): React.JSX.Element {
  const currentUser = useCurrentUser();
  const logout = useLogout();

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
        <Group h="100%" px="md" justify="space-between">
          <Text size="xl" fw={700}>
            Courtly
          </Text>
          <Group>
            {logout.isError && (
              <Text c="red" size="sm">
                {errorMessage(logout.error)}
              </Text>
            )}
            <Text>{user.name}</Text>
            <Button
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
