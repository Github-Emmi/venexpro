# 🚀 Production Deployment Checklist

## Pre-Push (Local Machine)

- [x] Settings.py configured for production
  - [x] `DEBUG = False`
  - [x] `ALLOWED_HOSTS` includes production domain
  - [x] MySQL database configured
  - [x] Gmail SMTP email backend
  - [x] CORS/CSRF settings updated
  
- [x] Security files updated
  - [x] `.env` file with production values
  - [x] `.gitignore` excludes sensitive files
  - [x] `.env.example` created for reference
  
- [x] Dependencies documented
  - [x] `requirements.txt` generated
  
- [x] Code committed to git
  - [ ] `git add .`
  - [ ] `git commit -m "Configure for production deployment"`
  - [ ] `git push origin main`

---

## On PythonAnywhere Server

### 1. Pull Latest Code
- [ ] `cd /home/emmidevcodes/RBC`
- [ ] `git pull origin main`

### 2. Environment Setup
- [ ] Create `.env` file in project root
- [ ] Copy values from `.env.example`
- [ ] Fill in production credentials:
  - [ ] SECRET_KEY
  - [ ] DB_PASSWORD
  - [ ] EMAIL_HOST_PASSWORD
  - [ ] Production domain

### 3. Install Dependencies
- [ ] `pip install -r requirements.txt`
- [ ] Verify mysqlclient installed

### 4. Database Setup
- [ ] `python manage.py migrate`
- [ ] Create superuser (if needed): `python manage.py createsuperuser`

### 5. Static Files
- [ ] `python manage.py collectstatic --noinput`
- [ ] Configure static files mapping in Web tab:
  - [ ] `/static/` → `/home/emmidevcodes/RBC/staticfiles`
  - [ ] `/media/` → `/home/emmidevcodes/RBC/media`

### 6. WSGI Configuration
- [ ] Edit WSGI file in Web tab
- [ ] Add dotenv loading
- [ ] Set correct path: `/home/emmidevcodes/RBC`
- [ ] Set DJANGO_SETTINGS_MODULE

### 7. Reload & Test
- [ ] Click "Reload" button in Web tab
- [ ] Test homepage loads
- [ ] Test admin panel
- [ ] Test sell page
- [ ] Test dashboard

---

## Post-Deployment Testing

### Critical Features
- [ ] Homepage loads (https://emmidevcodes.pythonanywhere.com)
- [ ] Admin login works
- [ ] Cryptocurrency dropdown populates
- [ ] Currency conversion works (NGN ₦)
- [ ] Portfolio data displays
- [ ] Recent transactions show (4 items)
- [ ] Email verification sends
- [ ] Market stats show abbreviated numbers (2.83T)
- [ ] Static files load (CSS/JS)
- [ ] Images load

### Currency Features
- [ ] User currency type displays (NGN)
- [ ] Currency symbol shows (₦)
- [ ] Exchange rate API works
- [ ] "You Receive" converts to NGN

### Dashboard Features
- [ ] Total Portfolio Value shows
- [ ] Available Balance displays
- [ ] Recent transactions limited to 4
- [ ] "View All" links work
- [ ] Transaction amounts show with currency

---

## Troubleshooting

### If static files don't load:
```bash
python manage.py collectstatic --noinput
# Then reload webapp
```

### If database connection fails:
- Check .env DB_PASSWORD
- Verify DB_HOST is correct
- Check MySQL database exists

### If email doesn't send:
- Verify Gmail app password
- Check EMAIL_HOST_PASSWORD in .env

### If 500 error:
- Check error logs in PythonAnywhere
- Verify .env file exists
- Check all environment variables set

---

## Quick Commands Reference

```bash
# Pull latest code
git pull origin main

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Collect static files
python manage.py collectstatic --noinput

# Create superuser
python manage.py createsuperuser

# Django shell (for testing)
python manage.py shell
```

---

## Production Credentials

**Domain:** https://emmidevcodes.pythonanywhere.com
**Database:** emmidevcodes$venexprodb (MySQL)
**Email:** aghason.emmanuel@gmail.com
**Admin:** emmidevcodes@gmail.com

---

## ✅ Deployment Complete!

Once all checkboxes are marked, your app is live!
