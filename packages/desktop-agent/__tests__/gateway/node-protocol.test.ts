/**
 * Tests for Node Protocol helpers
 */

import { describe, it, expect } from "vitest";
import {
  PROTOCOL_VERSION,
  NODE_CAPABILITIES,
  NODE_COMMANDS,
  NODE_ERROR_CODES,
  successResult,
  errorResult,
} from "../../src/gateway/node-protocol.js";

describe("Node Protocol", () => {
  describe("PROTOCOL_VERSION", () => {
    it("should be defined", () => {
      expect(PROTOCOL_VERSION).toBeDefined();
      expect(typeof PROTOCOL_VERSION).toBe("number");
    });

    it("should be at least 1", () => {
      expect(PROTOCOL_VERSION).toBeGreaterThanOrEqual(1);
    });
  });

  describe("NODE_CAPABILITIES", () => {
    it("should define screen capture capability", () => {
      expect(NODE_CAPABILITIES.SCREEN_CAPTURE).toBe("screen.capture");
    });

    it("should define screen stream capability", () => {
      expect(NODE_CAPABILITIES.SCREEN_STREAM).toBe("screen.stream");
    });

    it("should define UI automation capability", () => {
      expect(NODE_CAPABILITIES.UI_AUTOMATION).toBe("ui.automation");
    });

    it("should define Office automation capability", () => {
      expect(NODE_CAPABILITIES.OFFICE_AUTOMATION).toBe("office.automation");
    });

    it("should define command exec capability", () => {
      expect(NODE_CAPABILITIES.COMMAND_EXEC).toBe("command.exec");
    });

    it("should define filesystem capability", () => {
      expect(NODE_CAPABILITIES.FILESYSTEM).toBe("filesystem");
    });
  });

  describe("NODE_COMMANDS", () => {
    describe("screen commands", () => {
      it("should define screen capture command", () => {
        expect(NODE_COMMANDS.SCREEN_CAPTURE).toBe("screen.capture");
      });

      it("should define screen stream commands", () => {
        expect(NODE_COMMANDS.SCREEN_STREAM_START).toBe("screen.stream.start");
        expect(NODE_COMMANDS.SCREEN_STREAM_STOP).toBe("screen.stream.stop");
      });

      it("should define get sources command", () => {
        expect(NODE_COMMANDS.SCREEN_GET_SOURCES).toBe("screen.get_sources");
      });
    });

    describe("UI commands", () => {
      it("should define click command", () => {
        expect(NODE_COMMANDS.UI_CLICK).toBe("ui.click");
      });

      it("should define type command", () => {
        expect(NODE_COMMANDS.UI_TYPE).toBe("ui.type");
      });

      it("should define scroll command", () => {
        expect(NODE_COMMANDS.UI_SCROLL).toBe("ui.scroll");
      });

      it("should define get windows command", () => {
        expect(NODE_COMMANDS.UI_GET_WINDOWS).toBe("ui.get_windows");
      });

      it("should define get elements command", () => {
        expect(NODE_COMMANDS.UI_GET_ELEMENTS).toBe("ui.get_elements");
      });

      it("should define wait for command", () => {
        expect(NODE_COMMANDS.UI_WAIT_FOR).toBe("ui.wait_for");
      });
    });

    describe("Office commands", () => {
      it("should define Excel commands", () => {
        expect(NODE_COMMANDS.EXCEL_OPEN).toBe("excel.open");
        expect(NODE_COMMANDS.EXCEL_READ).toBe("excel.read");
        expect(NODE_COMMANDS.EXCEL_WRITE).toBe("excel.write");
      });

      it("should define Word commands", () => {
        expect(NODE_COMMANDS.WORD_OPEN).toBe("word.open");
        expect(NODE_COMMANDS.WORD_READ).toBe("word.read");
        expect(NODE_COMMANDS.WORD_WRITE).toBe("word.write");
      });

      it("should define Outlook commands", () => {
        expect(NODE_COMMANDS.OUTLOOK_LIST_MAIL).toBe("outlook.list_mail");
        expect(NODE_COMMANDS.OUTLOOK_SEND_MAIL).toBe("outlook.send_mail");
      });
    });

    describe("system commands", () => {
      it("should define ping command", () => {
        expect(NODE_COMMANDS.PING).toBe("ping");
      });

      it("should define get info command", () => {
        expect(NODE_COMMANDS.GET_INFO).toBe("get_info");
      });
    });
  });

  describe("NODE_ERROR_CODES", () => {
    it("should define NOT_IMPLEMENTED", () => {
      expect(NODE_ERROR_CODES.NOT_IMPLEMENTED).toBe("NOT_IMPLEMENTED");
    });

    it("should define INVALID_PARAMS", () => {
      expect(NODE_ERROR_CODES.INVALID_PARAMS).toBe("INVALID_PARAMS");
    });

    it("should define EXEC_ERROR", () => {
      expect(NODE_ERROR_CODES.EXEC_ERROR).toBe("EXEC_ERROR");
    });

    it("should define TIMEOUT", () => {
      expect(NODE_ERROR_CODES.TIMEOUT).toBe("TIMEOUT");
    });

    it("should define PERMISSION_DENIED", () => {
      expect(NODE_ERROR_CODES.PERMISSION_DENIED).toBe("PERMISSION_DENIED");
    });

    it("should define NOT_FOUND", () => {
      expect(NODE_ERROR_CODES.NOT_FOUND).toBe("NOT_FOUND");
    });
  });

  describe("successResult", () => {
    it("should create success result without payload", () => {
      const result = successResult();

      expect(result.ok).toBe(true);
      expect(result.payload).toBeUndefined();
    });

    it("should create success result with payload", () => {
      const payload = { data: "test", count: 42 };
      const result = successResult(payload);

      expect(result.ok).toBe(true);
      expect(result.payload).toEqual(payload);
    });

    it("should handle null payload", () => {
      const result = successResult(null);

      expect(result.ok).toBe(true);
      expect(result.payload).toBeNull();
    });

    it("should handle complex payload", () => {
      const payload = {
        nested: { value: 1 },
        array: [1, 2, 3],
        string: "test",
      };
      const result = successResult(payload);

      expect(result.payload).toEqual(payload);
    });
  });

  describe("errorResult", () => {
    it("should create error result", () => {
      const result = errorResult("TEST_ERROR", "Test error message");

      expect(result.ok).toBe(false);
      expect(result.error.code).toBe("TEST_ERROR");
      expect(result.error.message).toBe("Test error message");
    });

    it("should work with NODE_ERROR_CODES", () => {
      const result = errorResult(
        NODE_ERROR_CODES.NOT_IMPLEMENTED,
        "Feature not implemented"
      );

      expect(result.ok).toBe(false);
      expect(result.error.code).toBe("NOT_IMPLEMENTED");
    });

    it("should handle empty message", () => {
      const result = errorResult("ERROR", "");

      expect(result.error.message).toBe("");
    });
  });
});
