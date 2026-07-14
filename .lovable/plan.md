The Recharts `Tooltip` on the dashboard pie chart (and the matching bar chart / reports pie chart) uses `contentStyle` for the container background but does not explicitly set the label/item text color. In dark mode the tooltip text inherits a low-contrast color against the dark popover background, making it unreadable.

Plan:
1. Update the shared `tooltipStyle` object in `src/routes/index.tsx` to explicitly set `labelStyle` and `itemStyle` colors via `var(--popover-foreground)`.
2. Apply the same explicit text colors to the `Tooltip` in `src/routes/reports.tsx`.
3. Verify the tooltip is readable on hover in the live preview for both the dashboard category pie and the reports category pie.

No functional changes; this is purely a chart tooltip contrast fix.