import {
  Alert,
  Button,
  Center,
  Loader,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { type SubmitEvent, useState } from 'react';
import { Navigate } from 'react-router';

import { ApiError, errorMessage } from '../api';
import { homePath, useCurrentUser, useLogin } from './session';

export function LoginPage(): React.JSX.Element {
  const currentUser = useCurrentUser();
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (currentUser.data) {
    return <Navigate to={homePath(currentUser.data.role)} replace />;
  }

  if (currentUser.isPending) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  const fieldErrors = login.error instanceof ApiError ? login.error.fieldErrors : {};

  function handleSubmit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    login.mutate({ email, password });
  }

  return (
    <Center mih="100dvh" p="md" bg="gray.0">
      <Stack w="100%" maw={400}>
        <div>
          <Title ta="center" c="teal.7">
            Courtly
          </Title>
          <Text ta="center" c="dimmed">
            Sports court booking
          </Text>
        </div>
        <Paper withBorder shadow="sm" p="xl">
          <form onSubmit={handleSubmit}>
            <Stack>
              {login.isError && <Alert color="red">{errorMessage(login.error)}</Alert>}
              <TextInput
                label="Email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => {
                  setEmail(event.currentTarget.value);
                }}
                error={fieldErrors.email}
              />
              <PasswordInput
                label="Password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => {
                  setPassword(event.currentTarget.value);
                }}
                error={fieldErrors.password}
              />
              <Button type="submit" loading={login.isPending}>
                Log in
              </Button>
            </Stack>
          </form>
        </Paper>
      </Stack>
    </Center>
  );
}
