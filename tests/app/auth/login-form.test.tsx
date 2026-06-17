/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/app/(auth)/login/login-form";

vi.mock("@/components/shared/brand-logo", () => ({
  BrandLogo: () => <div aria-label="Cradle Wellness Living" role="img" />,
}));

afterEach(() => cleanup());

describe("LoginForm", () => {
  it("displays the password-updated success message", () => {
    render(<LoginForm passwordUpdated />);

    expect(screen.getByText(/Your password has been updated/i)).toBeTruthy();
    expect(screen.getByText(/You can now sign in with your new password/i)).toBeTruthy();
  });
});
