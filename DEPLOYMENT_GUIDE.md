# PythonAnywhere Deployment Guide
## Venex BTC Trading Platform

---

## 🚀 Pre-Deployment Checklist

- [x] Settings.py configured for production
- [x] .env file updated with production values
- [x] .gitignore updated to exclude sensitive files
- [x] requirements.txt generated
- [x] MySQL database created on PythonAnywhere

---

## 📋 Deployment Steps

### 1️⃣ Pull Latest Code from Repository

```bash
cd /home/emmidevcodes/RBC
git pull origin main
```

### 2️⃣ Create/Update .env File on Server

**IMPORTANT:** Never commit .env to git!

Create `.env` file in project root with:

```bash
nano .env
```

Paste the following content:

```env
# Django Core
SECRET_KEY=7h=kn&*kov4aziqs=h0&k93h&cnflrrithcb$t%h!2m3gb*le5
DEBUG=False
ALLOWED_HOSTS=emmidevcodes.pythonanywhere.com,*.pythonanywhere.com,localhost,127.0.0.1

# Database (MySQL)
DB_ENGINE=django.db.backends.mysql
DB_NAME=emmidevcodes$venexprodb
DB_USER=emmidevcodes
DB_PASSWORD=Aghason1999
DB_HOST=emmidevcodes.mysql.pythonanywhere-services.com
DB_PORT=3306

# Email (Gmail SMTP)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=aghason.emmanuel@gmail.com
EMAIL_HOST_PASSWORD=qsct ktvm evkz qorl
DEFAULT_FROM_EMAIL=aghason.emmanuel@gmail.com
DEFAULT_FROM_NAME=Venex BTC

# Contact
CONTACT_EMAIL=emmidevcodes@gmail.com
SUPPORT_EMAIL=emmidevcodes@gmail.com
ADMIN_EMAIL=emmidevcodes@gmail.com

# Site
SITE_URL=https://emmidevcodes.pythonanywhere.com
```

Save and exit (Ctrl+X, Y, Enter)

### 3️⃣ Install Dependencies

```bash
pip install -r requirements.txt
```

**Key packages:**
- Django 5.2.7
- djangorestframework 3.16.1
- mysqlclient 2.2.7
- channels 4.3.1
- celery 5.5.3
- redis 6.4.0

### 4️⃣ Run Database Migrations

```bash
python manage.py migrate
```

This will create all tables in your MySQL database.

### 5️⃣ Collect Static Files

```bash
python manage.py collectstatic --noinput
```

**Static files path:** `/home/emmidevcodes/RBC/staticfiles`

### 6️⃣ Create Superuser (if needed)

```bash
python manage.py createsuperuser
```

### 7️⃣ Configure WSGI File

Go to PythonAnywhere Web tab and edit your WSGI configuration file:

```python
import os
import sys
from dotenv import load_dotenv

# Add your project directory to path
path = '/home/emmidevcodes/RBC'
if path not in sys.path:
    sys.path.append(path)

# Load environment variables
project_folder = os.path.expanduser('~/RBC')
load_dotenv(os.path.join(project_folder, '.env'))

# Set Django settings module
os.environ['DJANGO_SETTINGS_MODULE'] = 'venexpro.settings'

from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
```

### 8️⃣ Configure Static Files Mapping

In PythonAnywhere Web tab → Static files section:

| URL | Directory |
|-----|-----------|
| `/static/` | `/home/emmidevcodes/RBC/staticfiles` |
| `/media/` | `/home/emmidevcodes/RBC/media` |

### 9️⃣ Reload Web App

Click **"Reload emmidevcodes.pythonanywhere.com"** button in Web tab.

---

## ✅ Post-Deployment Verification

### Test Key Features:

1. **Homepage:** https://emmidevcodes.pythonanywhere.com
2. **Admin Panel:** https://emmidevcodes.pythonanywhere.com/admin
3. **Sell Page:** https://emmidevcodes.pythonanywhere.com/sell
4. **Dashboard:** https://emmidevcodes.pythonanywhere.com/dashboard

### Verify:

- [ ] Cryptocurrency dropdown loads
- [ ] Currency conversion works (NGN ₦)
- [ ] Portfolio data displays
- [ ] Recent transactions show (4 items)
- [ ] Email verification sends
- [ ] Market stats abbreviated (2.83T format)
- [ ] Static files loading (CSS/JS)

---

## 🔧 Troubleshooting

### Common Issues:

**1. Static files not loading**
```bash
python manage.py collectstatic --noinput
# Then reload webapp
```

**2. Database connection error**
- Check .env DB_PASSWORD matches PythonAnywhere MySQL password
- Verify DB_HOST: `emmidevcodes.mysql.pythonanywhere-services.com`

**3. Email not sending**
- Verify Gmail app password in .env
- Check EMAIL_HOST_PASSWORD has no quotes: `qsct ktvm evkz qorl`

**4. 500 Internal Server Error**
- Check error logs in PythonAnywhere error log tab
- Verify .env file exists and has correct values

**5. CSRF verification failed**
- Check ALLOWED_HOSTS includes your domain
- Verify CSRF_TRUSTED_ORIGINS in settings.py

---

## 📊 Database Migration (if updating existing database)

If you want to preserve existing data:

### Option 1: Fresh Start (Recommended for this deployment)

```bash
# Backup old database (optional)
mysqldump -h emmidevcodes.mysql.pythonanywhere-services.com \
  -u emmidevcodes -p emmidevcodes$venexprodb > backup.sql

# Run migrations
python manage.py migrate
```

### Option 2: Migrate Existing Data

1. Export data from old database
2. Import to new database
3. Run migrations: `python manage.py migrate`

---

## 🔐 Security Notes

### Critical Files (NEVER commit to git):

- ✅ `.env` - Contains all secrets
- ✅ `db.sqlite3` - Local database
- ✅ `cert.crt`, `cert.key` - SSL certificates
- ✅ `__pycache__/`, `*.pyc` - Python cache

### Environment Variables in .env:

- `SECRET_KEY` - Django secret key
- `DB_PASSWORD` - MySQL password
- `EMAIL_HOST_PASSWORD` - Gmail app password

---

## 📝 New Features in This Deployment

### 1. Sell Page Enhancements:
- Dual loading strategy (Portfolio + user balances)
- Currency conversion to NGN (₦)
- Email verification workflow
- Real-time exchange rate API

### 2. Dashboard Updates:
- Recent transactions limited to 4
- Currency balance display
- Number abbreviation (2.83T, 251.83B)
- View All links

### 3. API Endpoints:
- `/api/transactions/recent/` - Recent transactions
- `/api/exchange-rate/` - Currency conversion
- `/api/portfolio/data/` - Portfolio holdings

### 4. Template Filters:
- `abbreviate_number` - Number formatting (K, M, B, T)
- `compact_number` - Alternative format

---

## 🔄 Future Updates

To deploy updates:

```bash
cd /home/emmidevcodes/RBC
git pull origin main
pip install -r requirements.txt  # If new dependencies
python manage.py migrate  # If model changes
python manage.py collectstatic --noinput
# Reload webapp
```

---

## 📞 Support

- **Admin Email:** emmidevcodes@gmail.com
- **Production URL:** https://emmidevcodes.pythonanywhere.com
- **Database:** emmidevcodes$venexprodb (MySQL)
- **Django Version:** 5.2.7
- **Python Version:** 3.x (check with `python --version`)

---

## ✨ Deployment Complete!

Your Venex BTC Trading Platform is now live at:
**https://emmidevcodes.pythonanywhere.com**

Good luck! 🚀
