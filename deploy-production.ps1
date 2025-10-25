# Production Deployment Script for Sparking Asia TimeTracker
# This script optimizes and prepares the application for production

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Sparking Asia TimeTracker - Production Build" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Step 1: Install/Update Dependencies
Write-Host "[1/8] Installing PHP dependencies..." -ForegroundColor Yellow
composer install --optimize-autoloader --no-dev
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Composer install failed!" -ForegroundColor Red
    exit 1
}

Write-Host "[2/8] Installing Node dependencies..." -ForegroundColor Yellow
npm ci --production=false
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: NPM install failed!" -ForegroundColor Red
    exit 1
}

# Step 2: Build Frontend Assets
Write-Host "[3/8] Building optimized frontend assets..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Build failed!" -ForegroundColor Red
    exit 1
}

# Step 3: Clear all caches
Write-Host "[4/8] Clearing caches..." -ForegroundColor Yellow
php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear

# Step 4: Optimize Laravel
Write-Host "[5/8] Optimizing Laravel configuration..." -ForegroundColor Yellow
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache

# Step 5: Run database migrations (optional - comment out if not needed)
Write-Host "[6/8] Running database migrations..." -ForegroundColor Yellow
# Uncomment the line below if you want to run migrations
# php artisan migrate --force

# Step 6: Storage permissions
Write-Host "[7/8] Setting up storage..." -ForegroundColor Yellow
php artisan storage:link

# Step 7: Optimize Composer autoloader
Write-Host "[8/8] Optimizing Composer autoloader..." -ForegroundColor Yellow
composer dump-autoload --optimize --classmap-authoritative

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "Production build completed successfully!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green

Write-Host "IMPORTANT: Before deploying to production server:" -ForegroundColor Yellow
Write-Host "1. Update .env.production with your production database credentials" -ForegroundColor White
Write-Host "2. Update APP_URL in .env.production to your production domain" -ForegroundColor White
Write-Host "3. Configure your mail settings (MAIL_HOST, MAIL_PORT, etc.)" -ForegroundColor White
Write-Host "4. Ensure proper file permissions (storage and bootstrap/cache)" -ForegroundColor White
Write-Host "5. Copy .env.production to .env on your production server" -ForegroundColor White
Write-Host "`nBuilt files are ready in the public/build directory`n" -ForegroundColor Cyan
