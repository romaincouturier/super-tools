import { describe, it, expect } from "vitest";
import {
  IK_RATES,
  DEFAULT_SETTINGS,
  emptyDestination,
  formatEur,
  destToFavorite,
  favoriteToDestination,
  calcDestinationCost,
  type TravelDestination,
  type TravelSettings,
} from "./travelExpenseUtils";

describe("travelExpenseUtils", () => {
  describe("IK_RATES", () => {
    it("contains rates for all fiscal power levels", () => {
      expect(IK_RATES[3]).toBeDefined();
      expect(IK_RATES[4]).toBeDefined();
      expect(IK_RATES[5]).toBeDefined();
      expect(IK_RATES[6]).toBeDefined();
      expect(IK_RATES[7]).toBeDefined();
    });

    it("has correct 5CV rate", () => {
      expect(IK_RATES[5].perKm).toBe(0.636);
    });
  });

  describe("emptyDestination", () => {
    it("returns a destination with default values", () => {
      const dest = emptyDestination();
      expect(dest.city).toBe("");
      expect(dest.transportMode).toBe("train");
      expect(dest.roundTrips).toBe(1);
      expect(dest.days).toBe(1);
      expect(dest.nights).toBe(0);
      expect(dest.distanceKm).toBe(0);
      expect(dest.isFetchingDistance).toBe(false);
    });

    it("generates unique IDs", () => {
      const d1 = emptyDestination();
      const d2 = emptyDestination();
      expect(d1.id).not.toBe(d2.id);
    });
  });

  describe("formatEur", () => {
    it("formats integers without decimals", () => {
      expect(formatEur(100)).toMatch(/100/);
    });

    it("formats decimals with up to 2 places", () => {
      expect(formatEur(99.5)).toMatch(/99,5/);
    });

    it("handles zero", () => {
      expect(formatEur(0)).toBe("0");
    });
  });

  describe("destToFavorite / favoriteToDestination", () => {
    it("round-trips correctly", () => {
      const dest: TravelDestination = {
        ...emptyDestination(),
        city: "Paris",
        lat: 48.85,
        lon: 2.35,
        transportMode: "train",
        roundTrips: 2,
        days: 3,
        nights: 2,
        ticketPriceRoundTrip: 120,
      };

      const fav = destToFavorite(dest);
      expect(fav.city).toBe("Paris");
      expect(fav.transportMode).toBe("train");
      expect(fav.roundTrips).toBe(2);

      const restored = favoriteToDestination(fav);
      expect(restored.city).toBe("Paris");
      expect(restored.lat).toBe(48.85);
      expect(restored.transportMode).toBe("train");
      expect(restored.roundTrips).toBe(2);
      expect(restored.ticketPriceRoundTrip).toBe(120);
      expect(restored.id).toBeTruthy();
    });
  });

  describe("calcDestinationCost", () => {
    const settings: TravelSettings = { ...DEFAULT_SETTINGS, vehicleHp: 5 };

    it("calculates car costs with IK + tolls", () => {
      const dest: TravelDestination = {
        ...emptyDestination(),
        transportMode: "car",
        distanceKm: 200,
        tollCostOneWay: 15,
        roundTrips: 1,
        days: 1,
        nights: 0,
      };

      const costs = calcDestinationCost(dest, settings);
      // IK: 200 * 2 * 0.636 * 1 = 254.4
      // Tolls: 15 * 2 * 1 = 30
      expect(costs.transportCost).toBeCloseTo(284.4, 1);
      expect(costs.parkingCost).toBe(0);
      expect(costs.nightsCost).toBe(0);
      expect(costs.mealsCost).toBeCloseTo(settings.lunchRate, 1);
    });

    it("calculates train costs with parking and loyalty", () => {
      const dest: TravelDestination = {
        ...emptyDestination(),
        transportMode: "train",
        ticketPriceRoundTrip: 120,
        roundTrips: 2,
        days: 2,
        nights: 1,
      };

      const costs = calcDestinationCost(dest, settings);
      // Transport: 120 * 2 = 240
      expect(costs.transportCost).toBe(240);
      // Parking: 15 * (1+1) * 2 = 60
      expect(costs.parkingCost).toBe(settings.parkingRate * 2 * 2);
      // Loyalty: 5 * 2 = 10
      expect(costs.loyaltyCost).toBe(settings.trainLoyaltyPerTrip * 2);
      // Nights: 1 * 70 = 70
      expect(costs.nightsCost).toBe(settings.nightRate);
      // Meals: 2*20.7 + 1*20.7 + 1*10 = 72.1
      expect(costs.mealsCost).toBeCloseTo(2 * settings.lunchRate + settings.dinnerRate + settings.breakfastRate, 1);
    });

    it("calculates plane costs (transport only + meals/nights)", () => {
      const dest: TravelDestination = {
        ...emptyDestination(),
        transportMode: "plane",
        ticketPriceRoundTrip: 300,
        roundTrips: 1,
        days: 1,
        nights: 1,
      };

      const costs = calcDestinationCost(dest, settings);
      expect(costs.transportCost).toBe(300);
      expect(costs.parkingCost).toBe(0);
      expect(costs.loyaltyCost).toBe(0);
      expect(costs.nightsCost).toBe(settings.nightRate);
    });

    it("total equals sum of all cost components", () => {
      const dest: TravelDestination = {
        ...emptyDestination(),
        transportMode: "train",
        ticketPriceRoundTrip: 100,
        roundTrips: 1,
        days: 2,
        nights: 1,
      };

      const costs = calcDestinationCost(dest, settings);
      expect(costs.total).toBeCloseTo(
        costs.transportCost + costs.parkingCost + costs.loyaltyCost + costs.nightsCost + costs.mealsCost,
        2
      );
    });

    it("handles zero values gracefully", () => {
      const dest = emptyDestination(); // train, 1 day, 0 nights, 1 roundTrip
      const costs = calcDestinationCost(dest, settings);
      // Transport: 0, Parking: 15*(0+1)*1=15, Loyalty: 5*1=5, Nights: 0, Meals: 20.7
      expect(costs.total).toBeCloseTo(
        settings.parkingRate + settings.trainLoyaltyPerTrip + settings.lunchRate,
        1
      );
    });
  });
});
