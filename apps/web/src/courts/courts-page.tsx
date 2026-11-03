import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { Link } from 'react-router';

import { errorMessage } from '../api';
import { formatHour, formatPrice } from '../format';
import { useCourts } from './courts';

function CourtList(): React.JSX.Element {
  const courts = useCourts();

  if (courts.isPending) {
    return <Loader />;
  }

  if (courts.isError) {
    return <Alert color="red">{errorMessage(courts.error)}</Alert>;
  }

  if (courts.data.length === 0) {
    return <Text>There are no courts to book right now.</Text>;
  }

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
      {courts.data.map((court) => (
        <Card key={court.id} withBorder>
          <Stack gap="xs">
            <Group justify="space-between">
              <Title order={2} size="h3">
                {court.name}
              </Title>
              <Badge variant="light">{court.sport}</Badge>
            </Group>
            <Text>{formatPrice(court.hourlyPriceCents)} per hour</Text>
            <Text c="dimmed">
              Open {formatHour(court.openingHour)}–{formatHour(court.closingHour)}
            </Text>
            <Button
              component={Link}
              to={`/courts/${court.id}`}
              aria-label={`See availability at ${court.name}`}
            >
              See availability
            </Button>
          </Stack>
        </Card>
      ))}
    </SimpleGrid>
  );
}

export function CourtsPage(): React.JSX.Element {
  return (
    <Stack>
      <Title>Courts</Title>
      <CourtList />
    </Stack>
  );
}
