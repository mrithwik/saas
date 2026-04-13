# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| Latest (`main`) | Yes |

---

## Reporting a Vulnerability

If you discover a security vulnerability in this project — particularly anything related to:

- Patient data exposure
- Authentication bypass (Clerk JWT verification)
- API key leakage
- Unauthorised access to consultation records

Please **do not open a public GitHub issue**.

Instead, report it privately by contacting the maintainer directly through [GitHub](https://github.com/mrithwik).

Please include:
- A description of the vulnerability
- Steps to reproduce it
- The potential impact
- Any suggested fix if you have one

You can expect an acknowledgement within 48 hours and a resolution or mitigation plan within 7 days for critical issues.

---

## Security Practices in This Project

- All API endpoints require a valid Clerk JWT (`Authorization: Bearer <token>`)
- Secret keys (`CLERK_SECRET_KEY`, `OPENAI_API_KEY`) are environment variables and never committed to version control
- The `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is intentionally public — it is designed for client-side use and safe to expose
- `.env` and `.env.local` are listed in `.gitignore`
- Patient consultation notes are sent directly to OpenAI's API and are not stored by this application

---

## Responsible Disclosure

This project follows responsible disclosure principles. We appreciate security researchers who report issues privately and give us reasonable time to address them before any public disclosure.
