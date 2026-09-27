export const TEST_USER_IDS = [
  "test-gm",
  "test-master",
  "test-player-a",
  "test-player-b",
  "test-rate-limit",
] as const;

export type TestUserId = (typeof TEST_USER_IDS)[number];

export type TestUserSeed = {
  discordId: TestUserId;
  email: `${TestUserId}@localhost`;
  name: string;
};

export const TEST_USERS: readonly TestUserSeed[] = [
  { discordId: "test-gm", email: "test-gm@localhost", name: "Test GM" },
  {
    discordId: "test-master",
    email: "test-master@localhost",
    name: "Test Master",
  },
  {
    discordId: "test-player-a",
    email: "test-player-a@localhost",
    name: "Test Player A",
  },
  {
    discordId: "test-player-b",
    email: "test-player-b@localhost",
    name: "Test Player B",
  },
  {
    discordId: "test-rate-limit",
    email: "test-rate-limit@localhost",
    name: "Test Rate Limit",
  },
];

export function isTestUserId(value: string): value is TestUserId {
  return (TEST_USER_IDS as readonly string[]).includes(value);
}

export function findTestUser(discordId: string | undefined): TestUserSeed | undefined {
  if (!discordId || !isTestUserId(discordId)) return undefined;
  return TEST_USERS.find((user) => user.discordId === discordId);
}
