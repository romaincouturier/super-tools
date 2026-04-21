import { describe, it, expect } from "vitest";
import {
  getGoogleMapsDirectionsUrl,
  getGoogleMapsSearchUrl,
  getGoogleMapsNearbyUrl,
} from "./googleMaps";

describe("getGoogleMapsDirectionsUrl", () => {
  it("encodes destination", () => {
    expect(getGoogleMapsDirectionsUrl("10 rue de Paris, Lyon")).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=10%20rue%20de%20Paris%2C%20Lyon"
    );
  });
});

describe("getGoogleMapsSearchUrl", () => {
  it("encodes query", () => {
    expect(getGoogleMapsSearchUrl("restaurants Lyon")).toBe(
      "https://www.google.com/maps/search/?api=1&query=restaurants%20Lyon"
    );
  });
});

describe("getGoogleMapsNearbyUrl", () => {
  it("builds nearby search URL", () => {
    expect(getGoogleMapsNearbyUrl("restaurants", "Lyon")).toBe(
      "https://www.google.com/maps/search/restaurants+near+Lyon"
    );
  });

  it("encodes location with special chars", () => {
    expect(getGoogleMapsNearbyUrl("hotels", "Saint-Étienne")).toBe(
      "https://www.google.com/maps/search/hotels+near+Saint-%C3%89tienne"
    );
  });
});
