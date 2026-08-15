# i18n Implementation Tasks

- `[x]` 1. Add `language` field to `models/User.js`
- `[x]` 2. Update `controllers/authController.js` (register + getMe include language)
- `[x]` 3. Add `PATCH /api/auth/language` route + controller
- `[x]` 4. Create `public/js/i18n.js` — full translation dictionary + engine
- `[x]` 5. Update `public/js/api.js` — init lang on load, bind switcher
- `[x]` 6. Update `public/js/auth.js` — send language on register, sync on login
- `[x]` 7. Inline switcher styles defined directly in HTML/JS components (No style.css edits needed)
- `[x]` 8. Update `public/index.html` — lang switcher + data-i18n attrs
- `[x]` 9. Update `public/register.html` — language choice field + data-i18n attrs
- `[x]` 10. Update `public/senior-dashboard.html` — lang switcher + voice lang selector + data-i18n
- `[x]` 11. Update `public/volunteer-dashboard.html` — lang switcher + data-i18n
- `[x]` 12. Update `public/family-dashboard.html` — lang switcher + data-i18n
- `[x]` 13. Update `public/admin-dashboard.html` — lang switcher + data-i18n
- `[x]` 14. Update `public/js/senior.js` — voice lang integration
- `[/]` 15. Server restart + verify
