# Students View Implementation Plan

## Overview
Create a new students view where admins can search for students and view their attendance and participation statistics.

---

## Current System Analysis

### Routing
- Uses `wouter` for client-side routing
- Routes defined in `packages/web/src/App.tsx`
- Existing routes:
  - `/` - Home (shows posts list directly)
  - `/posts/:chatId/:postId` - Post detail
  - `/posts/:chatId/:postId/summary` - Participation summary

**New routing structure** (to be implemented):
  - `/` - Landing page with two navigation cards
  - `/halaqas` - Posts/sessions list (current Home content)
  - `/students` - Students search and view
  - `/posts/:chatId/:postId` - Post detail (unchanged)
  - `/posts/:chatId/:postId/summary` - Participation summary (unchanged)

### Data Models
- **users table**: `userId`, `username`, `telegramName`, `realName`, `realNameVerified`
- **participationHistory table**: Completed participations with `sessionType`, `completedAt`, `chatId`, `postId`, `sessionNumber`
- **turnQueue table**: Active users in queue
- **sessions table**: Session metadata with `sessionNumber`, `teacherName`, `createdAt`

### Session Types
- تلاوة (tilawa) - Reading from Quran
- تسميع (tasmee) - Recitation from memory
- تطبيق (tatbeeq) - Application
- اختبار (ikhtebar) - Test
- تعويض (compensation) - Compensation

### Existing Queries
- `searchUsers(query)` - Search users by name/username
- `getUser(userId)` - Get single user details
- `getParticipationSummary(chatId, postId)` - Get summary for a specific post

### UI Patterns
- Convex `useQuery` for reactive data
- Debounced search (300ms)
- RTL layout (`dir="rtl"`)
- shadcn/ui components (Card, Button, Input, Badge, etc.)
- Responsive design with Tailwind CSS

---

## Implementation Plan

### Phase 0: Restructure Landing Page

**File**: `packages/web/src/routes/Home.tsx`

#### 0.1 Update Home to show navigation cards

Transform the Home page from showing the posts list directly to showing two navigation cards:

**Layout**:
```
┌─────────────────────────────────────────┐
│  الصفحة الرئيسية                        │
│                                          │
│  ┌──────────────┐  ┌──────────────┐    │
│  │              │  │              │    │
│  │  📚 الحلقات  │  │ 👥 الطالبات  │    │
│  │              │  │              │    │
│  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────┘
```

**Cards**:
1. **الحلقات** - Links to `/halaqas`
   - Icon: 📚 or similar
   - Description: عرض وإدارة الحلقات

2. **الطالبات** - Links to `/students`
   - Icon: 👥 or similar
   - Description: البحث عن الطالبات وعرض إحصائياتهن

**Implementation**:
- 2-column grid on desktop, single column on mobile
- Use Card component from shadcn/ui
- Make entire card clickable (Link wrapper)
- Hover effects for better UX

---

#### 0.2 Create Halaqas route

**File**: `packages/web/src/routes/Halaqas.tsx`

Move the current Home component content to a new Halaqas component:
- Show posts list (using `getAllPosts` query)
- Same layout and functionality as current Home
- Update title to "الحلقات" instead of "المنشورات"

---

### Phase 1: Backend - Database Query

**File**: `packages/db/convex/queries.ts`

#### 1.1 Create `getUserParticipations` query
Simple query to fetch all participations for a single user:

```typescript
getUserParticipations(userId: number)
```

**Returns**:
- **User Info**: `userId`, `telegramName`, `realName`, `username`
- **Participations**: Array of participation records with:
  - `completedAt` - Timestamp of completion
  - `sessionType` - Type: تلاوة, تسميع, تطبيق, اختبار, تعويض
  - `chatId` - Chat ID
  - `postId` - Post ID
  - `sessionNumber` - Session number
  - `notes` - Optional notes
  - `compensatingForDates` - Array of dates if compensation

