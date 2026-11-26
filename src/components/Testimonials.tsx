
import { useRef, useState, type FormEvent } from 'react'
import { ArrowUpRight, Star, X } from 'lucide-react'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'

export default function Testimonials() {
  const [formOpen, setFormOpen] = useState(false)
  const [rating, setRating] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)

  const turnstileRef = useRef<TurnstileInstance>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (submitting) return

    setSubmitMessage('')
    setSubmitError('')

    const form = event.currentTarget
    const formData = new FormData(form)

    const clientName = String(formData.get('name') || '').trim()
    const businessName = String(formData.get('business') || '').trim()
    const review = String(formData.get('review') || '').trim()
    const consent = formData.get('consent') === 'on'

    if (
      !clientName ||
      clientName.length > 80 ||
      businessName.length > 100 ||
      review.length < 10 ||
      review.length > 1200 ||
      rating < 1 ||
      rating > 5 ||
      !consent
    ) {
      setSubmitError('Please complete all required fields.')
      return
    }

    if (!turnstileToken) {
      setSubmitError(
        'Please complete the security verification before submitting.'
      )
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/testimonials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientName,
          businessName,
          rating,
          review,
          consent,
          turnstileToken,
        }),
      })

      if (!response.ok) {
        throw new Error('Submission failed')
      }

      setSubmitMessage(
        'Thank you! Your review was submitted and is awaiting approval.'
      )

      form.reset()
      setRating(0)
      setTurnstileToken(null)
      turnstileRef.current?.reset()
      setFormOpen(false)
    } catch {
      setSubmitError(
        'Your review could not be submitted. Please try again later.'
      )
      setTurnstileToken(null)
      turnstileRef.current?.reset()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="testimonials-compact wrap" id="testimonials">
      <div className="section-heading testimonial-banner-heading">
        <div>
          <div className="eyebrow">CLIENT EXPERIENCES</div>
          <h2>
            Good work speaks<span className="accent">.</span>
          </h2>
          <p>
            Worked with me? Share your experience.
          </p>
        </div>
        <span className="section-index">03 / REVIEWS</span>
      </div>

      <div className="testimonial-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setTurnstileToken(null)
            setSubmitMessage('')
            setSubmitError('')
            setFormOpen(!formOpen)
          }}
          aria-expanded={formOpen}
          aria-controls="testimonial-form"
        >
          {formOpen ? 'Close form' : 'Leave a review'}
          {formOpen ? <X size={17} /> : <ArrowUpRight size={17} />}
        </button>
      </div>

      {submitMessage && (
        <p className="review-success" role="status" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
          {submitMessage}
        </p>
      )}

      {formOpen && (
        <div className="testimonial-form-panel" id="testimonial-form">
          <div className="eyebrow">SHARE YOUR EXPERIENCE</div>
          <h3>Leave a review.</h3>
          <p>
            Share your experience working with me.
            Reviews are approved before publication.
          </p>

          <form onSubmit={handleSubmit}>
            <label htmlFor="review-name">Your name *</label>
            <input
              id="review-name"
              name="name"
              required
              maxLength={80}
              placeholder="Your name"
            />

            <label htmlFor="review-business">
              Business or organization
            </label>
            <input
              id="review-business"
              name="business"
              maxLength={100}
              placeholder="Optional"
            />

            <div className="review-rating">
              <span>Your rating *</span>
              <div role="group" aria-label="Choose a rating">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    type="button"
                    key={star}
                    onClick={() => setRating(star)}
                    aria-label={`${star} stars`}
                    aria-pressed={rating === star}
                  >
                    <Star
                      size={25}
                      fill={star <= rating ? 'currentColor' : 'none'}
                    />
                  </button>
                ))}
              </div>
            </div>

            <label htmlFor="review-message">Your review *</label>
            <textarea
              id="review-message"
              name="review"
              required
              minLength={10}
              maxLength={1200}
              rows={4}
              placeholder="What was your experience like?"
            />

            <div className="review-turnstile">
              <Turnstile
                ref={turnstileRef}
                siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
                options={{
                  theme: 'dark',
                  size: 'flexible',
                }}
                onSuccess={(token) => {
                  setTurnstileToken(token)
                  setSubmitError('')
                }}
                onExpire={() => {
                  setTurnstileToken(null)
                }}
                onError={() => {
                  setTurnstileToken(null)
                  setSubmitError(
                    'Verification failed. Please try again.'
                  )
                }}
              />
            </div>

            <label className="review-consent">
              <input type="checkbox" name="consent" required />
              <span>
                I give permission to display my review, name,
                and business (if provided) on this portfolio.
              </span>
            </label>

            <button
              className="btn btn-primary"
              type="submit"
              disabled={submitting || !turnstileToken || rating === 0}
            >
              {submitting ? 'Submitting…' : 'Submit review'} <ArrowUpRight size={17} />
            </button>

            {submitError && (
              <p className="review-error" role="alert">
                {submitError}
              </p>
            )}

            {submitting && (
              <p className="review-note" role="status">
                Submitting your review...
              </p>
            )}

            <p className="review-note">
              Complete the security verification and select a rating to submit.
            </p>
          </form>
        </div>
      )}
    </section>
  )
}
