# Poultry Farm Management - Product Requirements Document

## Original Problem Statement
Build a complete modern Poultry Farm Management Web Application for a chicken farming business with 3 farms:
- Badshah (Gitodiya)
- Amayrah (Narsanda)
- Qismat (Jod)

## Architecture
- **Backend**: FastAPI + MongoDB (motor async client)
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI
- **Auth**: JWT-based with httpOnly cookies (access + refresh tokens)
- **PDF**: jsPDF + jspdf-autotable v5
- **Excel**: SheetJS (xlsx)
- **i18n**: Custom context for English/Gujarati

## User Personas
- **Farm Owner/Admin**: Manages all 3 farms, views dashboard, generates invoices
- **Farm Workers**: Add/edit stock and feed entries

## Core Requirements (Static)
1. Authentication: Login + Registration with JWT
2. Dashboard: Stats overview (farms, stock, dead, invoices, revenue)
3. Stock Management: Per-farm CRUD with auto-calc (Left = Stock - Dead)
4. Feed Management: Per-farm CRUD with auto-calc (Remaining = Weight - Used)
5. Billing: Invoice generation with GST toggle, multiple products, payment status
6. PDF/Excel Export
7. Language toggle (English/Gujarati)
8. Mobile responsive sidebar

## What's Been Implemented (2026-05-20)
### Backend
- ✅ JWT auth with httpOnly cookies, bcrypt password hashing
- ✅ Admin seeding (admin@poultry.com / admin123)
- ✅ 3 farms auto-seeded (Badshah, Amayrah, Qismat)
- ✅ Brute force protection (5 attempts → 15 min lockout)
- ✅ Register/Login/Logout/Me/Refresh/Forgot-password/Reset-password
- ✅ Stock CRUD endpoints
- ✅ Feed CRUD endpoints
- ✅ Invoice CRUD endpoints with payment status updates
- ✅ Dashboard stats aggregation

### Frontend
- ✅ Login page with glassmorphism design + Sign Up link
- ✅ Register page with form validation
- ✅ Dashboard with 5 stat cards + recent activities
- ✅ Stock Selection with 3 beautiful farm cards
- ✅ Stock Management: CRUD, search, PDF/Excel export, **weekly separator after every 7 days**
- ✅ Feed Selection with 3 farm cards
- ✅ Feed Management: CRUD, search, PDF/Excel export, **weekly separator every 7 entries**
- ✅ Billing: Multi-product invoice form, GST toggle (18%), payment status dropdown (paid/unpaid/partial), single PDF download, **all invoices PDF download**
- ✅ Sidebar with language toggle, logout, mobile hamburger menu
- ✅ English/Gujarati translations
- ✅ Indian Rupees (₹) currency formatting
- ✅ Sonner toast notifications

## Testing Results (Iteration 1)
- ✅ Backend: 100% (20/20 pytest tests passed)
- ✅ Frontend: 100% (all critical flows working)
- All buttons functional, all CRUD operations verified

## Test Credentials
- Admin: admin@poultry.com / admin123

## Prioritized Backlog
### P2 (Optional Polish)
- Replace native date picker with shadcn Calendar component
- Replace native <select> with shadcn Select for farm dropdown
- Add DialogDescription/aria-describedby for a11y
- Add WhatsApp share button on invoices for Indian market

### Future Enhancements
- Multi-tenant support with role-based authorization
- Production cookie settings (secure=True, samesite=none)
- Split server.py into separate router files
