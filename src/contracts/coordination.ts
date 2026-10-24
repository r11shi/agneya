import { z } from 'zod';
export const requestFields = z.object({
  case_id: z.uuid(),
  document: z.string().trim().min(3).max(100),
  purpose: z.string().trim().min(3).max(200),
  period: z.string().trim().min(3).max(100),
});
const base = { idempotencyKey: z.string().min(8).max(100) };
export const coordinationSchema = z.discriminatedUnion('action', [
  requestFields.extend({
    action: z.literal('request'),
    expected_version: z.number().int().positive(),
    fingerprint: z.string().length(64),
    decision: z.enum(['separate', 'coordinate']),
    target_request_id: z.uuid().optional(),
    reason: z.string().trim().max(2000).optional(),
    ...base,
  }),
  z.object({
    action: z.literal('respond'),
    id: z.uuid(),
    decision: z.enum(['accepted', 'declined']),
    reason: z.string().trim().min(3).max(2000),
    ...base,
  }),
  z.object({
    action: z.literal('link'),
    case_id: z.uuid(),
    target_case_id: z.uuid(),
    relationship: z.enum(['related', 'unrelated']),
    expected_version: z.number().int().positive(),
    ...base,
  }),
  z.object({
    action: z.literal('fulfill'),
    case_id: z.uuid(),
    id: z.uuid(),
    expected_version: z.number().int().positive(),
    ...base,
  }),
]);
