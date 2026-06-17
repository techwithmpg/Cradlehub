/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PasswordInput } from "@/components/shared/password-input";

afterEach(() => cleanup());

describe("PasswordInput", () => {
  it("toggles password visibility with an accessible button", () => {
    render(<PasswordInput aria-label="Password" />);

    const input = screen.getByLabelText("Password");
    expect(input.getAttribute("type")).toBe("password");

    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(input.getAttribute("type")).toBe("text");

    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(input.getAttribute("type")).toBe("password");
  });
});
