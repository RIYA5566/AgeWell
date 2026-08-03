# 🌸 AgeWell – Senior Citizen Assistance Platform

A clean, modern, and fully accessible full-stack web application connecting **Senior Citizens** with compassionate **Volunteers** for daily assistance.

---

## 🚀 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | HTML5, Vanilla CSS, Vanilla JavaScript |
| **Backend** | Node.js + Express.js |
| **Database** | MongoDB + Mongoose |
| **Auth** | JWT (JSON Web Tokens) + bcryptjs |
| **Accessibility** | WCAG AA+, large typography, voice input, SOS |

---

## 📁 Project Structure

```
AgeWell/
├── config/
│   └── db.js                    # MongoDB connection
├── controllers/
│   ├── authController.js        # Register, Login, Logout, Profile
│   ├── requestController.js     # CRUD + Workflow (Pending→Accepted→Completed)
│   └── adminController.js       # Stats, User management
├── models/
│   ├── User.js                  # Senior, Volunteer, Admin schema
│   └── HelpRequest.js           # Help request schema with status machine
├── routes/
│   ├── authRoutes.js
│   ├── requestRoutes.js
│   └── adminRoutes.js
├── middleware/
│   └── authMiddleware.js        # JWT protect + role authorize guards
├── public/                      # Static frontend
│   ├── index.html               # Landing page + Login
│   ├── register.html            # Registration (role-aware)
│   ├── senior-dashboard.html    # Senior Citizen dashboard
│   ├── volunteer-dashboard.html # Volunteer dashboard
│   ├── admin-dashboard.html     # Admin panel
│   ├── css/style.css            # Accessibility-first design system
│   └── js/
│       ├── api.js               # Fetch helper + accessibility controls
│       ├── auth.js              # Login/Register logic
│       ├── senior.js            # Senior dashboard + SOS + Voice
│       ├── volunteer.js         # Volunteer workflow
│       └── admin.js             # Admin stats + tables
├── seed.js                      # Database seeder with demo data
├── server.js                    # Express app entry point
├── package.json
└── .env                         # Environment variables
```

---

## ⚙️ Setup & Running

### Prerequisites
- Node.js ≥ 18
- MongoDB running locally on `127.0.0.1:27017` (or MongoDB Atlas)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env` (already done). Edit if needed:
```
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/agewell
JWT_SECRET=agewell_secret_key_2026_xyz
```

### 3. Seed Demo Data
```bash
npm run seed
```
This creates 5 demo users and sample requests.

### 4. Start the Server
```bash
npm start          # Production
# or
npm run dev        # With nodemon (auto-restart)
```

### 5. Open in Browser
```
http://localhost:5000
```

---

## 👥 Demo Accounts

| Role | Email | Password |
|---|---|---|
| 👵 Senior Citizen | eleanor@agewell.com | seniorpassword |
| 👴 Senior Citizen | arthur@agewell.com | seniorpassword |
| 🤝 Volunteer | sarah@agewell.com | volunteerpassword |
| 🤝 Volunteer | david@agewell.com | volunteerpassword |
| 🛡️ Admin | admin@agewell.com | adminpassword |

---

## 🔄 Request Workflow

```
Senior Creates Request  →  Status: PENDING
          ↓
Volunteer Accepts it    →  Status: ACCEPTED  (Senior's contact shown to Volunteer)
          ↓
Volunteer Completes it  →  Status: COMPLETED (Resolution notes saved)
```

---

## 🌐 API Reference

### Auth Routes (`/api/auth`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/register` | Public | Register new user |
| POST | `/login` | Public | Login, returns JWT cookie |
| POST | `/logout` | Public | Clear session cookie |
| GET | `/me` | Private | Get current user profile |

### Request Routes (`/api/requests`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/` | Senior | Create help request |
| GET | `/` | All (role-filtered) | Get requests |
| GET | `/:id` | All | Get single request |
| PUT | `/:id` | Senior | Edit pending request |
| DELETE | `/:id` | Senior/Admin | Cancel/delete request |
| PUT | `/:id/accept` | Volunteer | Accept a pending request |
| PUT | `/:id/complete` | Volunteer/Admin | Mark request completed |

### Admin Routes (`/api/admin`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/stats` | Admin | Platform statistics |
| GET | `/users` | Admin | All registered users |
| DELETE | `/users/:id` | Admin | Delete a user |

---

## ♿ Accessibility Features

- **Large Typography**: 18px minimum body text (scalable up to 30px via A+/A- widget)
- **High Contrast**: Deep forest green (#1b5e20) on white — WCAG AAA compliant
- **Oversized Buttons**: Minimum 56px height/width for easy touch/click targeting
- **Skip Navigation**: Skip-to-content link for screen readers
- **ARIA Labels**: Comprehensive aria-label, aria-required, aria-live attributes
- **Voice Input**: Web Speech API for typing-free request descriptions
- **Emergency SOS**: One-tap pulsing alert with dual-tone synthesizer alarm
- **Focus Styles**: 4px visible outline on all interactive elements
- **Responsive**: Works on mobile/tablet for seniors who use large phones

---

## 🔮 Future Roadmap

- [ ] Push notifications via Web Push API
- [ ] Real-time chat between Senior and Volunteer
- [ ] Google Maps integration for location sharing
- [ ] Multilingual support (Hindi, Spanish, French)
- [ ] Automated daily check-in reminders
- [ ] Family portal for monitoring senior activity
- [ ] SMS/WhatsApp alerts via Twilio
