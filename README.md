# DividendIQ Pro

AI-powered retirement income advisor. Built for investors aged 60-70.

## Stack
- Pure HTML, CSS, and vanilla JavaScript
- No build step, no framework, no dependencies
- Deployed via Vercel as a static site

## File Structure
```
index.html        Landing page
dashboard.html    Retirement Score + portfolio summary
advisor.html      AI Advisor (chat, deep audit, tax intel, SS strategy)
calculator.html   Income calculator (projection, scenarios, reverse, withdrawal)
markets.html      Markets hub (news, sectors, macro, screener, earnings)
learn.html        10 income strategies + glossary + quiz
portfolio.html    Portfolio tracker with live prices
plans.html        Pricing and subscription
terms.html        Terms of Service
privacy.html      Privacy Policy
app.js            Shared logic, API calls, state management
styles.css        Complete design system
vercel.json       Vercel routing and headers config
```

## Deployment
1. Push all files to this repo
2. Connect repo to Vercel
3. Framework: Other (static)
4. Deploy -- no build command needed
5. Add custom domain: dividendiq.info

## Environment
No environment variables needed in Vercel.
API keys are configured in app.js (Finnhub) and advisor.html (Anthropic).

## Updating
Edit any file, commit to GitHub, Vercel auto-deploys in ~60 seconds.
