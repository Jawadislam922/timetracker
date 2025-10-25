# 🚀 Production Deployment Guide

## Pre-Deployment Checklist

### 1. Environment Configuration
- [ ] Copy `.env.production.example` to `.env` on production server
- [ ] Generate new APP_KEY: `php artisan key:generate`
- [ ] Set `APP_ENV=production`
- [ ] Set `APP_DEBUG=false`
- [ ] Update `APP_URL` to your domain
- [ ] Configure database credentials
- [ ] Set up Redis for caching and sessions (recommended)
- [ ] Configure mail settings

### 2. Security Hardening
- [ ] Ensure `.env` file is not accessible via web (should be outside public root)
- [ ] Set proper file permissions: `chmod -R 755 storage bootstrap/cache`
- [ ] Set proper ownership: `chown -R www-data:www-data /path/to/app`
- [ ] Disable directory listing in web server config
- [ ] Enable HTTPS/SSL certificate
- [ ] Configure CORS if needed
- [ ] Review and update `config/cors.php` settings

### 3. Database Setup
```bash
# Run migrations
php artisan migrate --force

# Seed database if needed (first time only)
php artisan db:seed --force
```

### 4. Build Assets
```bash
# Install dependencies
npm install --production

# Build optimized assets
npm run build:production
```

### 5. Optimize Laravel
```bash
# Cache configuration
php artisan config:cache

# Cache routes
php artisan route:cache

# Cache views
php artisan view:cache

# Optimize autoloader
composer install --optimize-autoloader --no-dev

# Optimize application
php artisan optimize
```

### 6. Set Up Storage
```bash
# Create symbolic link for storage
php artisan storage:link

# Ensure storage directories exist
mkdir -p storage/app/public
mkdir -p storage/framework/{sessions,views,cache}
mkdir -p storage/logs
```

### 7. Web Server Configuration

#### Apache (.htaccess in public directory)
```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteRule ^ index.php [L]
</IfModule>

# Security headers
<IfModule mod_headers.c>
    Header set X-Content-Type-Options "nosniff"
    Header set X-Frame-Options "SAMEORIGIN"
    Header set X-XSS-Protection "1; mode=block"
    Header set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>
```

#### Nginx (example config)
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    root /var/www/timetracker/public;

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";

    index index.php;

    charset utf-8;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }

    error_page 404 /index.php;

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
```

## Deployment Commands

### Quick Deployment (All in One)
```bash
npm run deploy:prepare
```

### Manual Step-by-Step Deployment
```bash
# 1. Pull latest code
git pull origin main

# 2. Install dependencies
composer install --optimize-autoloader --no-dev
npm install --production

# 3. Build assets
npm run build:production

# 4. Run migrations
php artisan migrate --force

# 5. Clear caches
php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear

# 6. Optimize application
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan optimize

# 7. Restart services (if needed)
sudo systemctl restart php8.2-fpm
sudo systemctl restart nginx
```

## Post-Deployment Verification

### 1. Check Application Status
- [ ] Visit homepage - should load without errors
- [ ] Check console - no JavaScript errors
- [ ] Test login functionality
- [ ] Test clock-in/clock-out features
- [ ] Test work hours entry
- [ ] Test attendance tracking (admin)
- [ ] Test reports generation

### 2. Check Logs
```bash
# View Laravel logs
tail -f storage/logs/laravel.log

# Check for errors
php artisan tinker
>>> \Log::info('Test log entry');
```

### 3. Performance Check
- [ ] Run Lighthouse or PageSpeed Insights
- [ ] Check asset loading times
- [ ] Verify gzip compression is enabled
- [ ] Check database query performance

### 4. Security Verification
- [ ] Test that `.env` file is not accessible
- [ ] Verify HTTPS is working
- [ ] Check security headers are set
- [ ] Test CSRF protection
- [ ] Verify authentication works correctly

## Rollback Procedure

If something goes wrong:

```bash
# 1. Rollback code
git reset --hard HEAD~1

# 2. Rollback database (if needed)
php artisan migrate:rollback

# 3. Clear caches
npm run deploy:clear

# 4. Rebuild previous version
npm run build:production
php artisan optimize
```

## Monitoring & Maintenance

### Daily Tasks
- Monitor error logs: `tail -f storage/logs/laravel.log`
- Check disk space: `df -h`
- Monitor database size

### Weekly Tasks
- Review application logs
- Check for failed jobs (if using queues)
- Backup database
- Update dependencies (if security patches available)

### Monthly Tasks
- Full database backup
- Review and optimize slow queries
- Update Laravel and packages
- Security audit

## Backup Strategy

### Database Backup
```bash
# Create backup
php artisan db:backup

# Or manually with mysqldump
mysqldump -u username -p database_name > backup_$(date +%Y%m%d_%H%M%S).sql
```

### File Backup
```bash
# Backup storage directory
tar -czf storage_backup_$(date +%Y%m%d).tar.gz storage/

# Backup .env file
cp .env .env.backup_$(date +%Y%m%d)
```

## Troubleshooting

### Common Issues

**Issue: 500 Internal Server Error**
- Check storage folder permissions
- Check Laravel logs: `storage/logs/laravel.log`
- Clear all caches: `npm run deploy:clear`
- Regenerate optimized files

**Issue: Assets not loading**
- Verify `npm run build` completed successfully
- Check `public/build` directory exists
- Clear browser cache
- Check web server configuration

**Issue: Database connection errors**
- Verify `.env` database credentials
- Test connection: `php artisan tinker` then `DB::connection()->getPdo();`
- Check MySQL is running
- Verify user permissions

**Issue: Permission denied errors**
- Set proper ownership: `chown -R www-data:www-data storage bootstrap/cache`
- Set proper permissions: `chmod -R 755 storage bootstrap/cache`

## Performance Optimization

### Enable OPcache (php.ini)
```ini
opcache.enable=1
opcache.memory_consumption=256
opcache.max_accelerated_files=20000
opcache.validate_timestamps=0
```

### Enable Redis for Cache/Sessions
In `.env`:
```
CACHE_DRIVER=redis
SESSION_DRIVER=redis
QUEUE_CONNECTION=redis
```

### Optimize Composer Autoloader
```bash
composer dump-autoload --optimize --classmap-authoritative
```

## Support & Resources

- Laravel Documentation: https://laravel.com/docs
- React Documentation: https://react.dev
- Vite Documentation: https://vitejs.dev

---

**Last Updated:** October 21, 2025
**Version:** 1.0.0
