# Threshold

## Deploy this to Vercel (free)

1. Go to https://vercel.com and sign up (GitHub login is easiest)
2. Create a new GitHub repo and push this folder's contents to it
   - Easiest way if you don't use git yet: on vercel.com, choose "Deploy" → drag-and-drop this whole folder in, or connect it to a GitHub repo via the Vercel dashboard's import flow
3. Vercel will detect it's a Vite project automatically. Leave the default build settings:
   - Build command: `npm run build`
   - Output directory: `dist`
4. Click Deploy
5. In a minute or two you'll get a real URL like `threshold-yourname.vercel.app`

Once it's live there, the "Failed to fetch" issue goes away — that only happened because artifacts (this chat's preview) are sandboxed. A real deployed site has no such restriction and will talk to Supabase normally.

## Local testing (optional, before deploying)

If you have Node.js installed on your computer:

```bash
npm install
npm run dev
```

Then open the URL it prints (usually http://localhost:5173).

## What's already wired up

- Supabase URL and publishable key are already in `src/App.jsx` (safe to keep there — this key is meant to be public-facing)
- Sign up / log in for business owners
- Create a business, get a booking slug
- Manage services, hours, and bookings
- Public booking flow for customers by slug
