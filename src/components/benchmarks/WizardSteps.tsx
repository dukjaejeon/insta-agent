"use client";

interface WizardStepsProps {
  currentStep: number;
  steps: string[];
}

export function WizardSteps({ currentStep, steps }: WizardStepsProps) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((label, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === currentStep;
        const isDone = stepNum < currentStep;

        return (
          <div key={label} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={`w-8 h-px ${
                  isDone ? "bg-sage" : "bg-border-soft"
                }`}
              />
            )}
            <div className="flex items-center gap-2">
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  ${
                    isDone
                      ? "bg-sage text-white"
                      : isActive
                        ? "bg-sage/20 text-sage-dark border-2 border-sage"
                        : "bg-white/60 text-charcoal-light border border-border-soft"
                  }
                `}
              >
                {isDone ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  stepNum
                )}
              </div>
              <span
                className={`text-sm hidden sm:block ${
                  isActive ? "font-semibold text-charcoal" : "text-charcoal-light"
                }`}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
