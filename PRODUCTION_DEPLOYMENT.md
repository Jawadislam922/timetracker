# Production Deployment

## Requirements

- PHP 8.2 or newer with the extensions required by Laravel
- Composer 2
- Node.js 20 or newer and npm 10 or newer
- MySQL 8 or compatible MariaDB
- A web root pointing to the `public` directory

## First Deployment

Create `.env` from `.env.production.example`, then set the production URL,
application key, database, mail, administrator, and optional Slack values.

```bash
composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader
npm ci
npm run build
php artisan migrate --force
php artisan storage:link
php artisan optimize
```

Create the first administrator interactively if it was not seeded:

```bash
php artisan user:create-admin
```

## Scheduler

The weekly Slack report is scheduled for Sunday at 10:00 AM in the configured
timezone. Run Laravel's scheduler every minute:

```cron
* * * * * cd /path/to/timetracker && php artisan schedule:run >> /dev/null 2>&1
```

## cPanel

The repository `.cpanel.yml` installs dependencies, builds assets, runs
migrations, and caches Laravel. It preserves `.env`, uploaded files, logs, and
runtime storage. Confirm that `composer`, `npm`, `php`, and `/usr/bin/rsync`
are available to the cPanel deployment task.

Back up the database and `storage/app/public` before each production release.
