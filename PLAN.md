# Students View Implementation Plan

## Overview
Create a new students view where admins can search for students and view their attendance and participation statistics.

---

## Current System Analysis

### Routing
- Uses `wouter` for client-side routing
- Routes defined in `packages/web/src/App.tsx`
- Existing routes:
  - `/` - Home (posts list)
  - `/posts/:chatId/:postId` - Post detail
  - `/posts/:chatId/:postId/summary` - Participation summary

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

### Phase 1: Backend - Database Queries

**File**: `packages/db/convex/queries.ts`

#### 1.1 Create `getUserParticipationStats` query
Query to fetch comprehensive stats for a single user:

```typescript
getUserParticipationStats(userId: number)
```

**Returns**:
- **User Info**: `userId`, `telegramName`, `realName`, `username`
- **Overall Stats**:
  - Total attendance (unique posts attended)
  - Total participations (completed turns)
  - Participation rate (participations / attendance)
  - List of attended posts with dates
- **By Session Type**:
  - Count per type: تلاوة, تسميع, تطبيق, اختبار, تعويض
  - Percentage of each type
- **Recent Activity**:
  - Last 10 participations with date, sessionType, and post info
  - Last attendance date

**Implementation approach**:
1. Query `users` table for user info
2. Query `participationHistory` by userId index
3. Query `turnQueue` by userId (for pending turns)
4. Group participations by:
   - Unique (chatId, postId) for attendance count
   - sessionType for type breakdown
5. Sort and format results

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
- When user selected: Show stats (using `getUserParticipationStats` query)
- Click on search result: Set `selectedUserId` and clear search

---

### Phase 3: Frontend - Student Stats Component

**File**: `packages/web/src/components/StudentStats.tsx`

#### 3.1 Create StudentStats display component

**Props**:
- `userId: number`
- `onBack: () => void` - Callback to return to search

**Sections**:

1. **Header**
   - Student name (realName or telegramName)
   - Username badge
   - Back button

2. **Overall Stats Cards** (3-column grid)
   - إجمالي الحضور (Total Attendance)
   - إجمالي المشاركات (Total Participations)
   - نسبة المشاركة (Participation Rate %)

3. **Participation by Type** (Card grid)
   - تلاوة count + percentage
   - تسميع count + percentage
   - تطبيق count + percentage
   - اختبار count + percentage
   - تعويض count + percentage (if any)

4. **Recent Activity** (Scrollable list)
   - Last 10 participations
   - Each showing: Date, Session type, Post ID
   - Formatted with Arabic dates

**Component Structure**:
```tsx
<div>
  <Button onClick={onBack}>رجوع</Button>

  <h1>{student.realName || student.telegramName}</h1>

  <div className="grid grid-cols-3">
    <StatCard title="إجمالي الحضور" value={stats.totalAttendance} />
    <StatCard title="إجمالي المشاركات" value={stats.totalParticipations} />
    <StatCard title="نسبة المشاركة" value={stats.participationRate + '%'} />
  </div>

  <h2>حسب نوع المشاركة</h2>
  <div className="grid grid-cols-2">
    {sessionTypes.map(type => (
      <TypeCard type={type} stats={stats.byType[type]} />
    ))}
  </div>

  <h2>النشاط الأخير</h2>
  <ActivityList activities={stats.recentActivity} />
</div>
```

---

### Phase 4: Integration

#### 4.1 Add route to App.tsx

**File**: `packages/web/src/App.tsx`

Add route:
```tsx
<Route path="/students" component={Students} />
```

#### 4.2 Add navigation to Layout (Optional)

Consider adding a navigation link to the students page from the main layout or home page.

---

## File Changes Summary

### New Files
1. `packages/web/src/routes/Students.tsx` - Main students page
2. `packages/web/src/components/StudentStats.tsx` - Stats display component

### Modified Files
1. `packages/db/convex/queries.ts` - Add `getUserParticipationStats` query
2. `packages/web/src/App.tsx` - Add `/students` route

---

## Technical Decisions

### Why separate Stats component?
- Keeps Students page focused on search
- Reusable if needed elsewhere
- Cleaner state management

### Why not create a new table?
- All needed data exists in `participationHistory` and `users`
- Computed stats ensure real-time accuracy
- No need for data duplication or sync

### Search implementation
- Reuse existing `searchUsers` query (already optimized)
- Follow established pattern from `AddUserModal`
- Consistent UX with existing search

### Stats calculation
- Server-side in Convex query (faster, less client processing)
- Use indexes: `by_user` on participationHistory
- Efficient grouping with JavaScript Map/Set

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

- [ ] Search finds users correctly
- [ ] Stats display for user with participations
- [ ] Stats display for user without participations
- [ ] Back button returns to search
- [ ] Loading states work correctly
- [ ] Empty states display properly
- [ ] Numbers formatted in Arabic
- [ ] Dates formatted in Arabic
- [ ] Responsive on mobile/tablet/desktop
- [ ] RTL layout correct

---

## Future Enhancements (Out of Scope)

- Export student stats to CSV
- Filter by date range
- Compare multiple students
- Charts/graphs for participation trends
- Search by participation type
- Bulk actions on students
