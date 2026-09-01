interface CategoryFilterProps {
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

export function CategoryFilter({
  categories,
  selectedCategory,
  onSelectCategory,
}: CategoryFilterProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {categories.map((category) => (
        <button
          key={category}
          onClick={() => onSelectCategory(category)}
          className={`px-6 py-3 rounded-lg text-base transition-colors ${
            selectedCategory === category
              ? 'bg-primary text-primary-foreground'
              : 'bg-white border-2 border-neutral-300 hover:border-neutral-900'
          }`}
        >
          {category}
        </button>
      ))}
    </div>
  );
}
