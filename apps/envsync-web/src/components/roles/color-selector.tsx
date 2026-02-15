import { getRandomHexCode } from "@/lib/utils";
import { Shuffle } from "lucide-react";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Function } from "@/utils/env";

export const ColorSelector = ({
  color,
  setColor,
}: {
  color: string;
  setColor: Function<string>;
}) => {
  return (
    <div className="bg-slate-900 h-10 size-full rounded-md border border-slate-700 text-white font-mono flex items-center justify-start p-2">
      <Label
        className="w-5 cursor-pointer aspect-square rounded-full"
        style={{ backgroundColor: color }}
        htmlFor="color-picker"
      >
        <Input
          id="color-picker"
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="size-0 invisible rounded-full text-white cursor-pointer"
        />
      </Label>
      <input
        type="text"
        value={color.toUpperCase()}
        onChange={(e) => setColor(e.target.value.toUpperCase())}
        className="bg-transparent flex-1 h-full border-none text-white font-mono ml-2 w-full ring-0! outline-none! border-none! 
                        select-all focus-within:ring-0 focus-within:outline-none focus-within:border-none"
        placeholder="#6366f1"
      />
      <button
        onClick={() => {
          const color = getRandomHexCode();
          setColor(color);
        }}
      >
        <Shuffle size={16} />
      </button>
    </div>
  );
};
