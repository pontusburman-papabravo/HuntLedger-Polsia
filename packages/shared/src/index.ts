/**
 * @huntledger/shared
 *
 * Domain types and zod schemas shared between the React frontend and Fastify
 * backend. Keeping them here means that contracts cannot drift between client
 * and server.
 *
 * Conventions:
 *  - All ids are opaque strings (UUIDs in practice).
 *  - All timestamps are ISO 8601 strings (`new Date().toISOString()`).
 *  - Optional fields are explicitly `.optional()`.
 *  - Schemas live next to their inferred types so a single edit updates both.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Primitive helpers
// ---------------------------------------------------------------------------

export const idSchema = z.string().min(1);
export const isoDateSchema = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'invalid ISO date' });

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

export const userSchema = z.object({
  id: idSchema,
  email: z.string().email(),
  name: z.string().min(1),
  createdAt: isoDateSchema,
});
export type User = z.infer<typeof userSchema>;

// ---------------------------------------------------------------------------
// Weapon
// ---------------------------------------------------------------------------

export const weaponTypeSchema = z.enum([
  'rifle',
  'shotgun',
  'handgun',
  'air_rifle',
  'other',
]);
export type WeaponType = z.infer<typeof weaponTypeSchema>;

export const weaponSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  type: weaponTypeSchema,
  caliber: z.string().min(1),
  serialNumber: z.string().min(1),
  createdAt: isoDateSchema,
});
export type Weapon = z.infer<typeof weaponSchema>;

// ---------------------------------------------------------------------------
// Ammunition
//
// Handloading fields (bullet, powder, casing, primer, powderAmount,
// seatingDepth) are optional today. Stored already so a future PRO tier can
// expose handloading without a schema migration.
// ---------------------------------------------------------------------------

export const ammunitionSchema = z.object({
  id: idSchema,
  brand: z.string().min(1),
  caliber: z.string().min(1),
  bulletType: z.string().min(1),
  bullet: z.string().optional(),
  powder: z.string().optional(),
  casing: z.string().optional(),
  primer: z.string().optional(),
  powderAmount: z.number().nonnegative().optional(),
  seatingDepth: z.number().nonnegative().optional(),
});
export type Ammunition = z.infer<typeof ammunitionSchema>;

// ---------------------------------------------------------------------------
// Dog
// ---------------------------------------------------------------------------

export const dogSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  breed: z.string().min(1),
});
export type Dog = z.infer<typeof dogSchema>;

// ---------------------------------------------------------------------------
// Location
// ---------------------------------------------------------------------------

export const locationTypeSchema = z.enum([
  'hunting_ground',
  'shooting_range',
  'home',
  'other',
]);
export type LocationType = z.infer<typeof locationTypeSchema>;

export const locationSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  type: locationTypeSchema,
});
export type Location = z.infer<typeof locationSchema>;

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export const sessionTypeSchema = z.enum(['hunt', 'shooting', 'maintenance']);
export type SessionType = z.infer<typeof sessionTypeSchema> | 'moose_range' | 'wild_boar_test' | 'bear_test';

export const weatherSchema = z.object({
  temperature: z.number().optional(),
  humidity: z.number().min(0).max(100).optional(),
  pressure: z.number().optional(),
  wind: z.number().nonnegative().optional(),
  precipitation: z.number().nonnegative().optional(),
});
export type Weather = z.infer<typeof weatherSchema>;

export const maintenanceSchema = z.object({
  type: z.string().min(1),
  description: z.string().min(1),
});
export type Maintenance = z.infer<typeof maintenanceSchema>;

export const sessionSchema = z.object({
  id: idSchema,
  type: sessionTypeSchema,
  timestampStart: isoDateSchema,
  timestampEnd: isoDateSchema.optional(),
  locationId: idSchema.optional(),
  notes: z.string().optional(),
  userId: idSchema,
  weaponIds: z.array(idSchema).default([]),
  ammunitionIds: z.array(idSchema).default([]),
  dogIds: z.array(idSchema).default([]),
  shotsFired: z.number().int().nonnegative().optional(),
  hits: z.number().int().nonnegative().optional(),
  maintenance: maintenanceSchema.optional(),
  weather: weatherSchema.optional(),
});
export type Session = z.infer<typeof sessionSchema>;

// ---------------------------------------------------------------------------
// Aggregate user data shape — what the LocalStorage adapter persists per user
// and what the future API will return on `GET /me/data`.
// ---------------------------------------------------------------------------

export const userDataSchema = z.object({
  sessions: z.array(sessionSchema).default([]),
  weapons: z.array(weaponSchema).default([]),
  ammunition: z.array(ammunitionSchema).default([]),
  dogs: z.array(dogSchema).default([]),
  locations: z.array(locationSchema).default([]),
});
export type UserData = z.infer<typeof userDataSchema>;

// ---------------------------------------------------------------------------
// Input/create helpers — same shape as the entity but without server-managed
// fields. Useful for forms and POST bodies.
// ---------------------------------------------------------------------------

export const createWeaponSchema = weaponSchema.omit({ id: true, createdAt: true });
export type CreateWeaponInput = z.infer<typeof createWeaponSchema>;

export const createAmmunitionSchema = ammunitionSchema.omit({ id: true });
export type CreateAmmunitionInput = z.infer<typeof createAmmunitionSchema>;

export const createDogSchema = dogSchema.omit({ id: true });
export type CreateDogInput = z.infer<typeof createDogSchema>;

export const createLocationSchema = locationSchema.omit({ id: true });
export type CreateLocationInput = z.infer<typeof createLocationSchema>;

export const createSessionSchema = sessionSchema.omit({ id: true });
export type CreateSessionInput = z.infer<typeof createSessionSchema>;

export const createUserSchema = userSchema.omit({ id: true, createdAt: true });
export type CreateUserInput = z.infer<typeof createUserSchema>;

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export const reportFiltersSchema = z.object({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  weaponId: idSchema.optional(),
  locationId: idSchema.optional(),
  type: sessionTypeSchema.optional(),
});
export type ReportFilters = z.infer<typeof reportFiltersSchema>;
