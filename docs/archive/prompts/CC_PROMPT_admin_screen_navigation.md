# CC_PROMPT_admin_screen_navigation — Wire AdminScreen into Profile Settings → Developer

**Phase:** Cross-cutting (8D-CP1 verification unblocker)
**Estimated:** ~10 minutes
**Authored by:** Claude.ai planning, 2026-05-18

---

## Context

`screens/AdminScreen.tsx` exists in the repo and was extended by 8D-CP1 with a "Pantry Matching (8D-CP1)" section containing a "Run pantry matching smoke tests" button. Tom needs to run those tests to verify CP1.

Problem: AdminScreen is imported in `App.tsx` and listed in `RootTabParamList` (as `Admin: undefined`), but it is **NOT** registered as a `<Tab.Screen>` in the Tab.Navigator, and no other screen pushes to it. It's currently unreachable from the running app.

This prompt makes AdminScreen reachable via the existing Developer section in Settings — mirroring the established `LogoPlayground` pattern. Profile tab → Settings → Developer → Admin Tools → AdminScreen.

This is a tiny mechanical patch — three files, ~20 lines of change total. No new components, no design decisions.

---

## Inputs to read

1. `App.tsx` — `ProfileStackParamList` type around line 252, `ProfileStackNavigator` function around line 670 (where `LogoPlayground` is registered).
2. `screens/SettingsScreen.tsx` — Developer section around line 396, immediately after the existing LogoPlayground TouchableOpacity (~line 409).
3. `screens/AdminScreen.tsx` — no edits, just confirm the file exists and default-exports `AdminScreen`.

---

## Task

### Step 1 — Register AdminScreen in `ProfileStack`

In `App.tsx`:

**1a.** Add `Admin: undefined` to `ProfileStackParamList`:

```typescript
export type ProfileStackParamList = {
  ProfileHome: undefined;
  Settings: undefined;
  EditProfile: undefined;
  LogoPlayground: undefined;
  Admin: undefined;  // NEW — dev-only screen, reachable from Settings → Developer
};
```

**1b.** Add a `<ProfileStack.Screen>` for AdminScreen in `ProfileStackNavigator`, immediately after the existing `LogoPlayground` registration (currently around line 678-687). Mirror the LogoPlayground pattern exactly:

```typescript
<ProfileStack.Screen
  name="Admin"
  component={AdminScreen}
  options={{
    headerShown: true,
    title: 'Admin Tools',
  }}
/>
```

`AdminScreen` is already imported at the top of `App.tsx` (line 29) — no new import needed.

**1c.** Clean up the orphan `Admin: undefined` entry in `RootTabParamList` (currently around line 284). It was scaffolded for a tab that was never built and is now misleading. Delete just that line:

```typescript
// BEFORE
export type RootTabParamList = {
  FeedStack: undefined;
  RecipesStack: undefined;
  MealsStack: undefined;
  StatsStack: undefined;
  PantryStack: undefined;
  GroceryStack: undefined;
  Stores: undefined;
  Admin: undefined;  // ← delete this line only
};

// AFTER
export type RootTabParamList = {
  FeedStack: undefined;
  RecipesStack: undefined;
  MealsStack: undefined;
  StatsStack: undefined;
  PantryStack: undefined;
  GroceryStack: undefined;
  Stores: undefined;
};
```

If there are no other references to `RootTabParamList.Admin` anywhere in the codebase (verify with `grep -rn "Admin" --include="*.tsx" --include="*.ts" /path/to/repo | grep -v "AdminScreen"`), this delete is safe. If `grep` finds anything depending on the orphan declaration, STOP and report — do not delete in that case.

### Step 2 — Add the "Admin Tools" row in `SettingsScreen.tsx`

Add a new `TouchableOpacity` to the Developer section, directly below the existing LogoPlayground row (currently lines 400-409). Mirror the LogoPlayground pattern:

```typescript
<TouchableOpacity
  style={styles.row}
  onPress={() => navigation.navigate('Admin')}
>
  <View style={styles.rowLeft}>
    <Text style={styles.rowIcon}>🛠️</Text>
    <Text style={styles.rowTitle}>Admin Tools</Text>
  </View>
  <Text style={styles.chevron}>›</Text>
</TouchableOpacity>
```

Insert it AFTER the existing LogoPlayground TouchableOpacity (ending at line 409) and BEFORE the next TouchableOpacity (the "Backfill Chef IDs" one starting at line 411).

---

## Constraints

