import { z } from 'zod';
export const bureaus = ['PGRC', 'RB', 'Regional Office'] as const;
export const statuses = [
  'pending',
  'under_process',
  'transferred',
  'escalated',
  'disposed',
] as const;
export const categories = [
  'Fee & refund',
  'Faculty & employment',
  'Infrastructure',
  'Admission & eligibility',
  'Regulatory compliance',
  'Student welfare',
  'Other',
] as const;
const timestamp = z.iso.datetime({ offset: true });
export const createCaseSchema = z
  .object({
    institution_name: z.string().trim().min(2).max(200),
    permanent_id: z.string().trim().max(40).optional(),
    city: z.string().trim().max(100).optional(),
    title: z.string().trim().min(3).max(160),
    category: z.enum(categories),
    bureau: z.enum(bureaus),
    description: z.string().trim().min(10).max(20000),
    officer_id: z.uuid().optional(),
    received_at: timestamp,
    deadline: timestamp,
    next_action: z.string().trim().min(3).max(500),
    source_key: z.string().trim().min(3).max(200).optional(),
  })
  .refine((v) => new Date(v.deadline) >= new Date(v.received_at), {
    message: 'Deadline must be on or after receipt.',
    path: ['deadline'],
  });
export const caseCommandSchema = z.object({
  action: z.enum([
    'start',
    'add_note',
    'assign',
    'transfer',
    'escalate',
    'dispose',
    'amend_deadline',
    'resolve_identity',
  ]),
  reason: z.string().trim().min(3).max(2000),
  next_action: z.string().trim().min(3).max(500).optional(),
  bureau: z.enum(bureaus).optional(),
  officer_id: z.uuid().optional(),
  institution_id: z.uuid().optional(),
  deadline: timestamp.optional(),
  expectedVersion: z.number().int().positive(),
  idempotencyKey: z.string().min(8).max(100),
});
export const createEnvelope = z.object({
  payload: createCaseSchema,
  idempotencyKey: z.string().min(8).max(100),
});
export const filterSchema = z
  .object({
    q: z.string().trim().max(200).default(''),
    institution_id: z.uuid().optional(),
    bureau: z.enum(bureaus).optional(),
    region: z.string().max(80).optional(),
    category: z.string().max(80).optional(),
    status: z.enum(statuses).optional(),
    from: timestamp.optional(),
    to: timestamp.optional(),
    flag: z.enum(['overdue', 'overlap', 'review', 'due_soon']).optional(),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    page_size: z.coerce.number().int().min(1).max(100).default(25),
  })
  .refine((v) => !v.from || !v.to || new Date(v.from) <= new Date(v.to), {
    message: 'Start date must precede end date.',
    path: ['from'],
  });
export type CaseFilters = z.infer<typeof filterSchema>;
export type CreateCase = z.infer<typeof createCaseSchema>;
export type CaseCommand = z.infer<typeof caseCommandSchema>;
export type CommandResult = {
  id: string;
  case_no?: string;
  version?: number;
  outcome: string;
  identity_state?: string;
};