**Implementation approach**:
1. Query `users` table for user info by `userId`
2. Query `participationHistory` using `by_user` index
3. Return user info + sorted participations (by completedAt desc)
4. Client will handle grouping by date for calendar display

---

### Phase 2: Frontend - Students Route

**File**: `packages/web/src/routes/Students.tsx`

#### 2.1 Create Students page component

**Features**:
- Search bar at the top (reuse pattern from `AddUserModal`)
- Search results list (when searching)
- Selected student stats display

**Layout**:
```
┌─────────────────────────────────────────┐
│  الطلاب                                 │
│  ┌──────────────────────────────────┐   │
│  │ 🔍 ابحث عن طالبة...              │   │
│  └──────────────────────────────────┘   │
│                                          │
│  [Search Results OR Selected Stats]     │
└─────────────────────────────────────────┘
```

**State Management**:
- `searchQuery` - Current search input
- `debouncedQuery` - Debounced search (300ms)
- `selectedUserId` - Currently selected user (null when searching)

**Behavior**:
- When search is empty: Show "ابدأ الكتابة للبحث عن طالبة"
- When searching: Show search results (using `searchUsers` query)
- When user selected: Show calendar + stats (using `getUserParticipations` query)
- Click on search result: Set `selectedUserId` and clear search

---

### Phase 3: Frontend - Student View Component

**File**: `packages/web/src/components/StudentStats.tsx`

#### 3.1 Create StudentStats display component

**Props**:
- `userId: number`
- `onBack: () => void` - Callback to return to search

**Sections**:

1. **Header**
   - Student name (realName or telegramName)
   - Username badge (if available)
   - Back button

2. **Calendar View** (Main Section)
   - Display participations in a calendar format
   - Each day shows participation indicator if user participated
   - Click on a day to see details (session type, notes, etc.)
   - Color-code by session type:
     - تلاوة - Green
     - تسميع - Blue
     - تطبيق - Purple
     - اختبار - Orange
     - تعويض - Yellow
   - Show current month by default with navigation (previous/next month)
   - Mark days with multiple participations differently

3. **Additional Stats** (Below Calendar - TBD)
   - Placeholder section for future statistics
   - Can add total count, streaks, etc. later

**Component Structure**:
```tsx
<div>
  <div className="header">
    <Button onClick={onBack}>رجوع</Button>
    <h1>{student.realName || student.telegramName}</h1>
    {student.username && <Badge>@{student.username}</Badge>}
  </div>

  <div className="calendar-section">
    <h2>📅 سجل المشاركات</h2>
    <Calendar
      participations={participations}
      onDayClick={handleDayClick}
    />
  </div>

  <div className="stats-section">
    <h2>📊 الإحصائيات</h2>
    {/* TBD - Additional stats */}
  </div>
</div>
```

**Calendar Component**:
- Create a simple calendar grid (7 columns for days of week)
- Use participations data to mark days
- Group participations by date (day level, not timestamp)
- Handle Arabic day/month names
- Responsive design (smaller on mobile)

---

### Phase 4: Integration

#### 4.1 Update routes in App.tsx

**File**: `packages/web/src/App.tsx`

Update route structure:
```tsx
<Switch>
  <Route path="/" component={Home} />  {/* Now shows navigation cards */}
  <Route path="/halaqas" component={Halaqas} />  {/* Posts list */}
  <Route path="/students" component={Students} />  {/* Students view */}
  <Route path="/posts/:chatId/:postId/summary" component={ParticipationSummary} />
  <Route path="/posts/:chatId/:postId" component={PostDetail} />
  <Route>404 page</Route>
</Switch>
```

**Order matters**: More specific routes (`/posts/:chatId/:postId/summary`) should come before less specific ones (`/posts/:chatId/:postId`).

---

#### 4.2 Update navigation links

