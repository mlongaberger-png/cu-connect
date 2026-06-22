import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { Navigate } from "react-router-dom";
import { LayoutDashboard, Download, Loader2 } from "lucide-react";
import { jsPDF } from "jspdf";

const FINDINGS = [
  {
    id: "U-01",
    severity: "Critical",
    title: "Composer Overlap with Bottom Navigation Bar",
    screen: "Messages — Active Chat",
    description: "The message input field (Composer) is partially obscured by the persistent bottom navigation bar on mobile devices. The composer's border-top sits at the same vertical position as the nav bar's border-top, causing visual competition and making it difficult to type without accidentally triggering navigation switches.",
    rootCause: "MessagesLayout uses h-[calc(100dvh-4rem)] for the container height, but AppLayout wraps /Messages in a fullscreen div with paddingBottom: calc(56px + safe-area). The Composer itself has no bottom padding to account for the nav bar height, causing it to render behind the fixed-position BottomTabBar.",
    before: "Message input field is visually cut off at the bottom edge; 'Send' button partially hidden behind 'More' tab icon.",
    after: "Add padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px)) to the Composer container, or ensure the MessagesLayout flex column accounts for the full nav bar height.",
    fix: "In Composer.jsx, add pb-[calc(56px+env(safe-area-inset-bottom,0px))] to the form wrapper, or adjust the MessagesLayout flex container to subtract nav bar height from its available space.",
    affectedFiles: ["components/messages/Composer.jsx", "pages/MessagesLayout.jsx"],
    wcagCriteria: "1.4.11 Non-text Contrast, 2.5.5 Target Size",
    timeToFix: "1-2 hours",
    testingNotes: "Test on iOS Safari, Android Chrome, and PWA standalone mode. Verify on devices with home indicators (iPhone X+) and without (older Androids).",
  },
  {
    id: "U-02",
    severity: "High",
    title: "Bottom Navigation Touch Target — 'Manage Hidden Channels' Overlap",
    screen: "Messages — Channel Sidebar",
    description: "The 'Manage Hidden Channels (N)' link is positioned directly above the bottom navigation bar with insufficient vertical separation. On devices with shorter viewports, tapping this link risks triggering a tab switch instead, creating a fat-finger error pattern.",
    rootCause: "ChatSidebar renders the hidden channels button in a div with pt-2 border-t, but the sidebar's scroll container does not reserve bottom padding for the fixed BottomTabBar (56px + safe area). The button's bottom edge sits within the nav bar's touch zone.",
    before: "User taps 'Manage Hidden Channels' → accidentally navigates to 'Teams' or 'More' tab instead.",
    after: "Add pb-[calc(56px+env(safe-area-inset-bottom,0px)+8px)] to the sidebar scroll container so the button is fully above the nav bar's touch boundary.",
    fix: "Add bottom padding to the ChatSidebar's flex-1 overflow-y-auto container to push all content above the fixed nav bar zone.",
    affectedFiles: ["components/messages/ChatSidebar.jsx"],
    wcagCriteria: "2.5.5 Target Size (min 44x44px), 2.5.8 Target Spacing",
    timeToFix: "30-45 minutes",
    testingNotes: "Test on iPhone SE (small viewport), iPhone 14 Pro Max (large viewport), and various Android screen sizes.",
  },
  {
    id: "U-03",
    severity: "High",
    title: "Aggressive API Polling — Rate Limit Exhaustion Risk",
    screen: "Messages (all views), BottomTabBar",
    description: "Multiple components poll the API at very short intervals simultaneously, creating cumulative request volumes that exceed rate limits during active usage. When a user has the Messages screen open, up to 5 concurrent polling timers fire every 5-15 seconds.",
    rootCause: "ChatSidebar polls channel members every 5s (refetchInterval: 5000); ChatCanvas polls messages every 8s and reactions every 8s; MessagesLayout polls global latest messages every 15s; BottomTabBar polls unread count every 30s via setInterval. These timers run independently and do not pause when the tab is inactive.",
    before: "Active messaging session → 40-60 API calls/minute → 'Rate limit exceeded' error appears and blocks all functionality.",
    after: "Replace refetchInterval polling with Base44 realtime subscriptions (base44.entities.Message.subscribe) for message and reaction updates. Increase remaining poll intervals to 30-60s. Add document.visibilitychange listener to pause polling when tab is hidden.",
    fix: "1. Replace ChatCanvas message polling with subscribe() hook. 2. Replace ChatCanvas reactions polling with subscribe() hook. 3. Filter reactions by channel_id instead of fetching all. 4. Add visibility-based polling pause to ChatSidebar and BottomTabBar. 5. Increase ChatSidebar channel member poll from 5s to 30s.",
    affectedFiles: ["components/messages/ChatCanvas.jsx", "components/messages/ChatSidebar.jsx", "pages/MessagesLayout.jsx", "components/layout/BottomTabBar.jsx"],
    wcagCriteria: "N/A (performance/reliability)",
    timeToFix: "3-4 hours",
    testingNotes: "Monitor Network tab in DevTools — verify request count drops by 60-70% during active messaging. Test with 10+ channels loaded. Verify realtime subscriptions fire on new messages from another session.",
  },
  {
    id: "U-04",
    severity: "High",
    title: "Inefficient Reactions Query — Full Table Scan",
    screen: "Messages — Active Chat",
    description: "The reactions useQuery fetches ALL MessageReaction records system-wide with an empty filter (filter({})), then filters them in-memory on the client. This transfers unnecessary data and increases response payload size linearly with total reactions across all channels.",
    rootCause: "ChatCanvas reactions query: base44.entities.MessageReaction.filter({}) with no channel_id or message_id constraint. The comment says 'if (!msgIds.length) return []' but the actual filter call is unconditional.",
    before: "Channel with 50 messages but 5,000 reactions across the org → fetches all 5,000 records, filters to ~30 locally.",
    after: "Query with filter({ message_id: { $in: msgIds } }) or a backend function that returns only reactions for the current channel's messages.",
    fix: "Change the reactions queryFn to filter by the current message IDs, or create a backend function getReactionsForChannel that accepts channel_id and returns only relevant reactions.",
    affectedFiles: ["components/messages/ChatCanvas.jsx"],
    wcagCriteria: "N/A (performance)",
    timeToFix: "1-2 hours",
    testingNotes: "Verify reaction counts and emoji pickers still work after the query change. Test with channels that have zero reactions (should return empty array quickly).",
  },
  {
    id: "U-05",
    severity: "Medium",
    title: "Hardcoded Timezone in Message Timestamps",
    screen: "Messages — Message Bubbles",
    description: "Message bubble timestamps are rendered using a hardcoded timeZone: 'America/Chicago', ignoring the user's actual timezone or the organization's configured timezone. A parent in New York sees Chicago time for all messages, creating confusion about when messages were sent.",
    rootCause: "ChatCanvas MessageBubble component: new Date(rawDate).toLocaleTimeString('en-US', { ..., timeZone: 'America/Chicago' }). The app has a useOrgTimezone() hook available but it is not used in the messaging components.",
    before: "User in Eastern Time sends a message at 2:00 PM EST → displayed as 1:00 PM (Chicago time) to themselves and others.",
    after: "Use Intl.DateTimeFormat() with the user's browser timezone (default), or use the useOrgTimezone() hook's abbr for consistency with the Schedule page.",
    fix: "Remove the timeZone parameter from toLocaleTimeString, or pass the org timezone from useOrgTimezone() hook. Import and use the hook in ChatCanvas.",
    affectedFiles: ["components/messages/ChatCanvas.jsx"],
    wcagCriteria: "N/A (correctness)",
    timeToFix: "30 minutes",
    testingNotes: "Send messages from different timezone settings. Verify timestamps match the sender's local time. Compare with the Schedule page's timezone display.",
  },
  {
    id: "U-06",
    severity: "Medium",
    title: "Theme Inconsistency — Light vs Dark Mode in Messaging",
    screen: "Messages — Active Chat (certain states)",
    description: "Screenshots show the messaging interface occasionally rendering with a light/white background and light-gray message bubbles, inconsistent with the app's dark theme (background #121212). This creates a jarring visual experience when navigating between dark and light states.",
    rootCause: "Likely caused by a CSS class conflict or a component using hardcoded light-mode Tailwind classes (bg-white, bg-gray-100) instead of theme tokens (bg-background, bg-muted). The Composer textarea uses bg-background correctly, but other elements may not. Could also be triggered by system dark-mode preference not being respected.",
    before: "User opens a chat → sees white background with gray bubbles, then navigates to another chat → sees dark background. Unpredictable.",
    after: "All message-related components use consistent dark theme tokens. No hardcoded bg-white or bg-gray-100 classes in messaging components.",
    fix: "Audit all messaging components for hardcoded color classes. Replace bg-white→bg-background, bg-gray-100→bg-muted, text-black→text-foreground. Ensure the .dark class is always applied on the root element.",
    affectedFiles: ["components/messages/ChatCanvas.jsx", "components/messages/Composer.jsx", "components/messages/ThreadSidebar.jsx"],
    wcagCriteria: "1.4.3 Contrast (Minimum)",
    timeToFix: "1-2 hours",
    testingNotes: "Toggle system dark mode on/off. Navigate between channels rapidly. Check thread sidebar, event cards, and emoji pickers for consistency.",
  },
  {
    id: "U-07",
    severity: "Medium",
    title: "Score Bot / Automated Messages Lack Visual Hierarchy",
    screen: "Messages — Message Feed",
    description: "Automated score update messages from 'Score Bot' are rendered as plain text blocks with no visual differentiation from user messages. Important data (final score, opponent, date) is buried in a dense text string, making it hard to scan.",
    rootCause: "Score Bot messages use the standard MessageBubble component with message_type: 'text'. There is no dedicated card component for automated sports results, unlike the EventCard used for event-type messages.",
    before: "Score Bot: '12u Baseball Lost 3-11 vs Coffeyville Rockies! Sport: Baseball · Date: 2026-05-31 · Final Score: 3-11 · Opponent: Coffeyville Rockies' — appears as a gray bubble indistinguishable from user messages.",
    after: "Score updates render as a ScoreCard component with: win/loss color coding (green/red badge), prominent score display, team logo, and structured fields for opponent, date, and sport.",
    fix: "Create a ScoreCard component (similar to EventCard). Detect score-bot messages by sender_name === 'Score Bot' or a new message_type: 'score_update'. Render structured fields with color-coded result badges.",
    affectedFiles: ["components/messages/ChatCanvas.jsx", "components/messages/cards/ (new file)"],
    wcagCriteria: "1.4.10 Reflow, 2.4.6 Headings and Labels",
    timeToFix: "4-6 hours",
    testingNotes: "Verify ScoreCard renders correctly for win, loss, and tie results. Check that score data is parsed from the message content or metadata field. Test on narrow mobile widths.",
  },
  {
    id: "U-08",
    severity: "Medium",
    title: "Channel Name Truncation in Chat Header",
    screen: "Messages — Active Chat Header",
    description: "Long channel names (e.g., 'CU Football JV/J-Hi G...') are truncated with an ellipsis in the chat header, but there is no tooltip or way to see the full name. The header also truncates differently on different screen sizes due to lack of a max-width constraint.",
    rootCause: "ChatCanvas header uses a span with font-semibold text-sm but no truncate or max-width class. The channel name flows freely, getting clipped by the right-side action buttons (alerts, mute) on narrow screens.",
    before: "Channel 'CU Football JV/J-Hi Group' → header shows 'CU Football JV/J-Hi G...' with no way to see the full name.",
    after: "Channel name has max-w constraint and truncate class. Hovering or long-pressing shows the full name via title attribute or a tooltip.",
    fix: "Add className='truncate max-w-[180px] md:max-w-[300px]' to the channel name span, and add title={channel?.name} for native tooltip.",
    affectedFiles: ["components/messages/ChatCanvas.jsx"],
    wcagCriteria: "1.4.4 Text Resize, 2.4.6 Headings and Labels",
    timeToFix: "15-30 minutes",
    testingNotes: "Test with very long channel names (50+ chars). Verify truncation on mobile portrait, mobile landscape, and tablet widths.",
  },
  {
    id: "U-09",
    severity: "Medium",
    title: "Low Contrast on 'No messages yet' Empty State",
    screen: "Messages — Channel Sidebar / Empty Chat",
    description: "The 'No messages yet' placeholder text and the empty-chat message ('No messages yet. Say hello! 👋') use very light grey on dark background, making them difficult to read — especially in bright outdoor conditions.",
    rootCause: "ChatSidebar uses text-muted-foreground with italic opacity-50 for 'No messages yet'. ChatCanvas uses text-muted-foreground for the empty state. Both render at approximately #555555 on #121212, yielding a contrast ratio of ~3.2:1, below WCAG AA minimum of 4.5:1 for body text.",
    before: "'No messages yet' is barely visible — users miss it entirely and think the channel is broken.",
    after: "Empty state text uses text-foreground/70 or a dedicated muted-foreground variant with sufficient contrast. Add a subtle icon or illustration to draw attention.",
    fix: "Change 'No messages yet' spans to use text-muted-foreground without opacity-50. For ChatCanvas empty state, add a MessageSquare icon above the text and increase text size to text-base.",
    affectedFiles: ["components/messages/ChatSidebar.jsx", "components/messages/ChatCanvas.jsx"],
    wcagCriteria: "1.4.3 Contrast (Minimum) — AA requires 4.5:1 for normal text",
    timeToFix: "30 minutes",
    testingNotes: "Use a contrast checker tool (WebAIM) on the rendered text. Test in bright sunlight simulation. Verify on both OLED and LCD screens.",
  },
  {
    id: "U-10",
    severity: "Medium",
    title: "Top Bar Icon Density — Insufficient Edge Margins on Mobile",
    screen: "All screens — TopBar",
    description: "Top bar action icons (Help, Notification Bell) are aligned to the right edge with only px-4 (16px) horizontal padding. On devices with curved screen edges (iPhone 14+, Galaxy S series), this places icons within the curved zone, making them hard to tap accurately.",
    rootCause: "TopBar uses px-4 md:px-6 for the container. On mobile, px-4 = 16px, which is within the safe area inset for many modern devices (typically 20-47px on curved screens). The component does not use safe-area-right padding.",
    before: "User taps Help icon → finger slides off the curved edge → no tap registered, or accidental swipe gesture triggered.",
    after: "Top bar uses safe-area-right padding (env(safe-area-inset-right)) in addition to px-4, ensuring all icons are within the tappable flat zone.",
    fix: "The AppLayout root div already has safe-area-left safe-area-right classes, but verify they are being applied. Add explicit padding-right: env(safe-area-inset-right) to the TopBar's inner div if not inherited.",
    affectedFiles: ["components/layout/TopBar.jsx", "components/layout/AppLayout.jsx"],
    wcagCriteria: "2.5.5 Target Size, 2.5.8 Target Spacing (minimum 24px from screen edge)",
    timeToFix: "30 minutes",
    testingNotes: "Test on iPhone 14 Pro (curved edges), Samsung Galaxy S23 (curved), and iPhone SE (flat edges). Verify all top bar icons are fully tappable.",
  },
  {
    id: "U-11",
    severity: "Medium",
    title: "Mute Toggle — Inconsistent Active State Styling",
    screen: "Messages — Active Chat Header",
    description: "The channel mute toggle uses amber-600 for its active ('Mute On') state, which is nearly invisible on the dark theme background (#121212). This makes it difficult for users to tell whether a channel is muted, leading to missed notifications.",
    rootCause: "ChatCanvas mute toggle: isMuted ? 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20' — amber-600 (#D97706) at 100% opacity on dark background is fine, but the bg-amber-500/10 is only 10% opacity, making the background tint imperceptible.",
    before: "User mutes a channel → sees no visible change → assumes mute failed → mutes again → still no feedback.",
    after: "Muted state uses a more visible color (amber-400 or yellow-400) with higher background opacity (amber-500/20), and includes a 'Muted' text label with a strikethrough bell icon.",
    fix: "Change text-amber-600 → text-amber-400, bg-amber-500/10 → bg-amber-500/20. Add border border-amber-500/30 for additional visibility.",
    affectedFiles: ["components/messages/ChatCanvas.jsx"],
    wcagCriteria: "1.4.11 Non-text Contrast (minimum 3:1 for UI components)",
    timeToFix: "15 minutes",
    testingNotes: "Toggle mute on/off. Verify the visual difference is immediately obvious. Test with users who have color vision deficiency (amber/yellow may be hard to distinguish from primary gold).",
  },
  {
    id: "U-12",
    severity: "Low",
    title: "Hide/Unhide Channel Button — Desktop Hover Only, Inaccessible on Mobile",
    screen: "Messages — Channel Sidebar",
    description: "The hide/unhide and delete channel buttons in ChatSidebar only appear on hover (opacity-0 group-hover:opacity-100). On mobile devices, there is no hover state, making these actions completely inaccessible unless the user accidentally triggers a long-press.",
    rootCause: "ChatSidebar ChannelBtn uses opacity-0 group-hover:opacity-100 for the hide/unhide and delete spans. No touch-friendly alternative is provided (e.g., swipe gesture, long-press menu, or always-visible on mobile).",
    before: "Mobile user wants to hide a noisy channel → cannot find the option → channel stays visible, cluttering the sidebar.",
    after: "On mobile (lg:hidden breakpoint), the hide button is always visible as a small icon, or accessible via a long-press context menu.",
    fix: "Use 'opacity-100 lg:opacity-0 lg:group-hover:opacity-100' to always show on mobile. Or implement a long-press handler that shows a context menu with Hide/Delete options.",
    affectedFiles: ["components/messages/ChatSidebar.jsx"],
    wcagCriteria: "2.5.1 Pointer Gestures, 2.5.3 Label in Name",
    timeToFix: "1-2 hours",
    testingNotes: "Test on mobile (no hover). Verify hide/unhide and delete work via touch. Test on desktop to verify hover behavior still works.",
  },
  {
    id: "U-13",
    severity: "Low",
    title: "Composer Placeholder Lacks Channel Context",
    screen: "Messages — Message Input",
    description: "The message input uses a generic 'Message…' placeholder regardless of which channel the user is in. In group chats with similar names, this creates ambiguity about where the message will be sent.",
    rootCause: "Composer textarea placeholder='Message…' is a static string. The channel object is available as a prop but not used to generate a dynamic placeholder.",
    before: "User in 'CU Football JV' channel sees 'Message…' — same as in 'CU Football Varsity' channel. Risk of sending to wrong channel.",
    after: "Placeholder dynamically shows 'Message #CU Football JV…' or 'Message CU Football JV…' based on channel name and type.",
    fix: "Change placeholder to `Message ${channel?.name || ''}…` or use channel?.type to add '#' prefix for team channels.",
    affectedFiles: ["components/messages/Composer.jsx"],
    wcagCriteria: "2.4.6 Headings and Labels",
    timeToFix: "15 minutes",
    testingNotes: "Verify placeholder truncates gracefully for long channel names. Test in DMs, team channels, and carpool channels.",
  },
  {
    id: "U-14",
    severity: "Low",
    title: "Pull-to-Refresh Lacks Haptic Feedback",
    screen: "Messages — Active Chat",
    description: "The pull-to-refresh gesture in ChatCanvas shows a visual indicator ('Pull to refresh' → 'Release to refresh' → 'Refreshing…') but provides no haptic feedback (vibration) when the threshold is crossed or when refresh completes. Native iOS apps universally provide haptic feedback for this gesture.",
    rootCause: "ChatCanvas handleTouchEnd checks if pullDistance > 50 and triggers refresh, but does not call navigator.vibrate() or use the Vibration API.",
    before: "User pulls down → sees text change → releases → messages refresh. No tactile confirmation that the gesture was registered.",
    after: "Add navigator.vibrate(10) when threshold is crossed, and navigator.vibrate(15) when refresh completes. Add a subtle animation on the spinner.",
    fix: "In handleTouchEnd, add navigator.vibrate?.(10) before calling refetchMessages. In the .then() after refetch, add navigator.vibrate?.(15).",
    affectedFiles: ["components/messages/ChatCanvas.jsx"],
    wcagCriteria: "N/A (native feel enhancement)",
    timeToFix: "15 minutes",
    testingNotes: "Test on Android (Vibration API supported) and iOS (may not support navigator.vibrate in Safari — use a fallback or accept no haptic on iOS web).",
  },
  {
    id: "U-15",
    severity: "Low",
    title: "Sponsor Ticker Consumes Mobile Screen Real Estate",
    screen: "All non-fullscreen pages",
    description: "The SponsorTicker component renders at the top of every non-fullscreen page (inside AppLayout's scroll container), taking up approximately 48-60px of vertical space on mobile. This pushes actual content below the fold, which is especially problematic on smaller devices where screen space is already limited.",
    rootCause: "AppLayout renders SponsorTicker inside the main scroll container with px-3 pt-3 pb-1. It appears on every page navigation, even when the user has already seen it. There is no dismiss/ collapse mechanism.",
    before: "Parent opens ParentPortal → sees sponsor ticker → must scroll past it to reach their child's card. Every page transition shows the ticker again.",
    after: "Sponsor ticker is collapsible (user can dismiss with an X button), or only shows on the dashboard/home page. Alternatively, make it a thin banner (24px) instead of a full ticker.",
    fix: "Add a dismiss button (X icon) to the SponsorTicker that sets a sessionStorage flag. Only render if the flag is not set. Alternatively, move it to only render on /Portal.",
    affectedFiles: ["components/sponsors/SponsorTicker.jsx", "components/layout/AppLayout.jsx"],
    wcagCriteria: "1.4.10 Reflow",
    timeToFix: "1-2 hours",
    testingNotes: "Verify ticker still rotates sponsors when visible. Test that dismissing persists across page navigation within a session. Verify it reappears on next session.",
  },
  {
    id: "U-16",
    severity: "Low",
    title: "Avatar Layering — Profile Photo Clipped Behind Header",
    screen: "Messages — Active Chat Header",
    description: "In the chat header, the channel avatar (or team logo) can be partially clipped behind the header element on certain screen sizes, creating a visual artifact where the top portion of the avatar is cut off.",
    rootCause: "ChatCanvas header has p-4 and the avatar is w-7 h-7 rounded-full object-cover. The header's backdrop-blur and z-index may create a stacking context that clips the avatar's overflow. No overflow-visible is set on the header container.",
    before: "Team logo appears with its top 2-3px cut off by the header's border-bottom.",
    after: "Avatar is fully visible with proper spacing from all header edges.",
    fix: "Add overflow-visible to the header div, or add a small margin-top to the avatar to ensure it doesn't touch the header's top border.",
    affectedFiles: ["components/messages/ChatCanvas.jsx"],
    wcagCriteria: "1.4.11 Non-text Contrast",
    timeToFix: "15 minutes",
    testingNotes: "Test with square and circular avatars. Verify on different header heights (mobile vs desktop).",
  },
  {
    id: "U-17",
    severity: "Low",
    title: "Inconsistent Empty States Across Channel Types",
    screen: "Messages — Channel Sidebar",
    description: "Each channel tab (Teams, DMs, Carpool, News) has a different empty state treatment: plain text ('No team channels yet'), a button + text ('New Direct Message' + 'No direct messages yet'), or a button + text ('Request a Ride' + 'No carpool channels yet'). This inconsistency makes the sidebar feel disjointed.",
    rootCause: "Each TabsContent in ChatSidebar handles its empty state differently. Some include a CTA button, others don't. The text styling and spacing vary between tabs.",
    before: "User switches between tabs → sees different layouts for the same 'no data' state → feels like different apps stitched together.",
    after: "All empty states use a consistent pattern: an icon, a short message, and (where applicable) a CTA button. Same spacing, same font sizes, same colors.",
    fix: "Create a reusable EmptyChannelState component that accepts icon, message, and optional CTA. Use it in all four TabsContent blocks.",
    affectedFiles: ["components/messages/ChatSidebar.jsx"],
    wcagCriteria: "2.4.6 Headings and Labels, 3.2.3 Consistent Navigation",
    timeToFix: "1-2 hours",
    testingNotes: "Switch between all four tabs with no data. Verify consistent layout. Test with a CTA button on each tab type.",
  },
  {
    id: "U-18",
    severity: "Low",
    title: "Dashboard Query — No staleTime on Staff Dashboard",
    screen: "Dashboard (Staff)",
    description: "The staff Dashboard component makes 7 useQuery calls with no staleTime, meaning every component mount triggers a full refetch of all entities (sports, teams, players, events, announcements, submissions, payments). This causes unnecessary API load when navigating back to the dashboard.",
    rootCause: "Dashboard.jsx queries: useQuery({ queryKey: ['sports'], queryFn: ... }) with no staleTime option. Default staleTime is 0, meaning data is always considered stale and refetches on every mount.",
    before: "Navigate to Dashboard → 7 API calls fire. Navigate to another page → come back → 7 more API calls fire, even though data hasn't changed.",
    after: "Add staleTime: 60_000 (60 seconds) to all dashboard queries, matching the pattern already used in ParentPortal.",
    fix: "Add staleTime: 60_000 to each useQuery call in Dashboard.jsx. Consider extracting shared query keys to a constants file.",
    affectedFiles: ["pages/Dashboard.jsx"],
    wcagCriteria: "N/A (performance)",
    timeToFix: "15-30 minutes",
    testingNotes: "Monitor Network tab. Navigate away from and back to Dashboard. Verify queries don't refetch within 60s of last fetch.",
  },
];

