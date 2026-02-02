# GoodTeams Desktop Agent Architecture

**Visual Collaboration Agent for Windows Enterprise Environments**

*Author: Orion ✨ + Forge 🔨*  
*Date: February 2026*  
*Version: 0.1 (Draft)*

---

## Executive Summary

This document outlines the architecture for a **Windows-first desktop agent** that enables real-time visual collaboration between AI assistants and enterprise users. The agent extends GoodTeams' capabilities beyond browser automation to native Windows applications (Powerpoint, Excel, Word, Outlook, project management tools, etc.) while providing users with a transparent, observable view of AI actions.

**Key Value Proposition:** Users can watch the AI work in real-time on their actual desktop, building trust and enabling seamless human-AI collaboration on complex business tasks.

---

## Table of Contents

1. [Design Goals](#1-design-goals)
2. [Architecture Overview](#2-architecture-overview)
3. [Component Design](#3-component-design)
4. [Windows Automation Layer](#4-windows-automation-layer)
5. [Visual Collaboration](#5-visual-collaboration)
6. [Gateway Integration](#6-gateway-integration)
7. [Security Model](#7-security-model)
8. [Technology Stack](#8-technology-stack)
9. [Implementation Roadmap](#9-implementation-roadmap)
10. [Open Questions](#10-open-questions)

---

## 1. Design Goals

### Primary Goals

| Goal | Description | Priority |
|------|-------------|----------|
| **Windows Native** | Control Powerpoint, Excel, Word, Outlook, and other Windows apps | P0 |
| **Visual Collaboration** | Users see AI actions in real-time | P0 |
| **Enterprise Ready** | Integrate with existing GoodTeams gateway/auth | P0 |
| **Low Friction Install** | Single installer, minimal IT involvement | P1 |
| **Offline Capable** | Core functions work without internet | P2 |

### Non-Goals (v1)

- macOS/Linux support (future)
- Mobile device control
- Gaming/high-FPS applications
- Hardware-level automation (USB/HID injection)

---

## 2. Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     User's Windows Machine                               │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    GoodTeams Desktop Agent                          │ │
│  │                      (Electron Shell)                               │ │
│  │  ┌──────────────────────────────────────────────────────────────┐  │ │
│  │  │                     Agent Core                                │  │ │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │  │ │
│  │  │  │  Gateway    │  │   Tool      │  │   Visual            │   │  │ │
│  │  │  │  Client     │  │  Registry   │  │  Collaboration      │   │  │ │
│  │  │  │             │  │             │  │   Manager           │   │  │ │
│  │  │  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘   │  │ │
│  │  └─────────┼────────────────┼────────────────────┼──────────────┘  │ │
│  │            │                │                    │                  │ │
│  │  ┌─────────┼────────────────┼────────────────────┼──────────────┐  │ │
│  │  │         ▼                ▼                    ▼              │  │ │
│  │  │  Automation Layer                                            │  │ │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │  │ │
│  │  │  │  Browser    │  │  Windows    │  │   Screen            │  │  │ │
│  │  │  │  (Playwright)│  │  UIA/Win32 │  │   Capture           │  │  │ │
│  │  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │  │ │
│  │  └──────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                    │                                     │
│                                    │ WebSocket                           │
└────────────────────────────────────┼─────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    GoodTeams Enterprise Backend                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Gateway   │  │   Agent     │  │   Tool      │  │   Tenant    │    │
│  │   Server    │  │  Framework  │  │  Routing    │  │   Manager   │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Node Protocol Integration

The desktop agent connects as a **"node"** to the GoodTeams gateway, leveraging the existing node-host protocol (`src/node-host/runner.ts`):

```typescript
// Desktop agent announces capabilities on connect
{
  clientName: "goodteams-desktop",
  clientVersion: "1.0.0",
  platform: "win32",
  mode: "node",
  role: "desktop-agent",
  caps: [
    "system",           // Command execution
    "browser",          // Playwright browser control
    "windows.uia",      // Windows UI Automation (NEW)
    "screen.stream",    // Real-time screen streaming (NEW)
    "screen.capture",   // Screenshot capture
  ],
  commands: [
    "system.run",
    "system.which",
    "browser.proxy",
    "windows.uia.inspect",      // NEW
    "windows.uia.interact",     // NEW
    "windows.office.excel",     // NEW
    "windows.office.word",      // NEW
    "windows.office.outlook",   // NEW
    "screen.stream.start",      // NEW
    "screen.stream.stop",       // NEW
    "screen.capture",
  ]
}
```

---

## 3. Component Design

### 3.1 Electron Shell

The Electron application provides:

| Component | Purpose |
|-----------|---------|
| **Main Process** | Node.js runtime, gateway client, native module hosting |
| **Renderer Process** | Status UI, collaboration overlay, settings |
| **Preload Scripts** | Secure bridge between renderer and main |
| **Native Modules** | Windows API bindings (node-ffi-napi, native addons) |

**Key Design Decisions:**

- **Single-window tray app** — Minimizes to system tray, shows status/activity
- **Overlay mode** — Can show transparent overlay on user's screen for visual feedback
- **Auto-update** — Electron-builder with Squirrel for seamless updates
- **Portable mode** — Optional xcopy deployment for restricted environments

### 3.2 Gateway Client

Adapts the existing `GatewayClient` class for desktop agent use:

```typescript
// packages/desktop-agent/src/gateway-client.ts
import { GatewayClient } from '@goodteams/core';

export class DesktopGatewayClient extends GatewayClient {
  constructor(opts: DesktopClientOptions) {
    super({
      ...opts,
      clientName: GATEWAY_CLIENT_NAMES.DESKTOP_AGENT,
      mode: GATEWAY_CLIENT_MODES.NODE,
      role: 'desktop-agent',
      caps: ['system', 'browser', 'windows.uia', 'screen.stream', 'screen.capture'],
    });
  }

  // Desktop-specific handlers
  protected async handleWindowsUiaInspect(params: UiaInspectParams): Promise<UiaTree> { ... }
  protected async handleWindowsUiaInteract(params: UiaInteractParams): Promise<void> { ... }
  protected async handleScreenStreamStart(params: StreamParams): Promise<StreamHandle> { ... }
}
```

### 3.3 Tool Registry

Desktop-specific tools registered with the agent framework:

| Tool | Description | Implementation |
|------|-------------|----------------|
| `windows_inspect` | Get UI tree of target window | UI Automation |
| `windows_click` | Click element by automation ID or path | UI Automation |
| `windows_type` | Type text into focused element | SendInput API |
| `windows_hotkey` | Send keyboard shortcuts | SendInput API |
| `excel_read` | Read cells/ranges from Excel | COM Automation |
| `excel_write` | Write data to Excel | COM Automation |
| `excel_run_macro` | Execute VBA macro | COM Automation |
| `word_read` | Read document content | COM Automation |
| `word_write` | Write/format document | COM Automation |
| `outlook_send` | Send email via Outlook | COM Automation |
| `outlook_calendar` | Read/create calendar events | COM Automation |
| `screen_capture` | Capture screenshot | Desktop Duplication API |
| `screen_stream` | Start real-time screen stream | WebRTC/Desktop Duplication |

---

## 4. Windows Automation Layer

### 4.1 Approach Comparison

| Approach | Pros | Cons | Use Case |
|----------|------|------|----------|
| **UI Automation (UIA)** | Native, accessible, semantic | App must expose UIA tree | Preferred for Office, standard apps |
| **COM Automation** | Deep Office integration, reliable | Office-specific | Excel, Word, Outlook, PowerPoint |
| **Win32 SendInput** | Works everywhere | Brittle, position-dependent | Fallback, legacy apps |
| **Vision (OCR + coordinates)** | Universal | Slow, fragile | Last resort |

**Strategy:** Use the highest-fidelity method available:
1. **COM** for Office apps (most reliable)
2. **UIA** for standard Windows apps
3. **SendInput** for apps without accessibility
4. **Vision** only when all else fails

### 4.2 UI Automation Implementation

```typescript
// packages/desktop-agent/src/automation/uia.ts
import { UIAutomation } from 'node-ui-automation'; // or native addon

export class WindowsAutomation {
  private uia: UIAutomation;

  async inspectWindow(hwnd: number): Promise<UiaElement[]> {
    const root = await this.uia.elementFromHandle(hwnd);
    return this.buildTree(root, { maxDepth: 10 });
  }

  async findElement(selector: UiaSelector): Promise<UiaElement | null> {
    // Support multiple selector strategies:
    // - AutomationId: "#saveButton"
    // - Name: "Save"
    // - ControlType + Name: "Button:Save"
    // - XPath-like: "//Window/Pane/Button[@Name='Save']"
  }

  async interact(element: UiaElement, action: UiaAction): Promise<void> {
    switch (action.type) {
      case 'click': await element.invoke(); break;
      case 'type': await element.setValue(action.text); break;
      case 'select': await element.select(); break;
      case 'expand': await element.expand(); break;
      case 'scroll': await element.scroll(action.direction); break;
    }
  }
}
```

### 4.3 Office COM Automation

```typescript
// packages/desktop-agent/src/automation/office.ts
import { createObject } from 'win32ole'; // or edge-js / node-activex

export class ExcelAutomation {
  private app: any;

  async connect(): Promise<void> {
    this.app = await createObject('Excel.Application');
  }

  async readRange(workbook: string, sheet: string, range: string): Promise<any[][]> {
    const wb = this.app.Workbooks.Open(workbook);
    const ws = wb.Sheets(sheet);
    const data = ws.Range(range).Value;
    return data;
  }

  async writeRange(workbook: string, sheet: string, range: string, data: any[][]): Promise<void> {
    const wb = this.app.Workbooks.Open(workbook);
    const ws = wb.Sheets(sheet);
    ws.Range(range).Value = data;
    wb.Save();
  }

  async runMacro(workbook: string, macroName: string, ...args: any[]): Promise<any> {
    const wb = this.app.Workbooks.Open(workbook);
    return this.app.Run(macroName, ...args);
  }
}
```

### 4.4 Native Module Options

| Library | Language | Maturity | Notes |
|---------|----------|----------|-------|
| `node-ui-automation` | JS/TS | Medium | Pure JS UIA bindings |
| `robotjs` | C++ | High | Cross-platform, limited UIA |
| `nut.js` | TS | High | Cross-platform, image-based |
| `node-ffi-napi` | JS | High | Call any Windows API |
| `edge-js` | C# | High | Run .NET code from Node |
| `node-activex` | C++ | Medium | COM automation |
| Custom native addon | C++/Rust | — | Full control, maintenance burden |

**Recommendation:** Start with `node-ffi-napi` + `edge-js` for flexibility, consider custom native addon for performance-critical paths.

---

## 5. Visual Collaboration

### 5.1 Design Philosophy

Users should **see what the AI is doing** in real-time. This builds trust and enables:
- Intervention when something goes wrong
- Learning by watching
- Seamless handoff between AI and human

### 5.2 Visual Feedback Modes

| Mode | Description | Implementation |
|------|-------------|----------------|
| **Cursor Highlight** | Show where AI is clicking | Transparent overlay with animated cursor |
| **Element Highlight** | Highlight target elements before interaction | Overlay box around UIA element bounds |
| **Action Toast** | Show what action is being performed | Notification or overlay text |
| **Screen Stream** | Full screen streaming to web UI | WebRTC or HLS |
| **Recording** | Record session for audit/replay | Screen capture to video file |

### 5.3 Overlay Implementation

```typescript
// packages/desktop-agent/src/overlay/overlay-window.ts
import { BrowserWindow, screen } from 'electron';

export class CollaborationOverlay {
  private window: BrowserWindow;

  constructor() {
    this.window = new BrowserWindow({
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: false,
      // Cover entire primary display
      ...screen.getPrimaryDisplay().bounds,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
    
    // Click-through: let mouse events pass to underlying windows
    this.window.setIgnoreMouseEvents(true, { forward: true });
  }

  async highlightElement(bounds: Rectangle, label?: string): Promise<void> {
    this.window.webContents.send('highlight', { bounds, label });
  }

  async showCursor(position: Point, action: 'move' | 'click'): Promise<void> {
    this.window.webContents.send('cursor', { position, action });
  }

  async showToast(message: string, duration?: number): Promise<void> {
    this.window.webContents.send('toast', { message, duration });
  }
}
```

### 5.4 Screen Streaming

For remote observation (e.g., viewing agent actions from web dashboard):

```typescript
// packages/desktop-agent/src/streaming/screen-stream.ts
import { desktopCapturer } from 'electron';

export class ScreenStreamer {
  private mediaRecorder: MediaRecorder | null = null;
  private peerConnection: RTCPeerConnection | null = null;

  async startStream(options: StreamOptions): Promise<string> {
    const sources = await desktopCapturer.getSources({ types: ['screen'] });
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sources[0].id,
          maxFrameRate: options.fps || 15,
        },
      },
    });

    // WebRTC signaling via gateway
    this.peerConnection = new RTCPeerConnection(options.rtcConfig);
    stream.getTracks().forEach(track => this.peerConnection!.addTrack(track, stream));
    
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    
    // Send offer to gateway, receive answer
    const answer = await this.gateway.request('screen.stream.signal', {
      type: 'offer',
      sdp: offer.sdp,
    });
    
    await this.peerConnection.setRemoteDescription(answer);
    return stream.id;
  }
}
```

---

## 6. Gateway Integration

### 6.1 Protocol Extensions

New gateway methods for desktop agent:

```typescript
// Gateway method registrations
registerGatewayMethod('windows.uia.inspect', handleUiaInspect);
registerGatewayMethod('windows.uia.interact', handleUiaInteract);
registerGatewayMethod('windows.office.excel', handleExcelCommand);
registerGatewayMethod('windows.office.word', handleWordCommand);
registerGatewayMethod('windows.office.outlook', handleOutlookCommand);
registerGatewayMethod('screen.stream.start', handleStreamStart);
registerGatewayMethod('screen.stream.stop', handleStreamStop);
registerGatewayMethod('screen.stream.signal', handleStreamSignal);
```

### 6.2 Tool Routing

The agent framework routes tool calls to connected desktop agents:

```typescript
// Tool definition in agent tools
{
  name: 'excel_read',
  description: 'Read data from an Excel spreadsheet on the user\'s computer',
  parameters: {
    workbook: { type: 'string', description: 'Path to workbook file' },
    sheet: { type: 'string', description: 'Sheet name' },
    range: { type: 'string', description: 'Cell range (e.g., "A1:D10")' },
  },
  execute: async (params, context) => {
    // Route to connected desktop agent
    const node = await context.findNode({ caps: ['windows.office.excel'] });
    if (!node) throw new Error('No desktop agent connected with Excel capability');
    
    return await node.invoke('windows.office.excel', {
      action: 'read',
      ...params,
    });
  },
}
```

### 6.3 Authentication Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Desktop    │     │   Gateway    │     │    Auth      │
│    Agent     │     │   Server     │     │   Provider   │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │  1. Connect        │                    │
       │───────────────────>│                    │
       │                    │                    │
       │  2. Auth Challenge │                    │
       │<───────────────────│                    │
       │                    │                    │
       │  3. Open browser for OIDC               │
       │─────────────────────────────────────────>
       │                    │                    │
       │  4. OIDC callback with tokens           │
       │<─────────────────────────────────────────
       │                    │                    │
       │  5. Submit token   │                    │
       │───────────────────>│                    │
       │                    │  6. Validate       │
       │                    │───────────────────>│
       │                    │                    │
       │  7. Authenticated  │                    │
       │<───────────────────│                    │
```

---

## 7. Security Model

### 7.1 Principles

| Principle | Implementation |
|-----------|----------------|
| **Least Privilege** | Agent requests only needed capabilities |
| **User Consent** | Explicit approval for sensitive actions |
| **Audit Trail** | All actions logged with context |
| **Tenant Isolation** | Agent only accesses tenant-authorized resources |
| **Encryption** | TLS for gateway connection, encrypted local storage |

### 7.2 Exec Approvals

Leverage existing exec approvals system (`src/infra/exec-approvals.ts`):

```typescript
// Desktop agent exec approval categories
{
  categories: {
    'windows.office': {
      description: 'Microsoft Office automation',
      defaultPolicy: 'prompt',  // Ask user first time
      rememberChoice: true,
    },
    'windows.uia': {
      description: 'UI Automation (click, type, etc.)',
      defaultPolicy: 'prompt',
      rememberChoice: true,
      excludeApps: ['banking*', 'password*'],  // Never automate these
    },
    'screen.stream': {
      description: 'Screen sharing with AI',
      defaultPolicy: 'prompt',
      rememberChoice: false,  // Always ask
    },
  }
}
```

### 7.3 Sensitive App Protection

```typescript
// Block automation of sensitive applications
const PROTECTED_APPS = [
  /password/i,
  /banking/i,
  /authenticator/i,
  /keepass/i,
  /1password/i,
  /lastpass/i,
  /bitwarden/i,
];

function isProtectedApp(windowTitle: string, processName: string): boolean {
  return PROTECTED_APPS.some(pattern => 
    pattern.test(windowTitle) || pattern.test(processName)
  );
}
```

---

## 8. Technology Stack

### 8.1 Core Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Shell** | Electron 28+ | Cross-platform, mature, good Windows support |
| **Runtime** | Node.js 20+ | Match GoodTeams core |
| **Build** | electron-builder | Standard, good auto-update support |
| **UI** | React + Tailwind | Consistency with GoodTeams web |
| **State** | Zustand | Lightweight, React-friendly |

### 8.2 Windows Integration

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **UI Automation** | node-ffi-napi + UIAutomationClient | Native Windows UIA |
| **COM Automation** | edge-js (.NET) | Best Office integration |
| **Screen Capture** | Electron desktopCapturer | Built-in, efficient |
| **Streaming** | WebRTC | Standard, works through firewalls |
| **Overlay** | Electron transparent window | Native, click-through support |

### 8.3 Dependencies

```json
{
  "dependencies": {
    "@goodteams/core": "workspace:*",
    "electron": "^28.0.0",
    "edge-js": "^19.0.0",
    "node-ffi-napi": "^4.0.0",
    "robotjs": "^0.6.0",
    "zustand": "^4.0.0"
  },
  "devDependencies": {
    "electron-builder": "^24.0.0",
    "@electron/rebuild": "^3.0.0"
  }
}
```

---

## 9. Implementation Roadmap

### Phase D1: Foundation (4 weeks)

| Task | Effort | Deliverable |
|------|--------|-------------|
| Electron shell scaffolding | 1 week | Tray app, basic UI |
| Gateway client integration | 1 week | Connect as node, auth flow |
| Basic exec capability | 1 week | Run commands, return output |
| Installer/auto-update | 1 week | MSI installer, Squirrel updates |

**Milestone:** Desktop agent connects to gateway, can execute commands

### Phase D2: Windows Automation (6 weeks)

| Task | Effort | Deliverable |
|------|--------|-------------|
| UI Automation bindings | 2 weeks | Inspect, click, type via UIA |
| Office COM automation | 2 weeks | Excel, Word, Outlook basics |
| Tool registration | 1 week | Tools available to agent |
| Error handling/recovery | 1 week | Graceful failures, retries |

**Milestone:** Agent can automate Excel, Word, Outlook and standard Windows apps

### Phase D3: Visual Collaboration (4 weeks)

| Task | Effort | Deliverable |
|------|--------|-------------|
| Overlay window | 1 week | Transparent, click-through |
| Element highlighting | 1 week | Show targets before interaction |
| Cursor visualization | 1 week | Animated cursor showing AI movement |
| Screen streaming (WebRTC) | 1 week | Real-time stream to web UI |

**Milestone:** Users can watch AI actions in real-time

### Phase D4: Polish & Enterprise (4 weeks)

| Task | Effort | Deliverable |
|------|--------|-------------|
| Approval workflows | 1 week | User consent for sensitive actions |
| Audit logging | 1 week | Full action audit trail |
| Enterprise deployment | 1 week | MSI/MSIX, GPO support |
| Performance optimization | 1 week | Memory, CPU, battery |

**Milestone:** Enterprise-ready desktop agent

### Total: ~18 weeks (4.5 months)

---

## 10. Open Questions

### Technical

1. **UIA vs Vision trade-off:** How much to invest in vision-based fallback for apps without UIA support?
2. **Office version matrix:** Which Office versions to support? (365, 2021, 2019?)
3. **Multi-monitor:** How to handle multi-monitor setups for streaming/overlay?
4. **Citrix/VDI:** Support for virtualized desktops?

### Product

1. **Recording consent:** Should we record sessions by default for audit? User opt-in/out?
2. **Intervention UX:** How does user interrupt/correct the AI mid-task?
3. **Offline mode:** What capabilities work without gateway connection?
4. **Mobile companion:** Should there be a mobile app to watch/control desktop agent?

### Business

1. **Licensing:** Per-seat? Per-device? Concurrent user?
2. **Support model:** How to debug issues on customer machines?
3. **Compliance:** Additional certifications needed for desktop agent?

---

## Appendix: Related Documents

- [GOODTEAMS-STRATEGY.md](./GOODTEAMS-STRATEGY.md) — Overall enterprise transformation strategy
- [OpenClaw Node Host](../src/node-host/runner.ts) — Existing node protocol implementation
- [Browser Automation](../src/browser/) — Playwright integration reference

---

*This document is a living spec. Updates should be made as implementation progresses and requirements evolve.*
