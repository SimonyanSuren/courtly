import {
  Alert,
  Button,
  Center,
  Container,
  Loader,
  Paper,
  PasswordInput,
  Stack,
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
    <Container size="xs" py="xl">
      <Title ta="center" mb="lg">
        Courtly
      </Title>
      <Paper withBorder p="lg" radius="md">
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
    </Container>
  );
}
