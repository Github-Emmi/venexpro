#!/bin/bash
# PythonAnywhere Deployment Script
# Run this on PythonAnywhere server after git pull

echo "========================================="
echo "🚀 Deploying Venex BTC Trading Platform"
echo "========================================="
echo ""

# Navigate to project directory
cd /home/emmidevcodes/RBC || exit

echo "✅ In directory: $(pwd)"
echo ""

# Pull latest code
echo "📥 Pulling latest code from git..."
git pull origin main
echo ""

# Run migrations (CRITICAL!)
echo "🗄️  Running database migrations..."
python manage.py migrate
echo ""

# Collect static files
echo "📦 Collecting static files..."
python manage.py collectstatic --noinput
echo ""

# Clear cache
echo "🧹 Clearing Django cache..."
python manage.py shell << EOF
from django.core.cache import cache
cache.clear()
print("✅ Cache cleared")
exit()
EOF
echo ""

echo "========================================="
echo "✅ Deployment Complete!"
echo "========================================="
echo ""
echo "⚠️  IMPORTANT: Reload your web app in PythonAnywhere Web tab"
echo ""
echo "🧪 Test these after reload:"
echo "   - Dashboard loads without errors"
echo "   - WebSocket connections work (check browser console)"
echo "   - No 'Out of range' errors in error logs"
echo ""
echo "📊 Monitor error logs at:"
echo "   https://www.pythonanywhere.com/user/emmidevcodes/files/var/log/"
echo ""
