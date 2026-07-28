## Auto-close mobile sidebar on navigation

On mobile, the sheet-style sidebar stays open after tapping a nav link, forcing the user to close it manually. Shadcn's `useSidebar` exposes `isMobile` and `setOpenMobile` — use them to close the drawer whenever a menu link is clicked.

### Change (`src/components/app-sidebar.tsx`)
- Read `isMobile` and `setOpenMobile` from `useSidebar()`.
- On each `SidebarMenuButton` link, add an `onClick` that calls `setOpenMobile(false)` when `isMobile` is true. Navigation still runs normally through the TanStack `<Link>`.
- Apply the same to the footer's Sign out action for consistency.

No changes to desktop behavior (icon-collapse remains). No layout or routing changes.
