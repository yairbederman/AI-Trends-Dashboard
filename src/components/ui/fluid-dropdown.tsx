"use client"

import * as React from "react"
import { motion, AnimatePresence, MotionConfig } from "framer-motion"
import { ChevronDown, Clock, Calendar, History, Timer, Hourglass } from "lucide-react"

// Utility function for className merging
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}

// Custom hook for click outside detection
function useClickAway(ref: React.RefObject<any>, handler: (event: MouseEvent | TouchEvent) => void) {
  React.useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return
      }
      handler(event)
    }

    document.addEventListener("mousedown", listener)
    document.addEventListener("touchstart", listener)

    return () => {
      document.removeEventListener("mousedown", listener)
      document.removeEventListener("touchstart", listener)
    }
  }, [ref, handler])
}

// Button component
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "outline"
  children: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          variant === "outline" && "border border-neutral-700 bg-transparent",
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"

// Types
export interface TimeRangeOption {
  id: string
  label: string
  icon: React.ElementType
  color: string
}

const timeRanges: TimeRangeOption[] = [
  { id: "1h", label: "Last 1 Hour", icon: Clock, color: "#8E9AAF" },
  { id: "12h", label: "Last 12 Hours", icon: History, color: "#9A8C98" },
  { id: "24h", label: "Last 24 Hours", icon: Calendar, color: "#9A8C98" },
  { id: "48h", label: "Last 48 Hours", icon: Timer, color: "#9A8C98" },
  { id: "7d", label: "Last Week", icon: Hourglass, color: "#9A8C98" },
]

// Icon wrapper with animation
const IconWrapper = ({
  icon: Icon,
  isHovered,
  color,
}: { icon: React.ElementType; isHovered: boolean; color: string }) => (
  <motion.div
    className="w-4 h-4 mr-2 relative"
    initial={false}
    animate={isHovered ? { scale: 1.2 } : { scale: 1 }}
  >
    <Icon className="w-4 h-4" />
    {isHovered && (
      <motion.div
        className="absolute inset-0"
        style={{ color }}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
      >
        <Icon className="w-4 h-4" strokeWidth={2} />
      </motion.div>
    )}
  </motion.div>
)

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      when: "beforeChildren",
      staggerChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: -10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
    },
  },
}

interface FluidDropdownProps {
  activeRange: string;
  onRangeChange: (range: any) => void;
  className?: string;
}

// Main component
export function FluidDropdown({ activeRange, onRangeChange, className }: FluidDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const selectedRange = timeRanges.find(r => r.id === activeRange) || timeRanges[0]
  const [hoveredRange, setHoveredRange] = React.useState<string | null>(null)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  useClickAway(dropdownRef, () => setIsOpen(false))

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false)
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn("w-48 relative", className)}
        ref={dropdownRef}
      >
        <Button
          variant="outline"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-full justify-between bg-zinc-900/50 text-zinc-400 border-zinc-800/50 backdrop-blur-md",
            "hover:bg-zinc-800/80 hover:text-zinc-200 hover:border-zinc-700/50",
            "focus:ring-2 focus:ring-zinc-700 focus:ring-offset-2 focus:ring-offset-black",
            "transition-all duration-200 ease-in-out",
            "h-10 px-3 rounded-full",
            isOpen && "bg-zinc-800 text-zinc-200 border-zinc-700",
          )}
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          <span className="flex items-center">
            <IconWrapper
              icon={selectedRange.icon}
              isHovered={false}
              color={selectedRange.color}
            />
            <span className="font-medium truncate">{selectedRange.label}</span>
          </span>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-center w-5 h-5 ml-1"
          >
            <ChevronDown className="w-4 h-4" />
          </motion.div>
        </Button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 1, y: 0, height: 0 }}
              animate={{
                opacity: 1,
                y: 0,
                height: "auto",
                transition: {
                  type: "spring",
                  stiffness: 500,
                  damping: 30,
                  mass: 1,
                },
              }}
              exit={{
                opacity: 0,
                y: 0,
                height: 0,
                transition: {
                  type: "spring",
                  stiffness: 500,
                  damping: 30,
                  mass: 1,
                },
              }}
              className="absolute right-0 top-full mt-2 z-50 w-56"
              onKeyDown={handleKeyDown}
            >
              <motion.div
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/95 backdrop-blur-xl p-1 shadow-2xl overflow-hidden"
                initial={{ borderRadius: 16 }}
                animate={{
                  borderRadius: 20,
                  transition: { duration: 0.2 },
                }}
                style={{ transformOrigin: "top" }}
              >
                <motion.div
                  className="py-1 relative"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <motion.div
                    layoutId="hover-highlight"
                    className="absolute inset-x-1 bg-zinc-800/80 rounded-xl"
                    animate={{
                      y: timeRanges.findIndex((c) => (hoveredRange || selectedRange.id) === c.id) * 40,
                      height: 40,
                    }}
                    transition={{
                      type: "spring",
                      bounce: 0.15,
                      duration: 0.5,
                    }}
                  />
                  {timeRanges.map((range) => (
                    <motion.button
                      key={range.id}
                      onClick={() => {
                        onRangeChange(range.id)
                        setIsOpen(false)
                      }}
                      onHoverStart={() => setHoveredRange(range.id)}
                      onHoverEnd={() => setHoveredRange(null)}
                      className={cn(
                        "relative flex w-full items-center px-3 py-2 text-sm rounded-xl",
                        "transition-colors duration-150",
                        "focus:outline-none",
                        selectedRange.id === range.id || hoveredRange === range.id
                          ? "text-zinc-100"
                          : "text-zinc-400",
                      )}
                      whileTap={{ scale: 0.98 }}
                      variants={itemVariants}
                    >
                      <IconWrapper
                        icon={range.icon}
                        isHovered={hoveredRange === range.id}
                        color={range.color}
                      />
                      <span className="font-medium">{range.label}</span>
                    </motion.button>
                  ))}
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  )
}