export interface SeedUser {
  email: string;
  name: string;
  password: string;
  role: 'USER' | 'ADMIN';
  bio: string;
  isActive?: boolean;
}

/** Demo accounts — documented in README.md. Passwords satisfy the Phase 7 password policy. */
export const DEMO_ACCOUNTS = {
  admin: { email: 'admin@aether.dev', password: 'Admin@123456' },
  demo: { email: 'demo@aether.dev', password: 'Demo@123456' },
} as const;

export const seedUsers: SeedUser[] = [
  {
    ...DEMO_ACCOUNTS.admin,
    name: 'Aether Admin',
    role: 'ADMIN',
    bio: 'Platform administrator with full access to users and products.',
  },
  {
    ...DEMO_ACCOUNTS.demo,
    name: 'Demo User',
    role: 'USER',
    bio: 'Explore the API Tester with the ready-made Quick Start collection.',
  },
  {
    email: 'linh.nguyen@aether.dev',
    password: 'Member@123456',
    name: 'Nguyễn Thảo Linh',
    role: 'USER',
    bio: 'QA engineer who loves edge cases and boundary values.',
  },
  {
    email: 'minh.tran@aether.dev',
    password: 'Member@123456',
    name: 'Trần Quang Minh',
    role: 'USER',
    bio: 'Backend developer working on payment APIs.',
  },
  {
    email: 'sofia.martinez@aether.dev',
    password: 'Member@123456',
    name: 'Sofia Martinez',
    role: 'USER',
    bio: 'Product designer prototyping API-driven interfaces.',
  },
  {
    email: 'kenji.sato@aether.dev',
    password: 'Member@123456',
    name: 'Kenji Sato',
    role: 'USER',
    bio: 'Former contractor — account deactivated.',
    isActive: false,
  },
];
