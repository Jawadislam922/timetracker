# 🚀 Deploy Latest Code to Production

## Problem Found
Production has **old code** in `TimeEntryController.php` that's trying to use a relationship alias that doesn't exist:
```
Call to undefined relationship [timeEntries as weekly_entries] on model [App\Models\User]
```

Our local code is correct and doesn't have this issue.

---

## Solution: Deploy Latest Code

### On Production Server (you're already connected):

```bash
# 1. Pull latest code from Git
git pull origin jawad

# 2. Install/update dependencies
composer install --no-dev --optimize-autoloader

# 3. Clear all caches
php artisan optimize:clear

# 4. Rebuild caches for production
php artisan config:cache
php artisan route:cache
php artisan view:cache

# 5. Run migrations (just in case)
php artisan migrate --force

# 6. Set proper permissions
chmod -R 755 storage bootstrap/cache
chmod -R 775 storage/logs
```

---

## Verification Steps

After deploying, test these URLs:
- https://timetracker.sparkingasia.com/time-entries/today
- https://timetracker.sparkingasia.com/time-entries/today-summary

Both should return JSON instead of 500 errors.

---

## Alternative: Manual File Upload

If you don't have Git configured on production:

1. **Upload these files via FTP/SFTP:**
   - `app/Http/Controllers/TimeEntryController.php`
   - `app/Models/User.php`

2. **Then run on server:**
   ```bash
   php artisan optimize:clear
   php artisan config:cache
   php artisan route:cache
   ```

---

## What Changed

The old production code had an invalid eager loading syntax. The current code correctly loads relationships using:
```php
$employee->timeEntries()->whereDate(...)->get()
```

Instead of the broken:
```php
->with('timeEntries as weekly_entries')  // ❌ This doesn't work
```

---

## Next Steps

1. Run the deployment commands above
2. Test the site in browser
3. Check if errors are gone
4. Confirm time entries are loading