- **No changes to AdminScreen.tsx itself.** The smoke test button + section CC added during 8D-CP1 is correct as-is.
- **No new imports needed in App.tsx** — `AdminScreen` is already imported on line 29.
- **No styling changes.** Reuse the exact same `styles.row`, `styles.rowLeft`, `styles.rowIcon`, `styles.rowTitle`, `styles.chevron` classes from SettingsScreen.
- **No header rename, no decorative changes.** Title is exactly "Admin Tools" with the 🛠️ icon. Header on the AdminScreen route is `title: 'Admin Tools'`.
- **Don't touch any other Developer-section rows** ("Backfill Chef IDs", anything below it). They're already wired and working.
- **Don't delete the orphan `Admin: undefined` in `RootTabParamList`** if `grep` finds dependencies. Report instead — Claude.ai will reconcile.
- **STOP and report** if `ProfileStackNavigator` is structured differently than expected (e.g., uses a different stack component or wrapping pattern), or if the SettingsScreen Developer section's row structure is different from the LogoPlayground pattern.

---

## Verification

Before writing the SESSION_LOG entry:

1. **TypeScript compiles.** Run `npx tsc --noEmit`. Report new errors. Should be zero — this is purely additive wiring using existing types and styles.
2. **`AdminScreen` is registered in ProfileStack.** Grep `App.tsx` for `name="Admin"`. Should find exactly one match in `ProfileStackNavigator`.
3. **`ProfileStackParamList.Admin` exists.** Grep `App.tsx` for `Admin: undefined` — should find one match (in ProfileStackParamList). If the orphan delete in 1c succeeded, the count is 1; if 1c was skipped due to dependencies, count is 2 (one in each list).
4. **`RootTabParamList.Admin` is removed** (if 1c proceeded) or **explicitly preserved** (if 1c was blocked by dependencies). Report which.
5. **Settings row exists.** Grep `screens/SettingsScreen.tsx` for `navigation.navigate('Admin')` — should find one match.
6. **Row uses correct styles.** Confirm the new TouchableOpacity uses `styles.row`, `styles.rowLeft`, `styles.rowIcon`, `styles.rowTitle`, `styles.chevron` (matching LogoPlayground exactly).

On-device verification (Tom runs separately):
- Profile tab → Settings → scroll to Developer section → see new "🛠️ Admin Tools" row below "🎨 Logo Playground".
- Tap "Admin Tools" → AdminScreen opens with header showing "Admin Tools" and a back button.
- Scroll down to "Pantry Matching (8D-CP1)" section → tap "Run pantry matching smoke tests" → smoke results stream in Metro console.

---

## SESSION_LOG entry format

```markdown
## 2026-MM-DD — Cross-cutting: AdminScreen reachable via Settings → Developer
**Phase:** cross-cutting (8D-CP1 verification unblocker)
**Prompt from:** CC_PROMPT_admin_screen_navigation.md

Wired the existing `AdminScreen` into ProfileStack navigation so its diagnostic
tools (including 8D-CP1's smoke test runner) are reachable from the running
app. Pattern mirrors the existing LogoPlayground developer-tool wiring.

**Files modified:**
- `App.tsx` (ProfileStackParamList + Screen registration; optional orphan delete in RootTabParamList) ⚠️ PK snapshot now stale (was YYYY-MM-DD)
- `screens/SettingsScreen.tsx` (Admin Tools row in Developer section) ⚠️ PK snapshot now stale (was YYYY-MM-DD)

**Verification results:**
- TypeScript: [N new errors / clean]
- AdminScreen Profile registration: ✅
- ProfileStackParamList.Admin: ✅
- RootTabParamList orphan: [removed / preserved due to dependencies]
- Settings row added: ✅
- Styles match LogoPlayground pattern: ✅

**Recommended doc updates:**
- `FRIGO_ARCHITECTURE.md`: note AdminScreen is now reachable via Profile → Settings → Developer → Admin Tools (was unreachable since [unknown date — possibly always]). Update the Screens table accordingly.
- `DEFERRED_WORK.md`: none (this resolves an implicit gap).
- `PROJECT_CONTEXT.md`: none.
- `FF_LAUNCH_MASTER_PLAN.md`: none.

**Recommended next steps for Tom:**
1. On-device: open Profile → Settings → Developer → tap Admin Tools → confirm AdminScreen opens.
2. Run the "Run pantry matching smoke tests" button → paste the `[SMOKE-N]` console results in chat for Claude.ai triage.
3. Once smoke is verified, Tom commits the CP1 code changes (service + smoke test + 3 screen edits + this nav wiring) as one or two commits.

**Surprises / Notes for Claude.ai:**
[Anything unexpected — e.g., orphan delete blocked by a dependency, Settings row structure surprise.]
```

---

## Open questions (STOP conditions)

1. **`RootTabParamList.Admin` has dependencies elsewhere in the code.** Don't delete; report and let Claude.ai decide.
2. **`ProfileStackNavigator` doesn't follow the standard `createNativeStackNavigator` pattern** — e.g., a wrapping HOC or non-standard Screen config. Report.
3. **`SettingsScreen` Developer section is structured differently** — e.g., uses a FlatList or array-driven render instead of inline JSX. Report which pattern and adapt accordingly.
