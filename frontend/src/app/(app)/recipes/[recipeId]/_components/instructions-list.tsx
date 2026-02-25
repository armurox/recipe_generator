"use client";

type Instruction = {
  step: number | null;
  text: string;
};

type InstructionsListProps = {
  instructions: Instruction[];
};

export function InstructionsList({ instructions }: InstructionsListProps) {
  if (instructions.length === 0) return null;

  return (
    <div className="mb-5">
      <h2 className="mb-3 text-lg font-bold">Instructions</h2>
      <div className="space-y-4">
        {instructions.map((instruction, index) => (
          <div key={index} className="flex gap-3.5">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-700 text-sm font-semibold text-white">
              {instruction.step ?? index + 1}
            </div>
            <p className="text-[15px] leading-relaxed text-gray-700">{instruction.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
