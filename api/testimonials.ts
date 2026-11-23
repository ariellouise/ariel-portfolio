

import { createClient } from '@supabase/supabase-js'
import type { IncomingMessage, ServerResponse } from 'node:http'

type ApiRequest = IncomingMessage & {
  body?: Record<string, unknown>
}

type ApiResponse = ServerResponse & {
  status: (code: number) => ApiResponse
  json: (body: unknown) => ApiResponse
}

type TurnstileVerification = {
  success: boolean
  hostname?: string
}

export default async function handler(
  req: ApiRequest,
  res: ApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({
      error: 'Method not allowed',
    })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY

  if (!supabaseUrl || !serviceRoleKey || !turnstileSecret) {
    return res.status(500).json({
      error: 'Server configuration error',
    })
  }

  const body = req.body ?? {}

  const {
    clientName,
    businessName,
    rating,
    review,
    consent,
    turnstileToken,
  } = body

  if (
    typeof clientName !== 'string' ||
    clientName.trim().length < 1 ||
    clientName.trim().length > 80 ||
    (businessName != null &&
      (typeof businessName !== 'string' ||
        businessName.trim().length > 100)) ||
    typeof rating !== 'number' ||
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5 ||
    typeof review !== 'string' ||
    review.trim().length < 10 ||
    review.trim().length > 1200 ||
    consent !== true ||
    typeof turnstileToken !== 'string' ||
    turnstileToken.length === 0
  ) {
    return res.status(400).json({
      error: 'Invalid review submission',
    })
  }

  try {
    // Verify the Turnstile token with Cloudflare.
    const verificationResponse = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          secret: turnstileSecret,
          response: turnstileToken,
        }),
      }
    )

    if (!verificationResponse.ok) {
      return res.status(502).json({
        error: 'Verification service unavailable',
      })
    }

    const verification =
      (await verificationResponse.json()) as TurnstileVerification

    const allowedHostnames = [
      'www.arielborst.com',
      'localhost',
    ]

    if (
      !verification.success ||
      !verification.hostname ||
      !allowedHostnames.includes(verification.hostname)
    ) {
      return res.status(403).json({
        error: 'Security verification failed',
      })
    }

    // Save the review as pending approval.
    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const { error } = await supabase
      .from('testimonials')
      .insert({
        client_name: clientName.trim(),
        business_name:
          typeof businessName === 'string'
            ? businessName.trim() || null
            : null,
        rating,
        review: review.trim(),
        consent_to_publish: true,
        approved: false,
      })

    if (error) {
      console.error('Supabase insert failed:', error.message)

      return res.status(500).json({
        error: 'Could not save review',
      })
    }

    return res.status(201).json({
      message: 'Review submitted for approval',
    })
  } catch (error) {
    console.error('Testimonial API error:', error)

    return res.status(500).json({
      error: 'Submission failed',
    })
  }
}
