# 🚀 Quick Start After Fixes

## For Fresh Installation

```bash
# 1. Install dependencies
composer install
npm install

# 2. Setup environment
cp .env.example .env
php artisan key:generate

# 3. Configure .env
# Add your database credentials and admin user details:
ADMIN_NAME="Admin User"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="YourSecurePassword123"

# 4. Run migrations
php artisan migrate

# 5. Create admin user
php artisan db:seed --class=AdminUserSeeder

# 6. Setup storage
php artisan storage:link

# 7. Build frontend
npm run build

# 8. Start server
php artisan serve
```

---

## For Existing Installation

```bash
# 1. Pull latest changes
git pull origin jawad

# 2. Update dependencies
composer install
npm install

# 3. Run new migration (adds is_draft column if needed)
php artisan migrate

# 4. Optional: Create admin user if needed
php artisan user:create-admin

# 5. Rebuild frontend (removed unused packages)
npm run build

# 6. Clear caches
php artisan config:clear
php artisan cache:clear
php artisan view:clear

# 7. Restart server
php artisan serve
```

---

## Creating Admin Users

### Method 1: Seeder (Recommended)
```bash
# Add to .env first:
ADMIN_NAME="Your Name"
ADMIN_EMAIL="your@email.com"
ADMIN_PASSWORD="SecurePass123"

# Run seeder:
php artisan db:seed --class=AdminUserSeeder
```

### Method 2: Artisan Command (Interactive)
```bash
php artisan user:create-admin
# Follow the prompts
```

### Method 3: Artisan Command (Direct)
```bash
php artisan user:create-admin \
  --name="Admin User" \
  --email="admin@example.com" \
  --password="SecurePass123"
```

---

## Verification Checklist

- [ ] No compilation errors: `php artisan route:list`
- [ ] Database migrated: Check `employee_portfolios` has `is_draft` column
- [ ] Admin user exists: Login with admin credentials
- [ ] Frontend builds: `npm run build` succeeds
- [ ] Portfolios work: Create/edit a portfolio
- [ ] Authorization works: Employee can't access admin routes
- [ ] No unused files: Verify removed directories don't exist

---

## Common Issues & Solutions

### Issue: "is_draft column not found"
**Solution:** Run the fix migration:
```bash
php artisan migrate
```

### Issue: "Policy not registered"
**Solution:** Clear config cache:
```bash
php artisan config:clear
php artisan cache:clear
```

### Issue: "Admin seeder fails - email already exists"
**Solution:** This is normal. Admin already exists. Use:
```bash
php artisan user:create-admin
```

### Issue: npm install shows old packages
**Solution:** Delete node_modules and reinstall:
```bash
Remove-Item -Path "node_modules" -Recurse -Force
Remove-Item -Path "package-lock.json" -Force
npm install
```

---

## What Changed

### Added Files
- ✅ `database/seeders/AdminUserSeeder.php`
- ✅ `database/migrations/2025_10_19_000001_add_is_draft_to_existing_portfolios.php`
- ✅ `FIXES_APPLIED.md`
- ✅ `QUICK_START.md`

### Modified Files
- ✅ `app/Providers/AuthServiceProvider.php` - Policy registered
- ✅ `app/Console/Commands/CreateAdminUser.php` - Fully implemented
- ✅ `app/Models/EmployeePortfolio.php` - Added is_draft
- ✅ `database/migrations/2014_10_12_000000_create_users_table.php` - Removed credentials
- ✅ `database/migrations/2025_09_18_215455_create_employee_portfolios_table.php` - Added is_draft
- ✅ `package.json` - Removed unused packages
- ✅ `README.md` - Complete documentation

### Deleted Files/Folders
- ❌ `portfolio-creator-static/`
- ❌ `resources/portfolio-creator-react_2/`
- ❌ `resources/portfolio-generator/`
- ❌ `resources/js/Portfolios/`

---

## Development Workflow

```bash
# Start development
npm run dev          # Terminal 1 - Vite dev server
php artisan serve    # Terminal 2 - Laravel server

# Access application
http://localhost:8000
```

---

## Need Help?

1. Check `FIXES_APPLIED.md` for detailed fix information
2. Check `README.md` for full documentation
3. Run `php artisan list` to see available commands
4. Check `.env.example` for required environment variables
