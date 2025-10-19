# 🎯 ONE COMMAND TO FIX EVERYTHING

Copy and paste this **ONE LINE** on production server:

```bash
php artisan migrate --path=database/migrations/2025_10_13_140730_create_time_entries_table.php --force && php artisan optimize:clear && echo "✅ DONE! Refresh your browser now."
```

---

## What This Does:
1. Creates the `time_entries` table
2. Clears all caches
3. Shows success message

---

## Expected Output:
```
INFO  Running migrations.
2025_10_13_140730_create_time_entries_table .............................. DONE
INFO  Clearing cached bootstrap files.
✅ DONE! Refresh your browser now.
```

---

## After Running:
1. Refresh https://timetracker.sparkingasia.com/dashboard
2. All errors should be gone
3. Time tracking should work

---

That's it! 🚀
