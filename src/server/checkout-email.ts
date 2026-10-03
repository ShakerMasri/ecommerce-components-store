// One budget for preparation and both parallel checkout notifications. Timers
// depend on a responsive event loop; the timestamp also guards late preparation.
export const CHECKOUT_EMAIL_BUDGET_MS = 8_000;

export type EmailDeliveryBudget = {
  signal: AbortSignal;
  expiresAt: number;
  check: () => void;
};

export function awaitEmailWithinBudget<T>(
  work: Promise<T>,
  budget: EmailDeliveryBudget,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Error("Checkout email deadline exceeded."));
    budget.signal.addEventListener("abort", abort, { once: true });
    // Keep both handlers attached even after cancellation: a late rejection is
    // observed, and late completion cannot change the checkout result.
    void work.then(
      (value) => {
        budget.signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (error: unknown) => {
        budget.signal.removeEventListener("abort", abort);
        reject(
          error instanceof Error
            ? error
            : new Error("Checkout email delivery failed."),
        );
      },
    );
    if (budget.signal.aborted) abort();
  });
}

export async function runCheckoutEmailWork(
  tasks: ((budget: EmailDeliveryBudget) => Promise<void>)[],
) {
  const controller = new AbortController();
  const expiresAt = performance.now() + CHECKOUT_EMAIL_BUDGET_MS;
  const budget: EmailDeliveryBudget = {
    signal: controller.signal,
    expiresAt,
    check: () => {
      if (performance.now() >= expiresAt) controller.abort();
      controller.signal.throwIfAborted();
    },
  };
  const timer = setTimeout(() => controller.abort(), CHECKOUT_EMAIL_BUDGET_MS);
  try {
    return await Promise.allSettled(
      tasks.map((task) =>
        awaitEmailWithinBudget(
          Promise.resolve().then(() => {
            budget.check();
            return task(budget);
          }),
          budget,
        ),
      ),
    );
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
