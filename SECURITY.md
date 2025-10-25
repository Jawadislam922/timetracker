# 🔐 Security Guide - Sparking Asia TimeTracker

## ⚠️ IMPORTANT: Protect Your Credentials

### What NOT to Commit to GitHub

**NEVER** commit the following files to version control:
- `.env` - Your local environment file
- `.env.production` - Production environment file
- `.env.backup` - Any environment backups
- `auth.json` - Composer authentication
- Any file containing passwords, API keys, or secrets

### ✅ Already Protected

Your `.gitignore` file already includes:
```
.env
.env.backup
.env.production
```

These files will NOT be pushed to GitHub.

---

## 🔑 Environment Variables Best Practices

### 1. Local Development (.env)
Keep your local development credentials in `.env`:
```env
APP_NAME="Sparking Asia TimeTracker"
APP_ENV=local
APP_DEBUG=true
APP_URL=http://localhost:8000

DB_DATABASE=time_tracker
DB_USERNAME=root
DB_PASSWORD=

# Admin credentials (for seeding only)
ADMIN_NAME="Your Name"
ADMIN_EMAIL="your-email@example.com"
ADMIN_PASSWORD="local-dev-password"
```

### 2. Production Environment
On your production server, manually create `.env` with:
```env
APP_NAME="Sparking Asia TimeTracker"
APP_ENV=production
APP_DEBUG=false
APP_URL=https://your-production-domain.com

DB_DATABASE=production_database
DB_USERNAME=production_user
DB_PASSWORD=STRONG_SECURE_PASSWORD_HERE

# Admin credentials
ADMIN_NAME="Admin Full Name"
ADMIN_EMAIL="admin@production-email.com"
ADMIN_PASSWORD="VERY_STRONG_PRODUCTION_PASSWORD"
```

### 3. Use .env.example Instead
The `.env.example` file is safe to commit. It shows the required variables without actual values:
```env
APP_NAME="${APP_NAME}"
APP_ENV=local
APP_KEY=
APP_DEBUG=true
APP_URL=http://localhost

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=laravel
DB_USERNAME=root
DB_PASSWORD=

ADMIN_NAME="Admin User"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="change_this_password"
```

---

## 🚀 Production Deployment Security

### Step 1: Prepare on Your Local Machine
```bash
# Build optimized assets
npm run build

# Run production script (without pushing .env)
.\deploy-production.ps1
```

### Step 2: On Production Server
```bash
# Create .env manually (NEVER copy from local)
nano .env

# Add production values:
APP_ENV=production
APP_DEBUG=false
DB_PASSWORD=your_secure_production_password
ADMIN_EMAIL=production-admin@sparkingasia.com
ADMIN_PASSWORD=very_strong_password_here

# Set proper permissions
chmod 600 .env
chown www-data:www-data .env
```

### Step 3: Run Migrations & Seed
```bash
php artisan migrate --force
php artisan db:seed --class=AdminUserSeeder
```

---

## 🔒 Additional Security Measures

### 1. Strong Passwords
- Minimum 12 characters
- Mix of uppercase, lowercase, numbers, symbols
- Use a password manager
- Example: `Sp@rk!ng#2025$Secur3`

### 2. Environment File Permissions
```bash
# Make .env readable only by owner
chmod 600 .env

# Verify permissions
ls -la .env
# Should show: -rw------- (600)
```

### 3. Application Key
```bash
# Generate unique key for production
php artisan key:generate

# NEVER use the same APP_KEY in multiple environments
```

### 4. Database Credentials
- Use strong database passwords
- Create separate database user for the application
- Grant only necessary permissions
- Never use root user in production

### 5. HTTPS/SSL
- Always use HTTPS in production
- Obtain SSL certificate (Let's Encrypt is free)
- Force HTTPS in your web server config

---

## 📋 Security Checklist

Before deploying to production:

- [ ] `.env` is in `.gitignore`
- [ ] No passwords in code or README
- [ ] Production `.env` created on server (not copied from local)
- [ ] `APP_DEBUG=false` in production
- [ ] `APP_ENV=production` set correctly
- [ ] Unique `APP_KEY` generated for production
- [ ] Strong database password set
- [ ] Admin email/password are production-specific
- [ ] File permissions set correctly (600 for .env)
- [ ] HTTPS/SSL configured
- [ ] Firewall rules configured
- [ ] Database accessible only from application server
- [ ] Regular backups scheduled

---

## 🔍 How to Check What's Being Committed

Before pushing to GitHub:
```bash
# See what files will be committed
git status

# See what changes will be committed
git diff

# Check if .env is being tracked (should return nothing)
git ls-files | grep .env

# If .env appears, remove it:
git rm --cached .env
git commit -m "Remove .env from tracking"
```

---

## 💡 Emergency: If You Accidentally Committed Secrets

If you accidentally committed `.env` or passwords:

### 1. Remove from Current Commit
```bash
git rm --cached .env
git commit --amend -m "Remove sensitive data"
git push --force
```

### 2. Remove from History (if already pushed)
```bash
# Use BFG Repo-Cleaner or git filter-branch
# Consult GitHub docs for complete removal

# Then, immediately change all exposed credentials:
# - Generate new APP_KEY
# - Change database password
# - Change admin password
# - Update all API keys
```

### 3. Change All Credentials
- Generate new `APP_KEY`
- Change all database passwords
- Change admin passwords
- Rotate any API keys
- Update production `.env`

---

## 📚 Resources

- [Laravel Security Best Practices](https://laravel.com/docs/10.x/deployment#optimization)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)

---

## 🆘 Support

If you have security concerns or questions:
- Contact your team lead
- Email: security@sparkingasia.com
- Review code before committing
- Use `git diff` to check changes

---

**Remember: Security is everyone's responsibility. When in doubt, ask!**
