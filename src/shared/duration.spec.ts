import { resolveDurationMinutes } from "./duration";
import { PetSize, PetSpecies } from "../pets/dto/pet.enums";

describe("resolveDurationMinutes", () => {
  const baseRules = [
    {
      species: PetSpecies.DOG,
      size: PetSize.SMALL,
      breed: null,
      baseDurationMinutes: 45,
      isDefaultForSpecies: false,
    },
    {
      species: PetSpecies.DOG,
      size: null,
      breed: "poodle",
      baseDurationMinutes: 60,
      isDefaultForSpecies: false,
    },
    {
      species: PetSpecies.DOG,
      size: null,
      breed: null,
      baseDurationMinutes: 50,
      isDefaultForSpecies: true,
    },
  ];

  it("prefers exact breed match", () => {
    const duration = resolveDurationMinutes(baseRules, {
      species: PetSpecies.DOG,
      size: PetSize.SMALL,
      breed: "Poodle",
    });
    expect(duration).toBe(60);
  });

  it("falls back to size match", () => {
    const duration = resolveDurationMinutes(baseRules, {
      species: PetSpecies.DOG,
      size: PetSize.SMALL,
      breed: "Unknown",
    });
    expect(duration).toBe(45);
  });

  it("falls back to default rule", () => {
    const duration = resolveDurationMinutes(baseRules, {
      species: PetSpecies.DOG,
      size: PetSize.MEDIUM,
      breed: "Unknown",
    });
    expect(duration).toBe(50);
  });

  it("throws when no rule matches", () => {
    expect(() =>
      resolveDurationMinutes([], {
        species: PetSpecies.CAT,
        size: PetSize.SMALL,
        breed: "Unknown",
      }),
    ).toThrow("No duration rule found");
  });
});