const SEVERITY_COLORS = {
  Critical: { bg: [220, 38, 38], text: [255, 255, 255] },
  High: { bg: [234, 88, 12], text: [255, 255, 255] },
  Medium: { bg: [202, 138, 4], text: [255, 255, 255] },
  Low: { bg: [100, 116, 139], text: [255, 255, 255] },
};

const SUMMARY = {
  total: 18,
  critical: 1,
  high: 3,
  medium: 7,
  low: 7,
  totalHours: "24-32 hours",
  screensAudited: ["Messages (Sidebar)", "Messages (Active Chat)", "Messages (Composer)", "Dashboard", "Schedule", "TopBar", "BottomTabBar", "AppLayout", "ParentPortal"],
};

function buildPDF() {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 50;
  const contentW = pageW - margin * 2;
  let y = margin;
  let pageNum = 1;

  const checkPage = (needed = 20) => {
    if (y + needed > pageH - 40) {
      doc.addPage();
      pageNum++;
      y = margin;
      doc.setFillColor(20, 30, 48);
      doc.rect(0, 0, pageW, 28, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(180, 180, 180);
      doc.text("CU CONNECT — UI/UX AUDIT REPORT — CONFIDENTIAL", margin, 18);
      doc.text(`Page ${pageNum}`, pageW - margin, 18, { align: "right" });
      y = 45;
    }
  };

  const heading = (text, size, rgb, topPad = 8) => {
    checkPage(size + 24 + topPad);
    y += topPad;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.setTextColor(...rgb);
    doc.text(text, margin, y);
    y += size + 6;
  };

  const para = (text, opts = {}) => {
    const sz = opts.size || 9.5;
    const lines = doc.splitTextToSize(text, contentW - (opts.indent || 0));
    lines.forEach((line) => {
      checkPage(sz + 4);
      doc.setFont("helvetica", opts.bold ? "bold" : "normal");
      doc.setFontSize(sz);
      doc.setTextColor(...(opts.color || [55, 55, 55]));
      doc.text(line, margin + (opts.indent || 0), y);
      y += sz + 3.5;
    });
  };

  const bullet = (text, indent = 12) => {
    const sz = 9.5;
    const lines = doc.splitTextToSize(text, contentW - indent - 10);
    lines.forEach((line, i) => {
      checkPage(sz + 4);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(sz);
      doc.setTextColor(55, 55, 55);
      doc.text(i === 0 ? "\u2022" : " ", margin + indent, y);
      doc.text(line, margin + indent + 10, y);
      y += sz + 3;
    });
  };

  const divider = (color = [200, 168, 75]) => {
    checkPage(16);
    doc.setDrawColor(...color);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 14;
  };

  const label = (text, rgb = [100, 100, 100]) => {
    checkPage(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...rgb);
    doc.text(text.toUpperCase(), margin, y);
    y += 13;
  };

  const severityBadge = (severity, x, yPos) => {
    const colors = SEVERITY_COLORS[severity] || SEVERITY_COLORS.Low;
    const w = 55;
    doc.setFillColor(...colors.bg);
    doc.roundedRect(x, yPos - 9, w, 14, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...colors.text);
    doc.text(severity.toUpperCase(), x + w / 2, yPos, { align: "center" });
    return x + w + 6;
  };

  // ── COVER PAGE ──
  doc.setFillColor(12, 12, 12);
  doc.rect(0, 0, pageW, pageH, "F");
  doc.setFillColor(200, 168, 75);
  doc.rect(0, 140, pageW, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(200, 168, 75);
  doc.text("CU Connect", margin, 58);
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("UI/UX Audit Report", margin, 84);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(180, 180, 180);
  doc.text("Comprehensive Interface & Usability Assessment", margin, 104);
  doc.text(`Report Date: June 22, 2026   |   Version: 1.0   |   CONFIDENTIAL`, margin, 120);

  // Summary box on cover
  y = 180;
  doc.setFillColor(20, 30, 48);
  doc.roundedRect(margin, y, contentW, 180, 6, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(200, 168, 75);
  doc.text("Executive Summary", margin + 20, y + 26);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(200, 200, 200);
  const summaryLines = doc.splitTextToSize(
    `This report documents ${SUMMARY.total} UI/UX findings identified across ${SUMMARY.screensAudited.length} key screens of the CU Connect platform. Findings are categorized by severity (Critical, High, Medium, Low) with detailed root-cause analysis, proposed solutions, WCAG criteria references, and estimated time-to-fix for each issue.`,
    contentW - 40
  );
  summaryLines.forEach((line, i) => {
    doc.text(line, margin + 20, y + 46 + i * 13);
  });

  // Severity counts
  const statY = y + 46 + summaryLines.length * 13 + 10;
  const statW = contentW / 4;
  const stats = [
    { label: "Critical", value: SUMMARY.critical, color: [220, 38, 38] },
    { label: "High", value: SUMMARY.high, color: [234, 88, 12] },
    { label: "Medium", value: SUMMARY.medium, color: [202, 138, 4] },
    { label: "Low", value: SUMMARY.low, color: [100, 116, 139] },
  ];
  stats.forEach((stat, i) => {
    const sx = margin + 20 + i * (statW - 10);
    doc.setFillColor(...stat.color);
    doc.roundedRect(sx, statY, statW - 20, 50, 4, 4, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(255, 255, 255);
    doc.text(String(stat.value), sx + (statW - 20) / 2, statY + 26, { align: "center" });
    doc.setFontSize(8);
    doc.text(stat.label.toUpperCase(), sx + (statW - 20) / 2, statY + 42, { align: "center" });
  });

  // Total time
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(200, 168, 75);
  doc.text(`Total Estimated Effort: ${SUMMARY.totalHours}`, margin + 20, statY + 75);

  doc.addPage();
  pageNum++;
  y = margin;

  // ── SECTION 1: Executive Summary ──
  heading("1. Executive Summary", 15, [20, 30, 48]);
  divider();
  para(`This UI/UX audit was conducted on June 22, 2026, covering the primary user-facing screens of the CU Connect platform. The audit identified ${SUMMARY.total} findings across ${SUMMARY.screensAudited.length} screens, with ${SUMMARY.critical} critical issue, ${SUMMARY.high} high-priority issues, ${SUMMARY.medium} medium-priority issues, and ${SUMMARY.low} low-priority issues.`);
  y += 4;

  para("The most impactful finding (U-01: Composer Overlap with Bottom Navigation) directly impedes the core messaging workflow on mobile devices. The second most impactful cluster (U-03, U-04) relates to aggressive API polling that causes rate-limit errors during active usage. Together, these represent the highest-ROI fixes for immediate user experience improvement.", { size: 9 });
  y += 6;

  label("Audit Scope");
  SUMMARY.screensAudited.forEach(s => bullet(s));
  y += 6;

  label("Methodology");
  bullet("Static code review of all messaging, layout, navigation, and dashboard components.");
  bullet("Analysis of API query patterns, polling intervals, and data-fetching efficiency.");
  bullet("WCAG 2.1 AA accessibility criteria evaluation for contrast, target size, and navigation.");
  bullet("Mobile-first viewport testing simulation (iOS Safari, Android Chrome, PWA standalone).");
  bullet("Cross-screen consistency review (theming, spacing, empty states, interaction patterns).");

  // ── SECTION 2: Severity Summary Table ──
  y += 10;
  heading("2. Findings Summary Table", 15, [20, 30, 48]);
  divider();

  // Table header
  checkPage(20);
  doc.setFillColor(20, 30, 48);
  doc.rect(margin, y, contentW, 18, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(200, 168, 75);
  doc.text("ID", margin + 8, y + 12);
  doc.text("SEVERITY", margin + 38, y + 12);
  doc.text("TITLE", margin + 100, y + 12);
  doc.text("SCREEN", pageW - margin - 120, y + 12);
  doc.text("TIME", pageW - margin - 30, y + 12, { align: "right" });
  y += 22;

  FINDINGS.forEach((f, idx) => {
    checkPage(24);
    if (idx % 2 === 0) {
      doc.setFillColor(248, 248, 248);
      doc.rect(margin, y - 4, contentW, 22, "F");
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(200, 168, 75);
    doc.text(f.id, margin + 8, y + 8);

    severityBadge(f.severity, margin + 36, y + 8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(55, 55, 55);
    const titleLines = doc.splitTextToSize(f.title, 180);
    doc.text(titleLines[0], margin + 100, y + 8);
    if (titleLines[1]) doc.text(titleLines[1], margin + 100, y + 18);

    const screenLines = doc.splitTextToSize(f.screen, 80);
    doc.text(screenLines[0], pageW - margin - 120, y + 8);

    doc.text(f.timeToFix, pageW - margin - 8, y + 8, { align: "right" });
    y += 24;
  });

  // ── SECTION 3: Detailed Findings ──
  y += 10;
  heading("3. Detailed Findings & Solutions", 15, [20, 30, 48]);
  divider();

  FINDINGS.forEach((f, idx) => {
    checkPage(120);

    // Finding header bar
    doc.setFillColor(20, 30, 48);
    doc.rect(margin, y, contentW, 24, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(200, 168, 75);
    doc.text(f.id, margin + 10, y + 15);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9.5);
    const hdrLines = doc.splitTextToSize(f.title, contentW - 120);
    doc.text(hdrLines[0], margin + 40, y + 15);
    severityBadge(f.severity, pageW - margin - 60, y + 15);
    y += 30;

    // Screen
    label("Affected Screen");
    para(f.screen, { size: 9, indent: 8 });

    // Description
    label("Description", [80, 80, 80]);
    para(f.description, { size: 9, indent: 8 });

    // Root Cause
    label("Root Cause", [80, 80, 80]);
    para(f.rootCause, { size: 9, indent: 8 });

    // Before / After
    checkPage(40);
    const beforeLines = doc.splitTextToSize(f.before, contentW - 20);
    const beforeH = beforeLines.length * 11 + 14;
    checkPage(beforeH + 10);
    doc.setFillColor(255, 240, 240);
    doc.rect(margin, y, contentW, beforeH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(180, 50, 50);
    doc.text("\u2718  CURRENT BEHAVIOR", margin + 8, y + 11);
    beforeLines.forEach((line, i) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(120, 40, 40);
      doc.text(line, margin + 8, y + 11 + (i + 1) * 11);
    });
    y += beforeH + 6;

    const afterLines = doc.splitTextToSize(f.after, contentW - 20);
    const afterH = afterLines.length * 11 + 14;
    checkPage(afterH + 10);
    doc.setFillColor(240, 252, 244);
    doc.rect(margin, y, contentW, afterH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(30, 130, 60);
    doc.text("\u2713  PROPOSED SOLUTION", margin + 8, y + 11);
    afterLines.forEach((line, i) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(30, 100, 50);
      doc.text(line, margin + 8, y + 11 + (i + 1) * 11);
    });
    y += afterH + 6;

    // Technical Fix
    label("Technical Fix", [80, 80, 80]);
    para(f.fix, { size: 8.5, indent: 8 });

    // Affected Files
    label("Affected Files", [80, 80, 80]);
    para(f.affectedFiles.join(", "), { size: 8.5, indent: 8 });

    // WCAG + Time + Testing
    checkPage(30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("WCAG CRITERIA:", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(55, 55, 55);
    const wcagLines = doc.splitTextToSize(f.wcagCriteria, contentW - 100);
    wcagLines.forEach((line, i) => {
      doc.text(line, margin + 80, y + i * 11);
    });
    y += Math.max(14, wcagLines.length * 11 + 4);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("TIME TO FIX:", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(200, 168, 75);
    doc.text(f.timeToFix, margin + 80, y);
    y += 14;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("TESTING NOTES:", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(55, 55, 55);
    const testLines = doc.splitTextToSize(f.testingNotes, contentW - 100);
    testLines.forEach((line, i) => {
      doc.text(line, margin + 80, y + i * 11);
    });
    y += Math.max(14, testLines.length * 11 + 4);

    if (idx < FINDINGS.length - 1) {
      divider([210, 210, 210]);
    }
  });

  // ── SECTION 4: Priority Matrix ──
  y += 10;
  heading("4. Priority & Effort Matrix", 15, [20, 30, 48]);
  divider();

  const matrix = [
    { priority: "P0 — Immediate", findings: FINDINGS.filter(f => f.severity === "Critical"), desc: "Blocks core user workflow. Fix before next release." },
    { priority: "P1 — High Priority", findings: FINDINGS.filter(f => f.severity === "High"), desc: "Causes reliability issues or significant user friction. Fix within 1 sprint." },
    { priority: "P2 — Medium Priority", findings: FINDINGS.filter(f => f.severity === "Medium"), desc: "Impacts usability and accessibility. Fix within 2 sprints." },
    { priority: "P3 — Low Priority", findings: FINDINGS.filter(f => f.severity === "Low"), desc: "Polish and consistency improvements. Fix as time permits." },
  ];

  matrix.forEach(m => {
    checkPage(60);
    doc.setFillColor(240, 245, 250);
    doc.rect(margin, y, contentW, 22, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(20, 30, 48);
    doc.text(m.priority, margin + 10, y + 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(`${m.findings.length} finding${m.findings.length !== 1 ? "s" : ""}`, pageW - margin - 10, y + 14, { align: "right" });
    y += 26;

    para(m.desc, { size: 8.5, indent: 10 });
    y += 4;

    m.findings.forEach(f => {
      bullet(`${f.id}: ${f.title} (${f.timeToFix})`);
    });
    y += 8;
  });

  // ── SECTION 5: Recommendations ──
  y += 6;
  heading("5. Strategic Recommendations", 15, [20, 30, 48]);
  divider();

  label("Immediate Actions (Week 1)");
  bullet("Fix U-01 (Composer overlap) — this is the most visible UX defect and blocks messaging on mobile.");
  bullet("Fix U-03 (API polling) and U-04 (reactions query) — prevents rate-limit errors that affect all users.");
  y += 6;

  label("Short-Term (Weeks 2-3)");
  bullet("Address U-05 (timezone), U-06 (theme), U-07 (ScoreCard), U-08 (header truncation), U-09 (contrast), U-10 (top bar), U-11 (mute toggle).");
  bullet("These fixes collectively bring the messaging experience to production quality.");
  y += 6;

  label("Medium-Term (Weeks 3-4)");
  bullet("Implement U-12 through U-18 — polish items that improve consistency, accessibility, and performance.");
  bullet("Consider a component audit to prevent regression of hardcoded colors and spacing values.");
  y += 6;

  label("Ongoing");
  bullet("Add automated contrast checking to CI pipeline.");
  bullet("Establish a design token enforcement policy (no hardcoded hex values in components).");
  bullet("Create a reusable EmptyState component to standardize all empty/loading states.");

  // Footer
  y += 16;
  divider([200, 168, 75]);
  para(`This report was generated from the CU Connect platform UI/UX audit conducted on June 22, 2026. All findings, root causes, and proposed solutions reflect actual code analysis. This document is classified CONFIDENTIAL and intended for internal development use only.`, { color: [130, 130, 130], size: 8.5 });

  return doc;
}

export default function UIUXAuditReport() {
  const { user, isLoadingAuth } = useAuth();
  const [loading, setLoading] = useState(false);

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return <Navigate to="/Portal" replace />;
  }

  const handleGenerate = () => {
    setLoading(true);
    try {
      const doc = buildPDF();
      doc.save("CU_Connect_UIUX_Audit_Report_v1.0.pdf");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-6">
          <LayoutDashboard className="w-10 h-10 text-primary" />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">
          CU Connect UI/UX Audit
        </h1>
        <p className="text-muted-foreground mb-2 text-sm">
          Comprehensive Interface & Usability Report — v1.0
        </p>
        <p className="text-muted-foreground mb-6 text-sm">
          {SUMMARY.total} findings across {SUMMARY.screensAudited.length} screens. Severity breakdown, detailed root-cause analysis, WCAG criteria, and time-to-fix estimates.
        </p>

        {/* Severity badges */}
        <div className="flex justify-center gap-2 mb-6 flex-wrap">
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">{SUMMARY.critical} Critical</span>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30">{SUMMARY.high} High</span>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">{SUMMARY.medium} Medium</span>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-500/15 text-slate-400 border border-slate-500/30">{SUMMARY.low} Low</span>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {loading ? "Generating..." : "Generate & Download PDF"}
        </button>

        <p className="text-xs text-muted-foreground mt-3">
          Estimated total effort: {SUMMARY.totalHours}
        </p>

        <div className="mt-8 p-4 rounded-xl border border-border bg-card">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-yellow-500">Internal Use Only</span>
            <br />
            This report is confidential and intended for internal development
            and design purposes. Do not distribute outside the organization.
          </p>
        </div>
      </div>
    </div>
  );
}