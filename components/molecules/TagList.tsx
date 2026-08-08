import React from "react";
import Badge from "../atoms/Badge";

/** Style tags for a company. `max` trims the list on the dense card grid. */
const TagList: React.FC<{
  tags: readonly string[];
  max?: number;
  size?: "xs" | "sm";
  className?: string;
}> = ({ tags, max, size = "sm", className = "" }) => {
  if (tags.length === 0) return null;
  const shown = typeof max === "number" ? tags.slice(0, max) : tags;

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {shown.map((tag) => (
        <Badge key={tag} size={size}>
          {tag}
        </Badge>
      ))}
    </div>
  );
};

export default TagList;
