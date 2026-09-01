# User Scoring System - Quick Start Guide

## 🎯 What's New?

Your Focus Mode application now tracks your productivity with a **Daily, Weekly, and Monthly Scoring System**!

## 📊 Understanding Your Scores

### Daily Score (0-10 points)
- Resets each day at midnight
- 150+ minutes of focus = 10/10 (perfect score)
- Example: 75 minutes = 5/10

### Weekly Score (0-100 points)
- Shows your entire week's progress
- 750+ minutes = 100/100 (perfect week)
- Combines all daily focus sessions

### Monthly Score (0-100 points)
- Shows your entire month's progress
- 3000+ minutes (50 hours) = 100/100 (perfect month)
- Tracks long-term commitment

## 🚀 How to Use It

### 1. View Your Scores
- Click on the **"Session History"** tab in the sidebar
- You'll see three large score cards showing:
  - 📅 Today's Progress
  - 📈 This Week's Progress
  - 📊 This Month's Progress

### 2. Track Daily Progress
- After each focus session ends, your daily score automatically updates
- The last 7 days are displayed in a visual bar chart
- Each day shows your score out of 10 with a progress bar

### 3. Clear Old Sessions
- Click **"Clear All Sessions"** button to archive old session history
- Scores are preserved, only raw session data is deleted
- Keeps your database fresh and focused on current goals

## 💡 Tips to Maximize Your Scores

### For Daily Goals (0-10)
- Aim for 150 minutes (2.5 hours) of focused work per day
- Even 30 minutes gives you a 2/10 score
- Consistency is key!

### For Weekly Goals (0-100)
- Target 750 minutes (12.5 hours) per week
- That's about 2 hours per day average
- Mix focused work with learning and communication practice

### For Monthly Goals (0-100)
- Target 3000 minutes (50 hours) per month
- That's about 100 minutes (1.67 hours) per day average
- Sustainable long-term productivity

## 🔄 Session Management

### What Happens to My Session History?
- Old sessions are archived when you click "Clear All Sessions"
- Your scores remain intact (they're stored separately)
- You can start fresh with a clean database

### Does Clearing History Affect My Scores?
- **NO!** Scores are calculated and stored independently
- Your score history is preserved
- Only the detailed session events are removed

## 📈 Dashboard Features

### Score Cards
```
┌─────────────────────────────────────┐
│ 📅 Today's Score    │ 📈 This Week  │ 📊 This Month │
│ 7.5/10              │ 52/100        │ 38/100        │
│ 112 min focused     │ 390 min total │ 1140 min      │
└─────────────────────────────────────┘
```

### Last 7 Days Chart
Shows daily progression with visual bars:
```
Mon, Aug 4  ████████░░  8/10
Tue, Aug 5  ██████░░░░  6/10
Wed, Aug 6  ██████████  10/10
Thu, Aug 7  ████████░░  8/10
```

## ⚙️ API Endpoints (For Developers)

### Quick Reference
- `GET /api/scores/today` - Today's score
- `GET /api/scores/this-week` - This week's score
- `GET /api/scores/this-month` - This month's score
- `GET /api/scores/weekly-chart` - Last 7 days data
- `POST /api/scores/calculate` - Manual calculation
- `POST /api/history/clear` - Clear session history

See `SCORING_SYSTEM_GUIDE.md` for full API documentation.

## ❓ FAQ

**Q: Do my scores save?**
A: Yes! Scores are calculated and saved automatically when sessions end.

**Q: Can I recover cleared session history?**
A: No, it cannot be undone. But your scores are preserved in the score table.

**Q: When do scores update?**
A: Immediately when a focus session completes.

**Q: What if I work across multiple modes (Focus, Roadmap, Communication)?**
A: All focused time counts toward your daily/weekly/monthly scores.

**Q: Can I see scores for past dates?**
A: Yes, use the API endpoints with date parameters (See SCORING_SYSTEM_GUIDE.md).

## 🎓 Sample Usage

### Example: Tracking a Day
1. Start Focus session at 9 AM (60 min) → Daily score: 4/10
2. Start another session at 2 PM (90 min) → Daily score: 10/10 ✅
3. Total: 150 minutes, Perfect daily score!

### Example: Tracking a Week
- Monday: 120 min (8/10)
- Tuesday: 150 min (10/10)
- Wednesday: 100 min (6.7/10)
- Thursday: 140 min (9.3/10)
- Friday: 160 min (10/10)
- Saturday: 130 min (8.7/10)
- Sunday: 100 min (6.7/10)
- **Weekly Total: 900 minutes = 100/100** ✅

## 🔔 Notifications

- Scores update silently when sessions end
- Dashboard refreshes automatically when you view it
- No interruptions to your focus work!

## 🆘 Troubleshooting

**Scores not showing?**
- Click the 🔄 Refresh button
- Restart the application
- Check that focus sessions are completing successfully

**Clear button not working?**
- Make sure you confirm the warning dialog
- Check console for error messages
- Restart the application

## 📞 Support

For more details, see:
- `SCORING_SYSTEM_GUIDE.md` - Complete technical guide
- Console log for any error messages
- Check the API endpoints documentation

---

🎉 **Start using your scoring system today and track your productivity!**
