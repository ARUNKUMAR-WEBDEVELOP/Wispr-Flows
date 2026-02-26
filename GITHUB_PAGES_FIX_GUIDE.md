# GitHub Pages Deployment Fix Guide

**Status**: Fixing ETIMEDOUT error in GitHub Pages deployment  
**Error**: "request to https://api.github.com/repos/ARUNKUMAR-WEBDEVELOP/Wispr-Flows/pages failed, reason: connect ETIMEDOUT"

## 🔧 Root Cause

The ETIMEDOUT error occurs when:

1. GitHub Pages is not properly enabled in repository settings
2. GitHub Actions workflow permissions are not sufficient
3. Network timeout during Pages configuration step
4. Environment secrets are missing or incorrectly configured

## ✅ Step-by-Step Fix

### Step 1: Enable GitHub Pages in Repository Settings

1. Go to your GitHub repository: https://github.com/ARUNKUMAR-WEBDEVELOP/Wispr-Flows
2. Click **Settings** (gear icon)
3. Scroll down to **Pages** section (left sidebar)
4. Under "Source", select: **GitHub Actions** (NOT branch/folder)
5. Make sure "Enforce HTTPS" is checked
6. Click **Save**

**Screenshot Path (if using web UI):**

```
Settings → Pages → Source: GitHub Actions → Save
```

### Step 2: Verify GitHub Actions Workflow

The workflow file has been updated to:

- Remove problematic `configure-pages@v4` action (causing timeout)
- Remove npm registry mirror configuration
- Add explicit token passing to deploy action
- Simplify dependency installation
- Add build verification step

**File**: `.github/workflows/deploy-frontend.yml`

Changes made:

- ✅ Removed `actions/configure-pages@v4` (causes ETIMEDOUT)
- ✅ Removed npm registry mirror (potentially conflicting)
- ✅ Changed `npm install` to `npm ci` (cleaner install)
- ✅ Added build output verification
- ✅ Explicit token: `${{ secrets.GITHUB_TOKEN }}`

### Step 3: Verify Required Secrets in Actions

Go to **Settings → Secrets and variables → Actions**

Ensure these secrets exist:

- ✅ `VITE_DEEPGRAM_KEY` - Deepgram API key
- ✅ `VITE_GEMINI_API_KEY` - Google Gemini API key
- ✅ `VITE_GOOGLE_CLIENT_ID` - Google OAuth client ID
- ✅ `VITE_GOOGLE_CLIENT_SECRET` - Google OAuth secret

**If missing:**

```bash
1. Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add each missing secret with correct name and value
```

### Step 4: Verify Vite Configuration

**File**: `wispr-flow-clone/vite.config.js`

Confirm it has correct base path:

```javascript
export default defineConfig(async () => ({
  plugins: [react()],
  base: "/Wispr-Flows/", // ← Must match repo name
  // ... rest of config
}));
```

✅ Correctly set to `/Wispr-Flows/`

### Step 5: Manual Workflow Trigger

After making the above changes:

1. Push changes: `git push origin master`
2. Go to **Actions** tab in GitHub
3. Select **Deploy Frontend to GitHub Pages**
4. Click **Run workflow** → **Run workflow**
5. Monitor the run in real-time

**Expected Output:**

```
✅ build → Completed successfully
  - Checkout
  - Setup Node.js
  - Install dependencies
  - Build
  - Verify build output
  - Upload artifact

✅ deploy → Completed successfully
  - Deploy to GitHub Pages
  - URL: https://arunkumar-webdevelop.github.io/Wispr-Flows/
```

## 🔍 Troubleshooting

### Issue: "pages" error in permissions

**Fix**: Verify Settings → Pages → Source is set to "GitHub Actions"

### Issue: Build fails with "Module not found"

**Fix**: Run locally first:

```bash
cd wispr-flow-clone
npm install --legacy-peer-deps
npm run build
```

### Issue: Environment variables undefined

**Fix**: Add all required secrets:

```bash
# These can be empty strings for initial test:
VITE_DEEPGRAM_KEY=""
VITE_GEMINI_API_KEY=""
VITE_GOOGLE_CLIENT_ID=""
VITE_GOOGLE_CLIENT_SECRET=""
```

### Issue: dist folder empty

**Fix**: Check build step in workflow:

```bash
cd wispr-flow-clone
npm run build
ls -la dist/
```

If dist is missing, check for build errors in workflow logs.

### Issue: Still getting ETIMEDOUT

**Solution 1**: Wait 5-10 minutes and try again (GitHub API can be slow)
**Solution 2**: Delete and recreate the workflow file
**Solution 3**: Use GitHub CLI:

```bash
gh pages create --source gh-pages
```

## 📋 Deployment Checklist

Before triggering workflow:

- [ ] GitHub Pages enabled in Settings → Pages
- [ ] "Source" set to "GitHub Actions"
- [ ] All required secrets added to Actions
- [ ] `vite.config.js` has `base: "/Wispr-Flows/"`
- [ ] `package.json` has `"build": "vite build"` script
- [ ] Workflow file `.github/workflows/deploy-frontend.yml` is up to date
- [ ] Local build succeeds: `npm run build`
- [ ] dist/ folder contains index.html and assets

## 🚀 Expected Result

After successful deployment:

- ✅ Frontend accessible at: `https://ARUNKUMAR-WEBDEVELOP.github.io/Wispr-Flows/`
- ✅ React app loads with all assets
- ✅ Environment variables injected correctly
- ✅ Voice Agent, Chat, and TTS functionality operational
- ✅ Backend API calls work (ensure CORS configured)

## 📞 Additional Resources

**GitHub Pages Documentation:**

- https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages
- https://docs.github.com/en/pages/configuring-a-publishing-source-for-your-github-pages-site

**GitHub Actions Documentation:**

- https://docs.github.com/en/actions/use-cases-and-examples/publishing-packages/publishing-nodejs-packages

**Vite GitHub Pages Guide:**

- https://vitejs.dev/guide/static-deploy.html#github-pages

## 🎯 Next Steps

1. **Immediate**: Follow Steps 1-5 above
2. **Verify**: Check Actions tab for successful run
3. **Test**: Visit https://ARUNKUMAR-WEBDEVELOP.github.io/Wispr-Flows/
4. **Report**: If still failing, check GitHub Actions logs for specific error

**Common Success Indicators:**

```
✅ workflow passed
✅ pages-build-deployment site is live
✅ Visit https://arunkumar-webdevelop.github.io/Wispr-Flows/
```

---

**Last Updated**: Current Session  
**Workflow Status**: ✅ Updated and optimized  
**Ready for Deployment**: YES
