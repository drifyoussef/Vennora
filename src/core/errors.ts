/**
 * Erreurs métier.
 *
 * Règle : ne jamais laisser un message d'erreur révéler l'existence d'une
 * ressource appartenant à une autre organisation. Une ressource d'un autre
 * tenant se comporte comme une ressource inexistante — c'est `NotFoundError`,
 * pas `ForbiddenError`, sinon la présence d'un identifiant devient un oracle.
 */

export class AppError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Ressource") {
    super(`${resource} introuvable.`, "NOT_FOUND", 404);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Vous n'avez pas les droits nécessaires.") {
    super(message, "FORBIDDEN", 403);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentification requise.") {
    super(message, "UNAUTHORIZED", 401);
  }
}

export class ValidationError extends AppError {
  constructor(
    message = "Données invalides.",
    readonly fieldErrors: Record<string, string[]> = {},
  ) {
    super(message, "VALIDATION", 422);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, "CONFLICT", 409);
  }
}

/** Résultat d'une Server Action, consommable directement par un formulaire. */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: string; fieldErrors?: Record<string, string[]> };

export function toActionError(e: unknown): Extract<ActionResult, { ok: false }> {
  if (e instanceof ValidationError) {
    return {
      ok: false,
      error: e.message,
      code: e.code,
      fieldErrors: e.fieldErrors,
    };
  }
  if (e instanceof AppError) {
    return { ok: false, error: e.message, code: e.code };
  }
  // Les erreurs inattendues ne remontent jamais telles quelles à l'utilisateur :
  // elles peuvent contenir des fragments de requête ou d'URI de connexion.
  console.error("[vennora] erreur non gérée", e);
  return {
    ok: false,
    error: "Une erreur est survenue. Réessayez dans un instant.",
    code: "INTERNAL",
  };
}
