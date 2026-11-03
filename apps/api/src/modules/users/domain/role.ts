/** The kinds of account: a user books courts; an admin manages them and sees every booking. */
export const Role = { USER: 'user', ADMIN: 'admin' } as const;

export type Role = (typeof Role)[keyof typeof Role];
