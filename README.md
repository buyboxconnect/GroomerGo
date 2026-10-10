# GroomerGo

Companion website and Base44 backend for the GroomerGo iOS app.

## Development

Run `npm ci`, `npm run dev`, `npm test`, and `npm run build`.

The home page and hash-based booking/dashboard routes are demonstrations. Authentication pages live at `/login`, `/register`, `/forgot-password`, `/reset-password`, and `/mobile-auth`.

The mobile callback preserves the existing draft behavior: after authentication it returns a token and state to `groomergo://auth`. End-to-end Google login must still be verified on the iOS device. Do not log callback URLs or tokens.

Existing deployed `mobile-login` and `sync-workspace` functions, BusinessSnapshot schema, and authentication settings were downloaded before GitHub linking. The PilotInterest schema is retained for the website form.

## Publishing

Once linked, changes on `main` sync to Base44. Publish from the Base44 editor. Do not run CLI deploy against this GitHub-managed app.

App ID: `6ac974bd3f04b748fdf56660`.

The original website and Base44 draft were backed up separately in the local GroomerGo workspace before merging.
