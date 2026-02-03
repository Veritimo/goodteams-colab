# Phase 5: Desktop Agent Implementation Plan

> Windows Desktop Automation with Visual Collaboration

**Duration:** 8 weeks  
**Status:** In Progress  
**Dependencies:** Phase 3 Multi-Tenancy ✅ (agent connects as node)

---

## Overview

Phase 5 builds a Windows desktop agent that:

- **Runs as Electron app** on user's Windows machine
- **Connects to GoodTeams** as a "node" (like mobile nodes in OpenClaw)
- **Automates Windows apps** via UI Automation API
- **Controls Office apps** via COM automation (Excel, Word, Outlook)
- **Streams screen** for visual collaboration
- **Shows AI actions** with cursor highlights and toasts

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     User's Windows Machine                       │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   GoodTeams Desktop Agent                 │   │
│  │                      (Electron App)                       │   │
│  │                                                           │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │   │
│  │  │   Gateway   │  │   Screen    │  │    Action       │  │   │
│  │  │   Client    │  │   Capture   │  │    Overlay      │  │   │
│  │  │   (Node)    │  │   & Stream  │  │    (Cursor,     │  │   │
│  │  │             │  │             │  │     Toasts)     │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘  │   │
│  │         │                │                  │            │   │
│  │         ▼                ▼                  ▼            │   │
│  │  ┌─────────────────────────────────────────────────────┐│   │
│  │  │              Native Automation Layer                ││   │
│  │  │                                                     ││   │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ ││   │
│  │  │  │ UI Auto API │  │  Office COM │  │  Win32 API │ ││   │
│  │  │  │ (node-uia)  │  │  (edge.js)  │  │  (ffi-napi)│ ││   │
│  │  │  └─────────────┘  └─────────────┘  └────────────┘ ││   │
│  │  └─────────────────────────────────────────────────────┘│   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              │ WebSocket                         │
│                              ▼                                   │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
                    GoodTeams Platform
                    (Tenant Gateway)
```

---

## Implementation Streams

### Stream A: Electron Foundation
**Owner:** Agent A  
**Duration:** Week 1-2

| Task | Description |
|------|-------------|
| Electron app shell | Main process, renderer, preload scripts |
| Gateway client | Connect as node to tenant gateway |
| System tray | Status icon, menu, notifications |
| Auto-updater | Squirrel or electron-updater |
| IPC bridge | Main ↔ Renderer communication |
| Window management | Show/hide, minimize to tray |

### Stream B: Windows UI Automation
**Owner:** Agent B  
**Duration:** Week 2-3

| Task | Description |
|------|-------------|
| UIA bindings | Node bindings for UI Automation API |
| Window discovery | List windows, find by title/class |
| Element tree | Get UI element hierarchy |
| Element inspection | Get properties, bounds, patterns |
| Click actions | Click, double-click, right-click |
| Type actions | Send keystrokes, text input |
| Scroll actions | Scroll to element, page up/down |
| Wait for element | Wait until visible/enabled |

### Stream C: Office COM Automation
**Owner:** Agent C  
**Duration:** Week 3-4

| Task | Description |
|------|-------------|
| COM bindings | Node bindings for COM automation |
| Excel automation | Read/write cells, ranges, formulas |
| Word automation | Read/write documents, formatting |
| Outlook automation | Read/send emails, calendar |
| PowerPoint automation | Read/modify slides |
| Error handling | COM errors, Office not installed |

### Stream D: Visual Collaboration
**Owner:** Agent D  
**Duration:** Week 4-5

| Task | Description |
|------|-------------|
| Screen capture | Capture desktop, window, region |
| Screen streaming | WebRTC or MJPEG stream |
| Cursor overlay | Show AI cursor position |
| Element highlight | Box around target elements |
| Action toasts | Show what AI is doing |
| Recording | Record sessions for playback |

---

## Package Structure

```
packages/
└── desktop-agent/
    ├── package.json
    ├── electron-builder.json
    ├── tsconfig.json
    │
    ├── src/
    │   ├── main/                     # Electron main process
    │   │   ├── index.ts              # Entry point
    │   │   ├── app.ts                # App lifecycle
    │   │   ├── tray.ts               # System tray
    │   │   ├── updater.ts            # Auto-update
    │   │   ├── ipc-handlers.ts       # IPC from renderer
    │   │   └── window.ts             # Window management
    │   │
    │   ├── preload/                  # Preload scripts
    │   │   └── index.ts              # Expose APIs to renderer
    │   │
    │   ├── renderer/                 # Renderer (UI)
    │   │   ├── index.html
    │   │   ├── index.tsx
    │   │   ├── App.tsx
    │   │   └── components/
    │   │
    │   ├── gateway/                  # Gateway connection
    │   │   ├── client.ts             # WebSocket client
    │   │   ├── node-protocol.ts      # Node protocol impl
    │   │   └── handlers.ts           # Message handlers
    │   │
    │   ├── automation/               # Windows automation
    │   │   ├── index.ts
    │   │   ├── uia/                  # UI Automation
    │   │   │   ├── bindings.ts       # Native bindings
    │   │   │   ├── window.ts         # Window operations
    │   │   │   ├── element.ts        # Element operations
    │   │   │   ├── actions.ts        # Click, type, etc.
    │   │   │   └── patterns.ts       # UIA patterns
    │   │   │
    │   │   └── office/               # Office COM
    │   │       ├── bindings.ts       # COM bindings
    │   │       ├── excel.ts          # Excel automation
    │   │       ├── word.ts           # Word automation
    │   │       ├── outlook.ts        # Outlook automation
    │   │       └── powerpoint.ts     # PowerPoint automation
    │   │
    │   ├── visual/                   # Visual features
    │   │   ├── capture.ts            # Screen capture
    │   │   ├── stream.ts             # Screen streaming
    │   │   ├── overlay.ts            # Cursor/highlight overlay
    │   │   └── toast.ts              # Action notifications
    │   │
    │   └── tools/                    # Agent tools
    │       ├── index.ts
    │       ├── ui-tools.ts           # UI automation tools
    │       ├── office-tools.ts       # Office tools
    │       └── screen-tools.ts       # Screen tools
    │
    └── __tests__/
        ├── automation/
        ├── gateway/
        ├── visual/
        └── tools/
