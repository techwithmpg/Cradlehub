'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { recordOrderPayment, type RecordOrderPaymentResult } from './payment-writer';
import {
  PostOrderPaymentPayloadSchema,
  type PostOrderPaymentPayload,
} from './financial-contract';

export async function recordOrderPaymentAction(
  payload: PostOrderPaymentPayload
): Promise<RecordOrderPaymentResult> {
  const supabase = await createClient();

  // 1. Verify caller session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: 'AUTH_REQUIRED: Authentication required to record payments.',
      code: 'AUTH_REQUIRED',
    };
  }

  // 2. Validate payload schema
  const parsed = PostOrderPaymentPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join('; ');
    return {
      ok: false,
      error: `VALIDATION_FAILED: ${errorMsg}`,
      code: 'VALIDATION_FAILED',
    };
  }

  // 3. Delegate to canonical CF4 atomic payment writer
  const result = await recordOrderPayment(supabase, parsed.data);

  if (result.ok) {
    revalidatePath('/crm/cash-flow');
  }

  return result;
}
