import { motion } from "motion/react";

const pieces = Array.from({ length: 18 }, (_, index) => ({
  id: index,
  x: 7 + ((index * 37) % 86),
  drift: -46 + ((index * 29) % 92),
  fall: 28 + ((index * 17) % 62),
  turn: -115 + ((index * 43) % 230),
  delay: (index % 6) * 0.025,
  color: ["accent", "orange", "green"][index % 3]!,
}));

export function ClosingConfetti() {
  return (
    <div className="closing-confetti" aria-hidden="true">
      {pieces.map((piece) => (
        <motion.i
          key={piece.id}
          className={piece.color}
          style={{ left: `${piece.x}%` }}
          initial={{ opacity: 0, x: 0, y: -8, rotate: 0, scale: 0.75 }}
          animate={{ opacity: [0, 1, 1, 0], x: piece.drift, y: piece.fall, rotate: piece.turn, scale: [0.75, 1, 0.9] }}
          transition={{ duration: 0.74, delay: piece.delay, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}