```

---

## Agent Tools

These become callable tools for the AI agent:

### UI Automation Tools
- `desktop_list_windows` — List all open windows
- `desktop_focus_window` — Bring window to front
- `desktop_get_element_tree` — Get UI element hierarchy
- `desktop_find_element` — Find element by text/type/id
- `desktop_click` — Click element or coordinates
- `desktop_type` — Send keystrokes
- `desktop_scroll` — Scroll in window/element
- `desktop_wait_for` — Wait for element state

### Office Tools
- `excel_open` — Open/create workbook
- `excel_read_range` — Read cells
- `excel_write_range` — Write cells
- `excel_run_formula` — Execute formula
- `excel_get_sheets` — List worksheets
- `word_open` — Open/create document
- `word_read` — Read document content
- `word_write` — Write to document
- `outlook_list_mail` — List emails (via COM)
- `outlook_send_mail` — Send email (via COM)

### Screen Tools
- `screen_capture` — Take screenshot
- `screen_start_stream` — Start screen stream
- `screen_stop_stream` — Stop stream
- `screen_highlight` — Highlight region

---

## Technical Notes

### UI Automation Options

1. **node-windows-uia** (if available) — Direct UIA bindings
2. **ffi-napi + UIAutomation.dll** — Manual FFI bindings
3. **edge.js + C# UIA wrapper** — Use .NET UIA from Node
4. **PowerShell subprocess** — Shell out to PowerShell UIA scripts

Recommendation: Start with **edge.js + C#** for reliability, then optimize.

### Office COM Options

1. **edge.js + C# Interop** — Most reliable
2. **winax** — ActiveX for Node (older)
3. **node-ole** — OLE automation

Recommendation: **edge.js** with Office Interop assemblies.

### Screen Capture Options

1. **electron desktopCapturer** — Built into Electron
2. **screenshot-desktop** — Cross-platform captures
3. **robot.js** — Screenshots + input simulation

Recommendation: **electron desktopCapturer** for streaming, **screenshot-desktop** for stills.

### WebRTC Streaming

For screen streaming to web UI:
1. Electron captures screen via desktopCapturer
2. Encodes as WebRTC stream
3. Sends to GoodTeams web client
4. Client displays in browser

Alternative: MJPEG over WebSocket (simpler, higher bandwidth).

---

## Dependencies

```json
{
  "dependencies": {
    "electron": "^29.0.0",
    "electron-updater": "^6.1.0",
    "edge-js": "^21.0.0",
    "ffi-napi": "^4.0.0",
    "ref-napi": "^3.0.0",
    "screenshot-desktop": "^1.15.0",
    "robotjs": "^0.6.0"
  },
  "devDependencies": {
    "electron-builder": "^24.0.0",
    "@electron/rebuild": "^3.0.0"
  }
}
```

---

## Testing Strategy

### Unit Tests
Testing automation logic is tricky (needs Windows). Options:

1. **Mock native bindings** — Test logic without real Windows
2. **Integration tests on CI** — Use Windows runners
3. **Manual test suite** — Documented manual tests

### Test Files
- `__tests__/gateway/client.test.ts` (15+ tests)
- `__tests__/automation/uia/element.test.ts` (20+ tests)
- `__tests__/automation/office/excel.test.ts` (15+ tests)
- `__tests__/visual/capture.test.ts` (10+ tests)
- `__tests__/tools/ui-tools.test.ts` (20+ tests)

---

## Phase 5 Checkpoint

| Criterion | Requirement |
|-----------|-------------|
| App runs | Electron app launches on Windows |
| Connects | Agent connects to tenant gateway as node |
| UI Auto | Can click/type in Windows apps |
| Office | Can read/write Excel cells |
| Screen | Screen stream visible in web UI |
| E2E | `agent_connect`, `excel_rw`, `screen_stream` pass |

---

## Notes

### Windows-Only

This package only runs on Windows. The main codebase remains cross-platform.

### Native Modules

Native modules (ffi-napi, edge.js) require:
- `electron-rebuild` after npm install
- Visual Studio Build Tools on Windows
- Proper electron ABI targeting

### Security

The desktop agent has significant permissions:
- UI control of any app
- File system access via Office
- Screen capture

Trust model: Only installed by IT admins, connects to org's tenant only.

### Packaging

Use electron-builder for:
- MSI installer (enterprise deployment)
- Auto-update support
- Code signing
