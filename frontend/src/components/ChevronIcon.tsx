import "./ChevronIcon.css";

interface ChevronIconProps {
  isOpen: boolean;
  className?: string;
}

export default function ChevronIcon({ isOpen, className = "" }: ChevronIconProps) {
  return (
    <span className={`chevron-icon ${isOpen ? 'chevron-open' : 'chevron-closed'} ${className}`}>
      <svg
        width="10"
        height="6"
        viewBox="0 0 10 6"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M1 1L5 5L9 1"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
