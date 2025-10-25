# Production Readiness Checker (PowerShell)
# Run this script before deploying to production

Write-Host "`n🚀 Production Readiness Checker" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

$Errors = 0
$Warnings = 0

# Check 1: Environment file
Write-Host "📋 Checking environment configuration..." -ForegroundColor White
if (Test-Path ".env") {
    Write-Host "✓ .env file exists" -ForegroundColor Green
    
    $envContent = Get-Content ".env" -Raw
    
    # Check APP_ENV
    if ($envContent -match "APP_ENV=production") {
        Write-Host "✓ APP_ENV is set to production" -ForegroundColor Green
    } else {
        Write-Host "⚠ APP_ENV is not set to production" -ForegroundColor Yellow
        $Warnings++
    }
    
    # Check APP_DEBUG
    if ($envContent -match "APP_DEBUG=false") {
        Write-Host "✓ APP_DEBUG is set to false" -ForegroundColor Green
    } else {
        Write-Host "✗ APP_DEBUG should be false in production" -ForegroundColor Red
        $Errors++
    }
    
    # Check APP_KEY
    if ($envContent -match "APP_KEY=base64:.+") {
        Write-Host "✓ APP_KEY is set" -ForegroundColor Green
    } else {
        Write-Host "✗ APP_KEY is not set. Run: php artisan key:generate" -ForegroundColor Red
        $Errors++
    }
} else {
    Write-Host "✗ .env file not found" -ForegroundColor Red
    $Errors++
}
Write-Host ""

# Check 2: Dependencies
Write-Host "📦 Checking dependencies..." -ForegroundColor White
if (Test-Path "vendor") {
    Write-Host "✓ Composer dependencies installed" -ForegroundColor Green
} else {
    Write-Host "✗ Composer dependencies not installed. Run: composer install" -ForegroundColor Red
    $Errors++
}

if (Test-Path "node_modules") {
    Write-Host "✓ NPM dependencies installed" -ForegroundColor Green
} else {
    Write-Host "✗ NPM dependencies not installed. Run: npm install" -ForegroundColor Red
    $Errors++
}
Write-Host ""

# Check 3: Built assets
Write-Host "🎨 Checking built assets..." -ForegroundColor White
if (Test-Path "public/build") {
    Write-Host "✓ Assets have been built" -ForegroundColor Green
    
    if (Test-Path "public/build/manifest.json") {
        Write-Host "✓ Manifest file exists" -ForegroundColor Green
    } else {
        Write-Host "✗ Manifest file missing. Run: npm run build" -ForegroundColor Red
        $Errors++
    }
} else {
    Write-Host "✗ Assets not built. Run: npm run build:production" -ForegroundColor Red
    $Errors++
}
Write-Host ""

# Check 4: Storage permissions
Write-Host "🔒 Checking directories..." -ForegroundColor White
if (Test-Path "storage") {
    Write-Host "✓ Storage directory exists" -ForegroundColor Green
} else {
    Write-Host "✗ Storage directory missing" -ForegroundColor Red
    $Errors++
}

if (Test-Path "bootstrap/cache") {
    Write-Host "✓ Bootstrap cache exists" -ForegroundColor Green
} else {
    Write-Host "✗ Bootstrap cache missing" -ForegroundColor Red
    $Errors++
}
Write-Host ""

# Check 5: Database connection
Write-Host "🗄️  Checking database connection..." -ForegroundColor White
try {
    $dbTest = php artisan tinker --execute="try { DB::connection()->getPdo(); echo 'Connected'; } catch (Exception `$e) { echo 'Failed'; exit(1); }" 2>&1
    if ($dbTest -match "Connected") {
        Write-Host "✓ Database connection successful" -ForegroundColor Green
    } else {
        Write-Host "✗ Database connection failed" -ForegroundColor Red
        $Errors++
    }
} catch {
    Write-Host "✗ Database connection test failed" -ForegroundColor Red
    $Errors++
}
Write-Host ""

# Check 6: Optimization status
Write-Host "⚡ Checking optimization status..." -ForegroundColor White
if (Test-Path "bootstrap/cache/config.php") {
    Write-Host "✓ Configuration is cached" -ForegroundColor Green
} else {
    Write-Host "⚠ Configuration not cached. Run: php artisan config:cache" -ForegroundColor Yellow
    $Warnings++
}

if (Test-Path "bootstrap/cache/routes-v7.php") {
    Write-Host "✓ Routes are cached" -ForegroundColor Green
} else {
    Write-Host "⚠ Routes not cached. Run: php artisan route:cache" -ForegroundColor Yellow
    $Warnings++
}

$viewsExist = (Test-Path "bootstrap/cache/views.php") -or ((Get-ChildItem "storage/framework/views" -ErrorAction SilentlyContinue).Count -gt 0)
if ($viewsExist) {
    Write-Host "✓ Views are cached" -ForegroundColor Green
} else {
    Write-Host "⚠ Views not cached. Run: php artisan view:cache" -ForegroundColor Yellow
    $Warnings++
}
Write-Host ""

# Check 7: Security
Write-Host "🔐 Checking security settings..." -ForegroundColor White
if (Test-Path "public/.htaccess") {
    Write-Host "✓ .htaccess file exists" -ForegroundColor Green
} else {
    Write-Host "⚠ .htaccess file not found (OK if using Nginx)" -ForegroundColor Yellow
    $Warnings++
}

if (Test-Path "public/.env") {
    Write-Host "✗ .env file found in public directory! This is a SECURITY RISK!" -ForegroundColor Red
    $Errors++
} else {
    Write-Host "✓ .env file not in public directory" -ForegroundColor Green
}
Write-Host ""

# Final summary
Write-Host "================================" -ForegroundColor Cyan
Write-Host "📊 Summary" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Errors: $Errors" -ForegroundColor $(if ($Errors -gt 0) { "Red" } else { "Green" })
Write-Host "Warnings: $Warnings" -ForegroundColor $(if ($Warnings -gt 0) { "Yellow" } else { "Green" })
Write-Host ""

if ($Errors -gt 0) {
    Write-Host "❌ NOT READY FOR PRODUCTION" -ForegroundColor Red
    Write-Host "Please fix the errors above before deploying." -ForegroundColor Red
    exit 1
} elseif ($Warnings -gt 0) {
    Write-Host "⚠️  READY WITH WARNINGS" -ForegroundColor Yellow
    Write-Host "You can deploy, but consider addressing the warnings for optimal performance." -ForegroundColor Yellow
    exit 0
} else {
    Write-Host "✅ READY FOR PRODUCTION" -ForegroundColor Green
    Write-Host "All checks passed! You're good to deploy." -ForegroundColor Green
    exit 0
}
