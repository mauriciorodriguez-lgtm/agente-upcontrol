
import React from 'react';

interface StepIndicatorProps {
  currentStep: number;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  const steps = ["Usuario", "Producto", "Análisis"];
  const BRAND_COLOR = "bg-[#991B1B]";
  const BRAND_BORDER = "border-[#991B1B]";
  const BRAND_TEXT = "text-[#991B1B]";

  return (
    <div className="flex items-center justify-center mb-12 space-x-4">
      {steps.map((label, index) => (
        <React.Fragment key={label}>
          <div className="flex flex-col items-center">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all duration-300 ${
              currentStep >= index + 1 ? `${BRAND_COLOR} ${BRAND_BORDER} text-white shadow-lg` : 'bg-white border-slate-200 text-slate-300'
            }`}>
              <span className="text-sm font-bold">{index + 1}</span>
            </div>
            <span className={`text-[10px] uppercase tracking-[0.2em] mt-3 font-bold ${currentStep >= index + 1 ? BRAND_TEXT : 'text-slate-300'}`}>
              {label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div className={`w-16 h-[2px] rounded-full transition-all duration-500 ${currentStep > index + 1 ? BRAND_COLOR : 'bg-slate-200'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};
