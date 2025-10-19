# 🔧 Production Server Commands - Step by Step

## Current Status:
✅ Connected to production server
✅ In correct directory: `/home/sparkingasia/repositories/timetracker`
⚠️ Migration error (expected - columns already exist)

---

## ✅ Run These Commands in Order:

### 1. Ignore the migration error and continue:
```bash
php artisan migrate --force
```
**Note:** Press Enter if it asks to continue. The error about duplicate columns is normal - it means those columns already exist.

---

### 2. Check if time_entries table exists:
```bash
php artisan tinker --execute="echo 'time_entries table: ' . (Schema::hasTable('time_entries') ? 'EXISTS' : 'MISSING') . PHP_EOL;"
```

---

### 3. If table EXISTS, check if it has data:
```bash
php artisan tinker --execute="echo 'TimeEntry count: ' . App\Models\TimeEntry::count() . PHP_EOL;"
```

---

### 4. Clear all caches:
```bash
php artisan optimize:clear
```

---

### 5. Cache the config:
```bash
php artisan config:cache
php artisan route:cache
```

---

### 6. Check last errors in log:
```bash
tail -n 50 storage/logs/laravel.log
```

---

### 7. Test database connection:
```bash
php artisan tinker --execute="
try {
    echo 'Database: ' . DB::connection()->getDatabaseName() . PHP_EOL;
    echo 'Users: ' . App\Models\User::count() . PHP_EOL;
    echo 'Clients: ' . App\Models\Client::count() . PHP_EOL;
} catch (\Exception \$e) {
    echo 'Error: ' . \$e->getMessage() . PHP_EOL;
}
"
```

---

## 🎯 Expected Results:

After running these commands, you should see:
- ✅ time_entries table EXISTS
- ✅ Database connection working
- ✅ No errors in cache clearing
- ✅ Logs show what the 500 error is

---

## 📝 Next Steps Based on Results:

### If time_entries table is MISSING:
The migration didn't run. Check:
```bash
ls -la database/migrations/ | grep time_entries
```

### If table EXISTS but count fails:
There's a model/database mismatch. Check the error message.

### If everything works:
Refresh the website and check browser console!

---

## 🚨 If Still Getting 500 Errors:

Check the exact error:
```bash
# Watch logs in real-time
tail -f storage/logs/laravel.log
```

Then in another terminal/browser:
- Refresh the production website
- Watch the log for errors

---

**Start with command #1 above and work through them in order!** 📋
