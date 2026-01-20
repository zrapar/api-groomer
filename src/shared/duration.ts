type Species = "DOG" | "CAT";
type Size = "MINI" | "SMALL" | "MEDIUM" | "LARGE" | "GIANT";

type DurationRule = {
  species: Species;
  size: Size | null;
  breed: string | null;
  baseDurationMinutes: number;
  isDefaultForSpecies: boolean;
};

type PetLike = {
  species: Species;
  size: Size;
  breed: string;
};

export function resolveDurationMinutes(
  rules: DurationRule[],
  pet: PetLike,
): number {
  const breedLower = pet.breed.toLowerCase();

  const byBreed = rules.find(
    (rule) =>
      rule.species === pet.species &&
      rule.breed &&
      rule.breed.toLowerCase() === breedLower,
  );
  if (byBreed) {
    return byBreed.baseDurationMinutes;
  }

  const bySize = rules.find(
    (rule) => rule.species === pet.species && rule.size === pet.size,
  );
  if (bySize) {
    return bySize.baseDurationMinutes;
  }

  const defaultRule = rules.find(
    (rule) => rule.species === pet.species && rule.isDefaultForSpecies,
  );
  if (defaultRule) {
    return defaultRule.baseDurationMinutes;
  }

  throw new Error(
    `No duration rule found for ${pet.species} (${pet.breed}, ${pet.size}).`,
  );
}
