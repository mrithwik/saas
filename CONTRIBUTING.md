# Contributing to Mediscribe SaaS

Thank you for your interest in contributing! Here's everything you need to know.

---

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/saas.git
   cd saas
   ```
3. **Create a branch** for your change:
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. Set up your local environment following the [README](README.md#getting-started)

---

## Making Changes

### Frontend (TypeScript / Next.js)
- All pages live in `pages/`
- Keep components self-contained in the page file unless reused elsewhere
- Use Tailwind utility classes for styling — avoid inline `style` attributes where possible
- Test in both light and dark mode

### Backend (Python / FastAPI)
- `api/index.py` is the Vercel entry point
- `api/server.py` is the AWS entry point (also serves static files)
- Keep both files in sync when adding new endpoints
- All endpoints must be protected with `Depends(clerk_guard)`

### Adding a new API endpoint
1. Add the route to **both** `api/index.py` and `api/server.py`
2. Add the corresponding `fetch` or `fetchEventSource` call in `pages/product.tsx`
3. If it's a new Vercel route, add a rewrite entry to `vercel.json`

---

## Code Style

**Python**
- Follow PEP 8
- Use type hints on function signatures
- Keep system prompts as module-level constants

**TypeScript**
- Use `const` over `let` where possible
- Name event handlers with the `handle` prefix (e.g. `handleSubmit`, `handleTranslate`)
- Keep state declarations grouped at the top of the component

---

## Submitting a Pull Request

1. Make sure your branch is up to date with `main`:
   ```bash
   git fetch origin
   git rebase origin/main
   ```
2. Test your changes locally — both the Vercel dev flow and Docker build if possible
3. Write a clear PR description explaining **what** changed and **why**
4. Open the pull request against the `main` branch

---

## Reporting Issues

Please open a [GitHub Issue](https://github.com/mrithwik/saas/issues) with:
- A clear description of the problem
- Steps to reproduce it
- What you expected to happen vs. what actually happened
- Browser/OS/Python version if relevant

---

## Security

If you discover a security vulnerability — especially relating to patient data handling, authentication, or API keys — please **do not open a public issue**. Contact the maintainer directly via GitHub instead.

---

## Important Notes

- **Never commit secrets** — `.env`, `.env.local`, and any file containing API keys must stay out of version control. They are listed in `.gitignore` already.
- This application handles medical consultation notes. Any contributions must take patient data privacy seriously.
- This project is not a certified medical device and should not be used as a substitute for professional medical judgment.
