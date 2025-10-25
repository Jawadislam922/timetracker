## 🔍 Pre-Commit Security Checklist

**Run this checklist BEFORE every git push!**

### ✅ Files Check
```bash
# View what you're about to commit
git status

# Review all changes
git diff

# Check staged changes
git diff --staged
```

### ✅ Sensitive Files Check
```bash
# Verify .env is NOT tracked
git ls-files | grep .env
# Expected: No output (good!)

# If .env shows up, REMOVE IT:
git rm --cached .env
git rm --cached .env.production
```

### ✅ Credential Scan
- [ ] No passwords in code
- [ ] No API keys in code
- [ ] No email addresses in code
- [ ] All secrets use env() or config()

### ✅ Environment Files
- [ ] `.env` is in `.gitignore`
- [ ] `.env.production` is in `.gitignore`
- [ ] Only `.env.example` should be committed

### ✅ README & Documentation
- [ ] Use example credentials only (admin@example.com)
- [ ] No real passwords shown
- [ ] No production URLs or IPs

### ✅ Safe to Commit
If all checks pass:
```bash
git add .
git commit -m "Your commit message"
git push origin your-branch
```

---

**❌ If you accidentally committed secrets:**
1. Stop immediately
2. Don't push to GitHub yet
3. Run: `git reset HEAD~1` to undo commit
4. Remove sensitive data
5. Commit again