**Files to update**:
- `packages/web/src/routes/Halaqas.tsx` - Update "back" or "home" links if any
- `packages/web/src/routes/PostDetail.tsx` - Update back button to go to `/halaqas` instead of `/`
- `packages/web/src/routes/ParticipationSummary.tsx` - No changes needed (goes back to PostDetail)

---

## File Changes Summary

### New Files
1. `packages/web/src/routes/Halaqas.tsx` - Posts/sessions list (moved from Home)
2. `packages/web/src/routes/Students.tsx` - Students search and view page
3. `packages/web/src/components/StudentStats.tsx` - Student stats display with calendar

### Modified Files
1. `packages/web/src/routes/Home.tsx` - Convert to landing page with navigation cards
2. `packages/web/src/routes/PostDetail.tsx` - Update back button link from `/` to `/halaqas`
3. `packages/db/convex/queries.ts` - Add `getUserParticipations` query
4. `packages/web/src/App.tsx` - Update routing structure

---

## Technical Decisions

### Landing page with navigation cards
- Cleaner user experience with clear entry points
- Scalable - easy to add more sections in future (reports, settings, etc.)
- Separates concerns: sessions management vs. student management
- Familiar pattern in admin dashboards

### Why separate Stats component?
- Keeps Students page focused on search
- Reusable if needed elsewhere
- Cleaner state management

### Why not create a new table?
- All needed data exists in `participationHistory` and `users`
- Real-time data from existing tables
- No need for data duplication or sync

### Search implementation
- Reuse existing `searchUsers` query (already optimized)
- Follow established pattern from `AddUserModal`
- Consistent UX with existing search

### Simple query design
- Query only returns raw participation data
- Client handles calendar grouping/display logic
- Keeps query lightweight and fast
- Use `by_user` index on participationHistory for efficient lookup

### Calendar view benefits
- Visual representation of participation patterns
- Easy to spot attendance trends and gaps
- Color-coding helps identify session types at a glance
- More intuitive than lists of dates

---

## UI/UX Considerations

### RTL Layout
- All text right-aligned
- Icons on left side
- Search icon on right of input

### Responsive Design
- Mobile: Single column for stats cards
- Tablet: 2 columns
- Desktop: 3 columns

### Loading States
- Show Loader component while fetching
- Same pattern as other pages

### Empty States
- No search query: Prompt to start typing
- No results: "لا يوجد نتائج"
- No participations: "لا توجد مشاركات حتى الآن"

### Arabic Formatting
- Use `toLocaleString('ar-EG')` for numbers
- Use `toLocaleDateString('ar-EG')` for dates
- Follow existing patterns in ParticipationSummary

---

## Testing Checklist

### Landing Page
- [ ] Landing page displays both navigation cards
- [ ] الحلقات card navigates to `/halaqas`
- [ ] الطالبات card navigates to `/students`
- [ ] Cards are responsive on mobile/tablet/desktop
- [ ] Hover effects work correctly

### Halaqas Page
- [ ] Posts list displays correctly
- [ ] Navigation to post details works
- [ ] All existing functionality preserved

### Students Page
- [ ] Search finds users correctly
- [ ] Calendar displays for user with participations
- [ ] Calendar displays for user without participations (empty state)
- [ ] Calendar shows correct dates with participations marked
- [ ] Color coding works for different session types
- [ ] Multiple participations on same day handled correctly
- [ ] Month navigation works (previous/next)
- [ ] Day click shows participation details
- [ ] Back button returns to search
- [ ] Loading states work correctly
- [ ] Empty states display properly
- [ ] Arabic day/month names display correctly
- [ ] Responsive on mobile/tablet/desktop
- [ ] RTL layout correct

---

## Future Enhancements (Out of Scope)

- Additional stats section (counts, streaks, averages, etc.)
- Export student data to CSV
- Filter calendar by session type
- Year view / Multi-month view
- Compare multiple students
- Charts/graphs for participation trends
- Streak tracking (consecutive days/weeks)
- Bulk actions on students
