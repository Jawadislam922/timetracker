# ⚡ PRODUCTION QUICK FIX CHECKLIST

## 🎯 For: https://timetracker.sparkingasia.com

Error: **"Failed to record time entry. Please try again."**

---

## ✅ Quick Fixes (Run on Production Server)

### 1️⃣ Clear ALL Caches (Most Common Fix)
```bash
cd /path/to/your/timetracker
php artisan optimize:clear
```

This clears:
- Config cache
- Route cache
- View cache
- Application cache

### 2️⃣ Check Database Connection
```bash
php artisan tinker
```
Then type:
```php
DB::connection()->getPdo();
TimeEntry::count();
exit
```

### 3️⃣ Run Any Missing Migrations
```bash
php artisan migrate --force
```

### 4️⃣ Check File Permissions
```bash
chmod -R 775 storage bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache
```

### 5️⃣ Restart Queue Workers (if using)
```bash
php artisan queue:restart
```

### 6️⃣ Restart PHP-FPM
```bash
sudo systemctl restart php8.1-fpm  # or your PHP version
# OR
sudo service php8.1-fpm restart
```

---

## 🔍 Check Browser DevTools

1. Press **F12** on the production site
2. Go to **Console** tab - check for errors
3. Go to **Network** tab
4. Click "Clock In" button
5. Look for the failed request (red)
6. Click it and check:
   - **Status Code**
   - **Response** tab
   - **Preview** tab

---

## 📊 Status Code Meanings

| Code | Issue | Solution |
|------|-------|----------|
| **419** | CSRF token expired | Clear cookies, refresh page |
| **422** | Validation failed | Check request data format |
| **500** | Server error | Check Laravel logs |
| **403** | No permission | Check user role/policy |

---

## 📝 Check Laravel Logs

```bash
# View last 50 lines
tail -n 50 storage/logs/laravel.log

# Or watch in real-time
tail -f storage/logs/laravel.log
```

Then try the "Clock In" button again and watch for errors.

---

## 🚨 MOST LIKELY CAUSE

Based on common issues, this is usually one of:

### ✅ Option 1: Cache Issue (90% of cases)
**Solution:**
```bash
php artisan config:clear
php artisan route:clear
php artisan view:clear
php artisan cache:clear
```

### ✅ Option 2: Session/CSRF Issue
**Check `.env`:**
```env
SESSION_DRIVER=database  # or file/redis
SESSION_LIFETIME=120
```

**If using database sessions, make sure sessions table exists:**
```bash
php artisan session:table
php artisan migrate --force
```

### ✅ Option 3: Timezone Issue
**Check `.env`:**
```env
APP_TIMEZONE=Asia/Karachi
```

---

## 🎯 One-Line Fix (Try This First)

```bash
php artisan optimize:clear && php artisan config:cache && php artisan route:cache
```

---

## 📞 If Still Not Working

### Get Error Details

Run this and send me the output:

```bash
# Check database
php artisan tinker --execute="
echo 'Database: ' . DB::connection()->getDatabaseName() . PHP_EOL;
echo 'TimeEntry count: ' . App\Models\TimeEntry::count() . PHP_EOL;
echo 'Users count: ' . App\Models\User::count() . PHP_EOL;
"

# Check last error in log
tail -n 20 storage/logs/laravel.log
```

---

## 🔧 Debug Mode (Temporarily)

To see the actual error message:

**Edit `.env`:**
```env
APP_DEBUG=true
```

**Clear config:**
```bash
php artisan config:clear
```

**Try again and note the error message**

**⚠️ IMPORTANT: Set back to false after:**
```env
APP_DEBUG=false
```

---

## ✅ Verification

After fixes, test:

1. ✅ Can login successfully
2. ✅ Dashboard loads
3. ✅ Click "Clock In" button
4. ✅ No error message
5. ✅ Success notification appears
6. ✅ Time entry appears in list

---

## 🎉 Success Indicators

You'll know it's fixed when:
- ✅ No red error notification
- ✅ Green success message appears
- ✅ Time entry shows in the list immediately
- ✅ Status changes to "Working"

---

## 📚 Full Documentation

For detailed debugging: See **`PRODUCTION_ERROR_DEBUG.md`**

---

**Most Common Solution:** Clear cache with `php artisan optimize:clear` 🚀
