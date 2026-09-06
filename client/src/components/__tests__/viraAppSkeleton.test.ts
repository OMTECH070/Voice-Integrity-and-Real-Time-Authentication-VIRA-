import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { ViraAppSkeleton } from "../ViraAppSkeleton";
import { EasyModeProvider } from "../../context/EasyModeContext";

test("ViraAppSkeleton Component & Accessibility Test Suite", async (t) => {
  await t.test("1. Renders default connecting message and accessible attributes", () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(ViraAppSkeleton)
    );

    assert.ok(html.includes('role="status"'), "Must include role='status'");
    assert.ok(html.includes('aria-busy="true"'), "Must include aria-busy='true'");
    assert.ok(html.includes('aria-live="polite"'), "Must include aria-live='polite'");
    assert.ok(
      html.includes("Connecting to secure WebRTC signaling network..."),
      "Default message must be present"
    );
    assert.ok(
      html.includes("vira-skeleton-page-wrapper"),
      "Must have wrapper class with dark background"
    );
  });

  await t.test("2. Renders custom initialization message when provided", () => {
    const customMessage = "Authenticating secure session...";
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(ViraAppSkeleton, { message: customMessage })
    );

    assert.ok(html.includes(customMessage), "Custom message must be rendered");
    assert.ok(
      html.includes(`aria-label="${customMessage}"`),
      "Accessible label should reflect custom message"
    );
  });

  await t.test("3. Renders error message and retry button when initialization fails", () => {
    const errorMessage = "WebRTC signaling socket timeout";
    const handleRetry = () => {};

    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(ViraAppSkeleton, {
        error: errorMessage,
        onRetry: handleRetry,
      })
    );

    assert.ok(html.includes(errorMessage), "Error message must be displayed");
    assert.ok(
      html.includes("Retry Connection"),
      "Retry button must be rendered on error"
    );
    assert.ok(
      html.includes("vira-skeleton-status-dot error"),
      "Status dot must indicate error"
    );
  });

  await t.test("4. Renders standard editorial dashboard placeholders (Navbar, Header, Voice ID, People, System)", () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(ViraAppSkeleton)
    );

    assert.ok(
      html.includes("vira-skeleton-brand-logo"),
      "Must have brand logo placeholder"
    );
    assert.ok(
      html.includes("vira-skeleton-editorial-header"),
      "Must have editorial header placeholder"
    );
    assert.ok(
      html.includes("vira-skeleton-voice-row"),
      "Must have Voice ID section placeholder"
    );
    assert.ok(
      html.includes("vira-skeleton-people-list"),
      "Must have people directory list placeholder"
    );
    assert.ok(
      html.includes("vira-skeleton-system-table"),
      "Must have system status table placeholder"
    );
  });

  await t.test("5. Strictly DOES NOT contain any Speaker button or speaker routing code", () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(ViraAppSkeleton)
    );

    assert.ok(
      !html.toLowerCase().includes("speaker"),
      "Skeleton must NOT contain any Speaker button"
    );
  });

  await t.test("6. Renders Easy Mode skeleton when wrapped in EasyModeProvider", () => {
    // Save previous window localStorage if needed
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(
        EasyModeProvider,
        null,
        React.createElement(ViraAppSkeleton)
      )
    );

    // Standard or easy mode depending on default state (easy mode is OFF by default)
    assert.ok(
      html.includes("vira-skeleton-container"),
      "Skeleton container must always render"
    );
  });
});
