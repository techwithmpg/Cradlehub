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

  it("keeps multiple password visibility controls independent", () => {
    render(
      <>
        <PasswordInput aria-label="New password" />
        <PasswordInput aria-label="Confirm password" />
      </>
    );

    const newPassword = screen.getByLabelText("New password");
    const confirmPassword = screen.getByLabelText("Confirm password");
    const buttons = screen.getAllByRole("button", { name: "Show password" });

    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[0]!);

    expect(newPassword.getAttribute("type")).toBe("text");
    expect(confirmPassword.getAttribute("type")).toBe("password");
  });
});
