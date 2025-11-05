#!/bin/bash
# ============================================================================
# PythonAnywhere ASGI Deployment Script
# Run this on PythonAnywhere Bash console after pulling latest code
# ============================================================================

set -e  # Exit on error

echo "============================================================================"
echo "🚀 PythonAnywhere ASGI Deployment for Venex BTC"
echo "============================================================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="$HOME/venexpro"
VENV_NAME="venv"
DOMAIN="www.venexbtc.com"

echo -e "${YELLOW}Step 1: Navigate to project directory${NC}"
cd "$PROJECT_DIR" || exit 1
echo "✅ Current directory: $(pwd)"
echo ""

echo -e "${YELLOW}Step 2: Activate virtual environment${NC}"
source "$HOME/.virtualenvs/$VENV_NAME/bin/activate" || {
    echo "❌ Failed to activate virtualenv. Creating new one..."
    mkvirtualenv "$VENV_NAME" --python=python3.10
}
echo "✅ Virtual environment activated: $VIRTUAL_ENV"
echo ""

echo -e "${YELLOW}Step 3: Install/Update dependencies${NC}"
echo "Installing uvicorn with standard dependencies..."
pip install "uvicorn[standard]" --upgrade
echo ""
echo "Installing project requirements..."
pip install -r requirements.txt --upgrade
echo "✅ Dependencies installed"
echo ""

echo -e "${YELLOW}Step 4: Check .env file${NC}"
if [ -f ".env" ]; then
    echo "✅ .env file exists"
    echo "   Verifying critical variables..."
    
    if grep -q "REDIS_URL=" .env; then
        echo "   ✅ REDIS_URL found"
    else
        echo "   ❌ REDIS_URL missing in .env"
    fi
    
    if grep -q "ALLOWED_HOSTS=" .env; then
        echo "   ✅ ALLOWED_HOSTS found"
    else
        echo "   ❌ ALLOWED_HOSTS missing in .env"
    fi
else
    echo "❌ .env file NOT found!"
    echo "   Please upload .env file to $PROJECT_DIR/"
    exit 1
fi
echo ""

echo -e "${YELLOW}Step 5: Run database migrations${NC}"
python manage.py migrate
echo "✅ Migrations applied"
echo ""

echo -e "${YELLOW}Step 6: Collect static files${NC}"
python manage.py collectstatic --noinput
echo "✅ Static files collected"
echo ""

echo -e "${YELLOW}Step 7: Verify configuration${NC}"
python verify_pythonanywhere_config.py || echo "⚠️  Some checks failed, but deployment may still work"
echo ""

echo "============================================================================"
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo "============================================================================"
echo ""
echo "🎯 Next Steps:"
echo ""
echo "1. Install PythonAnywhere CLI (if not already installed):"
echo "   pip install --upgrade pythonanywhere"
echo ""
echo "2. Create ASGI website:"
echo "   pa website create \\"
echo "     --domain $DOMAIN \\"
echo "     --command '$HOME/.virtualenvs/$VENV_NAME/bin/uvicorn --app-dir $PROJECT_DIR --uds \${DOMAIN_SOCKET} venexpro.asgi:application'"
echo ""
echo "3. Enable HTTPS:"
echo "   pa website create-autorenew-cert --domain $DOMAIN"
echo ""
echo "4. Monitor logs:"
echo "   tail -f /var/log/$DOMAIN.error.log"
echo ""
echo "5. Test website:"
echo "   https://$DOMAIN"
echo ""
echo "============================================================================"
echo "📚 For detailed guide, see: PYTHONANYWHERE_DEPLOYMENT_GUIDE.md"
echo "============================================================================"
